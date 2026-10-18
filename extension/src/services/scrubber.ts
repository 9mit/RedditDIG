/**
 * RedditDIG - Account & Profile Scrubber Service
 *
 * Implements a privacy-first, zero-egress deletion engine for Reddit accounts:
 * 1. Authenticated session detection via local browser cookies/modhash.
 * 2. Complete enumeration of user posts and comments via Reddit JSON feeds.
 * 3. Two-stage scrub: Overwrites content with clean text before deletion to prevent
 *    database and third-party archive retention of personal text.
 * 4. Permanent deletion via Reddit's /api/del endpoint.
 * 5. Automatic rate-limiting and exponential backoff on HTTP 429.
 * 6. Full purge of local extension data (chrome.storage.local).
 */

export interface RedditUserSession {
  username: string;
  id: string;
  modhash: string;
  iconImg?: string;
  isLoggedIn: boolean;
  totalKarma?: number;
}

export interface ScrubItem {
  id: string; // e.g. "abc123"
  fullName: string; // e.g. "t1_abc123" or "t3_abc123"
  type: 'comment' | 'post';
  title?: string;
  bodyPreview?: string;
  subreddit: string;
  createdUtc: number;
  permalink: string;
  isSelf?: boolean;
}

export interface OverwriteResult {
  success: boolean;
  isTooOld?: boolean;
  error?: string;
}

export type ScrubLogType = 'info' | 'success' | 'warn' | 'error';

export interface ScrubLogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: ScrubLogType;
}

export interface ScrubberStats {
  totalDiscovered: number;
  totalComments: number;
  totalPosts: number;
  processedCount: number;
  commentsDeleted: number;
  postsDeleted: number;
  failedCount: number;
  retriedCount: number;
}

export interface ScrubExecutionOptions {
  overwriteBeforeDelete?: boolean;
  replacementText?: string;
  throttleMs?: number;
  purgeExtensionStorageOnFinish?: boolean;
  onProgress?: (stats: ScrubberStats, currentItem: ScrubItem | null) => void;
  onLog?: (entry: ScrubLogEntry) => void;
  signal?: AbortSignal;
  shouldPause?: () => boolean;
}

const DEFAULT_OVERWRITE_TEXT = '[Deleted by user for privacy]';
const DEFAULT_THROTTLE_MS = 600; // 600ms between requests to stay well within limits
const MAX_RETRIES = 5;

export class RedditScrubberService {
  /**
   * Detects the currently logged-in Reddit user session from the browser.
   * Leverages extension host permissions to read the user's active session.
   */
  public static async getCurrentUserSession(): Promise<RedditUserSession | null> {
    try {
      // 1. Try /api/me.json (Standard web session endpoint)
      const resp = await fetch('https://www.reddit.com/api/me.json', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      if (resp.ok) {
        const json = await resp.json();
        if (json?.data?.name) {
          return {
            username: json.data.name,
            id: json.data.id || '',
            modhash: json.data.modhash || '',
            iconImg: json.data.icon_img || undefined,
            totalKarma: json.data.total_karma || 0,
            isLoggedIn: true
          };
        }
      }

      // 2. Fallback: Query old.reddit.com to extract modhash and username if new Reddit API is obscured
      const htmlResp = await fetch('https://old.reddit.com/', {
        method: 'GET',
        credentials: 'include'
      });

      if (htmlResp.ok) {
        const text = await htmlResp.text();
        const userMatch = text.match(/<span class="user">\s*<a[^>]+>([^<]+)<\/a>/i);
        const uhMatch = text.match(/name="uh"\s+value="([^"]+)"/i) || text.match(/"modhash":\s*"([^"]+)"/i);

        if (userMatch && userMatch[1]) {
          return {
            username: userMatch[1].trim(),
            id: '',
            modhash: uhMatch ? uhMatch[1] : '',
            isLoggedIn: true
          };
        }
      }

      return null;
    } catch (err) {
      console.warn('RedditDIG Scrubber: Session detection failed:', err);
      return null;
    }
  }

  /**
   * Refreshes or retrieves the modhash (CSRF token) needed for Reddit write operations.
   */
  public static async getModhash(signal?: AbortSignal, onRetry?: () => void): Promise<string> {
    try {
      const resp = await this.fetchWithRetry('https://www.reddit.com/api/me.json', {
        method: 'GET',
        credentials: 'include'
      }, signal, onRetry);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.data?.modhash) {
          return data.data.modhash;
        }
      }

      // Try old.reddit as backup
      const oldResp = await this.fetchWithRetry('https://old.reddit.com/', { credentials: 'include' }, signal, onRetry);
      if (oldResp.ok && typeof oldResp.text === 'function') {
        const html = await oldResp.text();
        const m = html.match(/name="uh"\s+value="([^"]+)"/i) || html.match(/"modhash":\s*"([^"]+)"/i);
        if (m && m[1]) return m[1];
      }
    } catch (e: any) {
      if (e?.name === 'AbortError' || signal?.aborted) throw e;
      console.warn('RedditDIG Scrubber: Error getting modhash:', e);
    }
    return '';
  }

  /**
   * Discovers all submissions and comments made by the given user.
   */
  public static async discoverAllUserItems(
    username: string,
    onProgress?: (foundCount: number, type: 'comments' | 'posts') => void,
    signal?: AbortSignal
  ): Promise<{ comments: ScrubItem[]; posts: ScrubItem[] }> {
    const comments: ScrubItem[] = [];
    const posts: ScrubItem[] = [];

    // 1. Fetch comments
    let afterComment: string | null = null;
    while (!signal?.aborted) {
      const url = `https://www.reddit.com/user/${encodeURIComponent(username)}/comments.json?limit=100${
        afterComment ? `&after=${afterComment}` : ''
      }`;
      const res = await this.fetchWithRetry(url, { credentials: 'include' }, signal);
      if (!res.ok) {
        throw new Error(`Failed to fetch user comments: HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (data?.error) {
        throw new Error(`Failed to fetch user comments: ${data.message || data.error}`);
      }
      const children = data?.data?.children || [];
      if (children.length === 0) break;

      for (const item of children) {
        const c = item.data;
        if (!c?.id) continue;
        comments.push({
          id: c.id,
          fullName: c.name || `t1_${c.id}`,
          type: 'comment',
          bodyPreview: (c.body || '').slice(0, 120),
          subreddit: c.subreddit || '',
          createdUtc: c.created_utc || 0,
          permalink: c.permalink ? `https://www.reddit.com${c.permalink}` : ''
        });
      }

      onProgress?.(comments.length, 'comments');
      afterComment = data?.data?.after || null;
      if (!afterComment) break;
      await this.sleep(300, signal); // Be respectful while paginating
    }

    if (signal?.aborted) {
      const abortErr = new Error('Discovery cancelled by user');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    // 2. Fetch submissions (posts)
    let afterPost: string | null = null;
    while (!signal?.aborted) {
      const url = `https://www.reddit.com/user/${encodeURIComponent(username)}/submitted.json?limit=100${
        afterPost ? `&after=${afterPost}` : ''
      }`;
      const res = await this.fetchWithRetry(url, { credentials: 'include' }, signal);
      if (!res.ok) {
        throw new Error(`Failed to fetch user posts: HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (data?.error) {
        throw new Error(`Failed to fetch user posts: ${data.message || data.error}`);
      }
      const children = data?.data?.children || [];
      if (children.length === 0) break;

      for (const item of children) {
        const p = item.data;
        if (!p?.id) continue;
        posts.push({
          id: p.id,
          fullName: p.name || `t3_${p.id}`,
          type: 'post',
          title: p.title || '',
          bodyPreview: (p.selftext || p.title || '').slice(0, 120),
          subreddit: p.subreddit || '',
          createdUtc: p.created_utc || 0,
          permalink: p.permalink ? `https://www.reddit.com${p.permalink}` : '',
          isSelf: p.is_self ?? true
        });
      }

      onProgress?.(posts.length, 'posts');
      afterPost = data?.data?.after || null;
      if (!afterPost) break;
      await this.sleep(300, signal);
    }

    if (signal?.aborted) {
      const abortErr = new Error('Discovery cancelled by user');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    return { comments, posts };
  }

  /**
   * Overwrites the body of a comment or post before deletion.
   * This is critical: if deleted without overwriting, Reddit and third-party archives
   * often preserve the original content with author marked [deleted].
   */
  public static async overwriteItem(
    item: ScrubItem,
    modhash: string,
    replacementText: string = DEFAULT_OVERWRITE_TEXT,
    signal?: AbortSignal,
    onRetry?: () => void
  ): Promise<OverwriteResult> {
    const body = new URLSearchParams({
      api_type: 'json',
      thing_id: item.fullName,
      text: replacementText,
      uh: modhash
    });

    const res = await this.fetchWithRetry('https://www.reddit.com/api/editusertext', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Modhash': modhash
      },
      body: body.toString(),
      credentials: 'include'
    }, signal, onRetry);

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    try {
      const data = await res.json();
      const errors = data?.json?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        // Reddit error format: [["ERROR_CODE", "Error message", "field"]]
        const isTooOld = errors.some((e: any) =>
          Array.isArray(e) && (e[0] === 'TOO_OLD' || (typeof e[1] === 'string' && e[1].toLowerCase().includes('archived')))
        );
        const errorMsg = errors.map((e: any) => Array.isArray(e) ? e.join(': ') : String(e)).join(', ');
        return { success: false, isTooOld, error: errorMsg };
      }
      return { success: true };
    } catch {
      // If response body is empty or not JSON but res.ok is true
      return { success: true };
    }
  }

  /**
   * Permanently deletes a comment or post from Reddit.
   */
  public static async deleteItem(
    item: ScrubItem,
    modhash: string,
    signal?: AbortSignal,
    onRetry?: () => void
  ): Promise<boolean> {
    const body = new URLSearchParams({
      id: item.fullName,
      executed: 'deleted',
      uh: modhash
    });

    const res = await this.fetchWithRetry('https://www.reddit.com/api/del', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Modhash': modhash
      },
      body: body.toString(),
      credentials: 'include'
    }, signal, onRetry);

    if (!res.ok) return false;

    try {
      const data = await res.json();
      if (data?.json?.errors && Array.isArray(data.json.errors) && data.json.errors.length > 0) {
        return false;
      }
      return true;
    } catch {
      return res.ok;
    }
  }

  /**
   * Executes the full scrubbing process across all items.
   */
  public static async executeScrub(
    items: ScrubItem[],
    options: ScrubExecutionOptions
  ): Promise<ScrubberStats> {
    if (options.signal?.aborted) {
      const abortErr = new Error('Scrub process cancelled by user');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const stats: ScrubberStats = {
      totalDiscovered: items.length,
      totalComments: items.filter(i => i.type === 'comment').length,
      totalPosts: items.filter(i => i.type === 'post').length,
      processedCount: 0,
      commentsDeleted: 0,
      postsDeleted: 0,
      failedCount: 0,
      retriedCount: 0
    };

    const countRetry = () => { stats.retriedCount++; };

    let modhash = await this.getModhash(options.signal, countRetry);

    if (options.signal?.aborted) {
      const abortErr = new Error('Scrub process cancelled by user');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    const overwrite = options.overwriteBeforeDelete ?? true;
    const replacementText = options.replacementText || DEFAULT_OVERWRITE_TEXT;
    const throttleMs = Math.max(0, options.throttleMs ?? DEFAULT_THROTTLE_MS);

    const log = (msg: string, type: ScrubLogType = 'info') => {
      options.onLog?.({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        message: msg,
        type
      });
    };

    log(`Starting scrub process for ${items.length} items (${stats.totalComments} comments, ${stats.totalPosts} posts)...`, 'info');

    for (let i = 0; i < items.length; i++) {
      if (options.signal?.aborted) {
        log('Scrub process cancelled by user.', 'warn');
        const abortErr = new Error('Scrub process cancelled by user');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      // Check pause
      while (options.shouldPause?.() && !options.signal?.aborted) {
        await this.sleep(400, options.signal).catch(() => {});
      }

      // Check abort immediately after pause loop
      if (options.signal?.aborted) {
        log('Scrub process cancelled by user.', 'warn');
        const abortErr = new Error('Scrub process cancelled by user');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      const item = items[i];
      const descriptor = item.type === 'comment'
        ? `Comment in r/${item.subreddit} (${item.fullName})`
        : `Post "${(item.title || '').slice(0, 30)}..." in r/${item.subreddit} (${item.fullName})`;

      options.onProgress?.(stats, item);

      try {
        // Step 1: Overwrite text if requested (only self-posts and comments have body text)
        if (overwrite && (item.type === 'comment' || item.isSelf !== false)) {
          log(`[OVERWRITE] Redacting ${descriptor}...`, 'info');
          const overwriteResult = await this.overwriteItem(
            item,
            modhash,
            replacementText,
            options.signal,
            countRetry
          );

          if (!overwriteResult.success) {
            if (overwriteResult.isTooOld) {
              log(`[WARN] ${item.fullName} is archived (>6 months) and cannot be edited. Proceeding to delete...`, 'warn');
            } else {
              // Modhash might have expired; try refreshing once
              log(`[INFO] Overwrite failed for ${item.fullName} (${overwriteResult.error || 'modhash expired'}), refreshing modhash and retrying...`, 'info');
              modhash = await this.getModhash(options.signal, countRetry);
              const retryResult = await this.overwriteItem(
                item,
                modhash,
                replacementText,
                options.signal,
                countRetry
              );
              if (!retryResult.success) {
                if (retryResult.isTooOld) {
                  log(`[WARN] ${item.fullName} is archived and cannot be edited. Proceeding to delete...`, 'warn');
                } else {
                  log(`[WARN] Overwrite retry failed for ${item.fullName} (${retryResult.error || 'unknown error'}). Proceeding to delete...`, 'warn');
                }
              }
            }
          }
          await this.sleep(throttleMs / 2, options.signal);
        } else if (overwrite && item.type === 'post' && item.isSelf === false) {
          log(`[SKIP OVERWRITE] Post ${item.fullName} is a link post without body text. Proceeding to delete...`, 'info');
        }

        // Step 2: Delete item
        log(`[DELETE] Deleting ${descriptor}...`, 'info');
        let deleteOk = await this.deleteItem(
          item,
          modhash,
          options.signal,
          countRetry
        );

        if (!deleteOk) {
          // Modhash might have expired; refresh once and retry
          log(`[INFO] Delete failed for ${item.fullName}, refreshing modhash and retrying...`, 'info');
          modhash = await this.getModhash(options.signal, countRetry);
          deleteOk = await this.deleteItem(
            item,
            modhash,
            options.signal,
            countRetry
          );
        }

        if (deleteOk) {
          stats.processedCount++;
          if (item.type === 'comment') stats.commentsDeleted++;
          else stats.postsDeleted++;
          log(`[SUCCESS] Deleted ${item.fullName}`, 'success');
        } else {
          stats.processedCount++;
          stats.failedCount++;
          log(`[ERROR] Failed to delete ${item.fullName}`, 'error');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || options.signal?.aborted) {
          log('Scrub process cancelled by user.', 'warn');
          const abortErr = new Error('Scrub process cancelled by user');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        stats.processedCount++;
        stats.failedCount++;
        log(`[ERROR] Exception on ${item.fullName}: ${err?.message || 'Network error'}`, 'error');
      }

      options.onProgress?.(stats, null);

      try {
        await this.sleep(throttleMs, options.signal);
      } catch (err: any) {
        if (err?.name === 'AbortError' || options.signal?.aborted) {
          log('Scrub process cancelled by user.', 'warn');
          const abortErr = new Error('Scrub process cancelled by user');
          abortErr.name = 'AbortError';
          throw abortErr;
        }
        throw err;
      }
    }

    log(`Scrub finished: ${stats.commentsDeleted} comments and ${stats.postsDeleted} posts deleted (${stats.failedCount} failed).`, 'info');

    // Purge local extension data if requested and NOT aborted
    if (options.purgeExtensionStorageOnFinish && !options.signal?.aborted) {
      log('Purging all local extension settings and cached thread data...', 'warn');
      await this.purgeAllExtensionData();
      log('Local extension storage completely purged.', 'success');
    }

    return stats;
  }

  /**
   * Clears all local extension storage, settings, and caches.
   */
  public static async purgeAllExtensionData(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local?.clear) {
        await chrome.storage.local.clear();
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.sync?.clear) {
        await chrome.storage.sync.clear();
      }
      if (typeof chrome !== 'undefined' && chrome.storage?.session?.clear) {
        await chrome.storage.session.clear();
      }
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem('redditdig_settings');
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.toLowerCase().includes('redditdig')) {
              localStorage.removeItem(key);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('RedditDIG Scrubber: Storage clear failed:', e);
    }
  }

  /**
   * Helper that executes fetch requests with automatic exponential backoff on HTTP 429 (rate limits).
   */
  private static async fetchWithRetry(
    url: string,
    init: RequestInit,
    signal?: AbortSignal,
    onRetry?: () => void
  ): Promise<Response> {
    let attempt = 0;
    const delay = 1000;

    while (attempt < MAX_RETRIES) {
      if (signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }

      try {
        const response = await fetch(url, { ...init, signal });

        if (response.status === 429) {
          attempt++;
          onRetry?.();
          // Read retry-after header if provided, otherwise exponential backoff
          const retryAfter = response.headers?.get ? response.headers.get('retry-after') : null;
          let waitTime = delay * (2 ** (attempt - 1));

          if (retryAfter) {
            const parsedSeconds = parseInt(retryAfter, 10);
            if (!isNaN(parsedSeconds) && parsedSeconds >= 0) {
              waitTime = parsedSeconds * 1000;
            } else {
              const retryDate = Date.parse(retryAfter);
              if (!isNaN(retryDate)) {
                const diffMs = retryDate - Date.now();
                if (diffMs > 0) waitTime = diffMs;
              }
            }
          }

          console.warn(`RedditDIG Scrubber: Rate limited (429). Retrying in ${waitTime}ms... (attempt ${attempt}/${MAX_RETRIES})`);
          await this.sleep(waitTime, signal);
          continue;
        }

        return response;
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) {
          throw err;
        }
        attempt++;
        if (attempt >= MAX_RETRIES) throw err;
        await this.sleep(delay * attempt, signal);
      }
    }

    throw new Error(`Exceeded maximum retries (${MAX_RETRIES}) for ${url}`);
  }

  public static sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return reject(error);
      }

      let timeoutId: any;
      const onAbort = () => {
        clearTimeout(timeoutId);
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      };

      timeoutId = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
