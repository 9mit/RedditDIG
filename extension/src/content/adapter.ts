// RedditPageAdapter: Centralized, resilient Reddit DOM extraction, safe progressive expansion, and navigation adapter.
// Supports modern Reddit (shreddit-comment), classic new Reddit, and old.reddit.com.

import { CoverageInfo } from '../types';

export interface ExtractedTimestamp {
  utc: number | null;
  relativeText: string | null;
  displayText: string;
}

export interface ExtractedAwards {
  dataAvailable: boolean;
  totalCount: number | null;
  awards: Array<{ name: string; count: number; iconUrl?: string }>;
}

export interface ExtractedPost {
  id: string;
  url: string;
  title: string;
  author: string;
  subreddit: string;
  selftext: string;
  score: number;
  upvoteRatio: number;
  createdUtc: number | null;
  createdRelative: string | null;
  timestampDisplay: string;
  commentCount: number | null;
  permalink: string;
}

export interface ExtractedComment {
  id: string;
  redditId: string;
  parentId: string | null;
  author: string;
  body: string;
  score: number;
  repliesCount: number;
  depth: number;
  createdUtc: number | null;
  createdRelative: string | null;
  timestampDisplay: string;
  awardsDataAvailable: boolean;
  awardsCount: number | null;
  awardsData: Array<{ name: string; count: number; iconUrl?: string }>;
  permalink: string;
  isOp: boolean;
}

export interface ExtractionResult {
  post: ExtractedPost;
  comments: ExtractedComment[];
  totalReportedComments: number | null;
  commentsFound: number;
  commentsAnalyzed: number;
  commentsUnavailable: number;
  expansionAttempts: number;
  coverageRatio: number;
  coverageText: string;
  coverage: CoverageInfo;
}

export interface ExpandOptions {
  maxComments?: number;
  maxTimeMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (progress: { loadedComments: number; step: string }) => void;
}

/** Robust timestamp extraction in strict priority order (P3) */
export function extractTimestampFromElement(el: Element): ExtractedTimestamp {
  // 1. Explicit timestamp attribute on element or children
  const explicitAttrs = ['created-timestamp', 'data-timestamp', 'timestamp'];
  for (const attr of explicitAttrs) {
    const val = el.getAttribute(attr) || el.querySelector(`[${attr}]`)?.getAttribute(attr);
    if (val) {
      const parsedUtc = parseTimestampValue(val);
      if (parsedUtc !== null) {
        return {
          utc: parsedUtc,
          relativeText: null,
          displayText: new Date(parsedUtc * 1000).toLocaleString()
        };
      }
    }
  }

  // 2. <time> elements with datetime or title
  const timeEl = el.querySelector('time');
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime');
    if (dt) {
      const parsedUtc = parseTimestampValue(dt);
      if (parsedUtc !== null) {
        const textContent = timeEl.textContent?.trim() || null;
        return {
          utc: parsedUtc,
          relativeText: textContent,
          displayText: textContent || new Date(parsedUtc * 1000).toLocaleString()
        };
      }
    }
    const titleVal = timeEl.getAttribute('title');
    if (titleVal) {
      const parsedUtc = parseTimestampValue(titleVal);
      if (parsedUtc !== null) {
        return {
          utc: parsedUtc,
          relativeText: timeEl.textContent?.trim() || null,
          displayText: timeEl.textContent?.trim() || new Date(parsedUtc * 1000).toLocaleString()
        };
      }
    }
    // If exact failed, capture time element text
    const timeText = timeEl.textContent?.trim();
    if (timeText) {
      return {
        utc: null,
        relativeText: timeText,
        displayText: timeText
      };
    }
  }

  // 3. datetime attribute on current element or child
  const dtAttr = el.getAttribute('datetime') || el.querySelector('[datetime]')?.getAttribute('datetime');
  if (dtAttr) {
    const parsedUtc = parseTimestampValue(dtAttr);
    if (parsedUtc !== null) {
      return {
        utc: parsedUtc,
        relativeText: null,
        displayText: new Date(parsedUtc * 1000).toLocaleString()
      };
    }
  }

  // 4. Structured relative-time text parsing from comment header/tagline
  const relativeRegex = /(\d+\s*(?:sec|second|min|minute|hr|hour|day|mo|month|yr|year)s?\s*ago|just\s*now)/i;
  const match = el.textContent?.match(relativeRegex);
  if (match) {
    const relStr = match[1].trim();
    return {
      utc: null,
      relativeText: relStr,
      displayText: relStr
    };
  }

  // Never fabricate a timestamp!
  return {
    utc: null,
    relativeText: null,
    displayText: 'Timestamp unavailable'
  };
}

/** Parses numeric epoch seconds/ms or ISO-8601 strings into epoch seconds */
function parseTimestampValue(val: string): number | null {
  if (!val) return null;
  val = val.trim();

  // Numeric epoch
  if (/^\d+$/.test(val)) {
    const num = Number(val);
    if (isNaN(num) || num <= 0) return null;
    return num > 1e11 ? Math.floor(num / 1000) : Math.floor(num);
  }

  // ISO string or date parse
  const parsed = Date.parse(val);
  if (!isNaN(parsed) && parsed > 0) {
    return Math.floor(parsed / 1000);
  }

  return null;
}

/**
 * Checks whether awards are supported on the current Reddit page or interface.
 * Returns true on modern Reddit (shreddit), new Reddit, old Reddit, or when award UI elements are detected.
 */
export function isAwardsSupportedOnPage(): boolean {
  if (typeof document === 'undefined') return false;

  // 1. Any direct award UI element anywhere in the DOM (badges, buttons, gilded icons)
  try {
    if (
      document.querySelector(
        'faceplate-award-badge, shreddit-award, [slot="award"], [slot="awards"], [slot="badges"], [data-testid*="award"], ' +
        'award-button, a.give-gold, a.award-badge, span.award-badge, span.gilded-badge, ' +
        'button[aria-label*="award" i], a[href*="/awards"], [data-award-id]'
      )
    ) {
      return true;
    }
  } catch {}

  // 2. Standard Reddit host platforms (modern shreddit, classic new Reddit, old Reddit)
  try {
    if (
      document.querySelector('shreddit-app, shreddit-post, shreddit-comment') ||
      document.querySelector('div[data-testid="post-container"], div[data-testid="comment"]') ||
      document.querySelector('body.moderator, div.thing.comment, div.nestedlisting')
    ) {
      return true;
    }
  } catch {}

  // 3. Reddit URL domain check (includes reddit.com and all subdomains)
  try {
    if (typeof window !== 'undefined' && window.location?.hostname && /(^|\.)reddit\.com$/i.test(window.location.hostname)) {
      return true;
    }
  } catch {}

  return false;
}

/** Helper to verify an element/node belongs directly to containerEl and not to a nested descendant comment */
function belongsDirectlyToComment(node: Node, containerEl: Element): boolean {
  let curr: Node | null = node;
  while (curr && curr !== containerEl) {
    if (curr instanceof Element && curr !== containerEl) {
      const tag = curr.tagName ? curr.tagName.toLowerCase() : '';
      if (
        tag === 'shreddit-comment' ||
        (curr.getAttribute && curr.getAttribute('data-testid') === 'comment') ||
        (curr.classList && curr.classList.contains('thing') && curr.classList.contains('comment'))
      ) {
        return false;
      }
    }
    if (curr.parentNode) {
      curr = curr.parentNode;
    } else if ((curr as ShadowRoot).host) {
      curr = (curr as ShadowRoot).host;
    } else {
      break;
    }
  }
  return curr === containerEl;
}

/** Robust award extraction across Reddit interfaces (modern shreddit, new Reddit, old Reddit) */
export function extractAwardsFromElement(el: Element): ExtractedAwards {
  const awards: Array<{ name: string; count: number; iconUrl?: string }> = [];
  let totalCount = 0;
  const seenElements = new Set<Element>();

  // Helper to safely collect award elements including within open shadow roots recursively
  function collectAwardNodes(root: Element | ShadowRoot) {
    if (!root) return;
    try {
      // 1. Modern Reddit (shreddit) & common award badge selectors
      const found = root.querySelectorAll(
        'faceplate-award-badge, shreddit-award, [slot="award"], [slot="awards"], [slot="badges"], [data-testid="award_badge"], ' +
        '[data-testid="comment-award-badge"], [data-testid="post-award-badge"], [data-testid*="award"], ' +
        'button[aria-label*="award" i], button[aria-label*="gold" i], [noun*="award"], [noun*="gold"], ' +
        '[slot*="award"], [slot*="gold"], [data-testid*="gold"], ' +
        'award-button, div[data-testid="award-container"] button, div[data-testid="award-container"] span, ' +
        'a.award-badge, span.award-badge, div.tagline a.awarded, span.gilded-badge, span.gilded-count, ' +
        '[data-award-id], a[href*="/awards"]'
      );
      for (let i = 0; i < found.length; i++) {
        const item = found[i];
        if (belongsDirectlyToComment(item, el)) {
          seenElements.add(item);
        }
      }
    } catch {}

    // Check open shadow roots on all children recursively, skipping nested comments
    try {
      const allChildren = root.querySelectorAll('*');
      for (let i = 0; i < allChildren.length; i++) {
        const child = allChildren[i];
        if (child !== el) {
          const tag = child.tagName ? child.tagName.toLowerCase() : '';
          if (
            tag === 'shreddit-comment' ||
            child.getAttribute?.('data-testid') === 'comment' ||
            (child.classList?.contains('thing') && child.classList?.contains('comment'))
          ) {
            continue;
          }
        }
        if (child.shadowRoot) {
          collectAwardNodes(child.shadowRoot);
        }
      }
    } catch {}
  }

  // Inspect el and el's open shadowRoot
  collectAwardNodes(el);
  if (el.shadowRoot) {
    collectAwardNodes(el.shadowRoot);
  }

  // Process all collected badge elements
  if (seenElements.size > 0) {
    // If a container in seenElements contains specific child award badges in seenElements,
    // prune the container so child badges are retained with their specific details.
    for (const node of Array.from(seenElements)) {
      const containsBadges = Array.from(node.querySelectorAll('faceplate-award-badge, shreddit-award, [data-award-id]'))
        .some(child => seenElements.has(child));
      if (containsBadges) {
        seenElements.delete(node);
      }
    }

    // Avoid double counting nested elements (e.g., span inside button)
    const elementsArray = Array.from(seenElements).filter(node => {
      let p = node.parentElement;
      while (p && p !== el) {
        if (seenElements.has(p)) return false;
        p = p.parentElement;
      }
      return true;
    });

    for (const badge of elementsArray) {
      const countAttr = badge.getAttribute('count') ||
        badge.getAttribute('data-count') ||
        badge.querySelector('[count]')?.getAttribute('count') ||
        badge.querySelector('faceplate-number')?.getAttribute('number');

      const imgEl = badge.querySelector('img[src*="/awards/"], img[src*="gold/awards"], img[src*="award"], img, faceplate-img');
      const text = badge.textContent?.trim() || '';
      const aria = badge.getAttribute('aria-label')?.trim() || '';
      const title = badge.getAttribute('title')?.trim() || '';

      // Parse numerical count if available
      let count = countAttr ? parseInt(countAttr.replace(/,/g, ''), 10) : NaN;
      if (isNaN(count)) {
        const numMatch = (text + ' ' + aria + ' ' + title).match(/\b([\d,]+)\b/);
        if (numMatch) {
          count = parseInt(numMatch[1].replace(/,/g, ''), 10);
        }
      }

      // Distinguish action buttons (e.g. unrewarded "Award" / "Give Award" button) from actual received award badges
      const tag = badge.tagName.toLowerCase();
      const hasAwardImg = Boolean(imgEl && (
        imgEl.getAttribute('src')?.includes('/awards/') ||
        imgEl.getAttribute('src')?.includes('gold/awards') ||
        imgEl.getAttribute('src')?.includes('award') ||
        imgEl.getAttribute('alt')?.toLowerCase().includes('award') ||
        imgEl.getAttribute('alt')?.toLowerCase().includes('gold') ||
        imgEl.tagName.toLowerCase() === 'faceplate-img'
      ));

      const isExplicitBadge =
        tag === 'faceplate-award-badge' ||
        tag === 'shreddit-award' ||
        badge.classList.contains('award-badge') ||
        badge.classList.contains('awarded') ||
        badge.classList.contains('gilded-badge') ||
        badge.classList.contains('gilded-count') ||
        badge.hasAttribute('data-award-id') ||
        hasAwardImg;

      const isUnrewardedButton =
        (tag === 'award-button' || tag === 'button' || badge.getAttribute('role') === 'button') &&
        !isExplicitBadge &&
        !hasAwardImg &&
        (badge.getAttribute('noun') === 'give_award' ||
         badge.getAttribute('data-testid') === 'give-award-button' ||
         /^(?:give\s+)?award$/i.test(aria || text || ''));

      if (isUnrewardedButton) {
        continue;
      }

      if (isNaN(count)) {
        if (isExplicitBadge || hasAwardImg || (aria && /\b(?:gold|award)\b/i.test(aria))) {
          count = 1;
        } else {
          continue;
        }
      }

      if (count <= 0) continue;

      // Extract award name
      const name =
        badge.getAttribute('description') ||
        badge.getAttribute('name') ||
        badge.getAttribute('data-award-name') ||
        badge.querySelector('[description]')?.getAttribute('description') ||
        badge.querySelector('[name]')?.getAttribute('name') ||
        badge.querySelector('faceplate-award-badge')?.getAttribute('description') ||
        imgEl?.getAttribute('alt') ||
        imgEl?.getAttribute('title') ||
        (badge.classList.contains('gilded-badge') || badge.classList.contains('gilded-count') ? 'Gold' : null) ||
        (title && !title.toLowerCase().startsWith('gilded') && !title.toLowerCase().startsWith('give') ? title : null) ||
        (aria && !aria.toLowerCase().startsWith('give') && !aria.toLowerCase().startsWith('award') ? aria : null) ||
        'Reddit Award';

      // Extract award icon URL
      const rawIconUrl =
        badge.getAttribute('icon-url') ||
        badge.getAttribute('data-icon') ||
        badge.querySelector('[icon-url]')?.getAttribute('icon-url') ||
        badge.querySelector('[data-icon]')?.getAttribute('data-icon') ||
        imgEl?.getAttribute('src') ||
        imgEl?.getAttribute('data-src') ||
        undefined;
      const iconUrl = rawIconUrl ? rawIconUrl.replace(/&amp;/g, '&') : undefined;

      totalCount += count;
      awards.push({ name, count, iconUrl });
    }
  }

  // If no badge elements were parsed, check host element or direct action row attributes directly
  if (awards.length === 0) {
    const actionRows = [
      ...Array.from(el.querySelectorAll('shreddit-comment-action-row')),
      ...(el.shadowRoot ? Array.from(el.shadowRoot.querySelectorAll('shreddit-comment-action-row')) : [])
    ];
    const actionRow = actionRows.find(ar => belongsDirectlyToComment(ar, el)) || actionRows[0];
    const hostCountAttr =
      el.getAttribute('award-count') ||
      el.getAttribute('awards-count') ||
      el.getAttribute('awards') ||
      el.getAttribute('data-award-count') ||
      el.getAttribute('data-awards-count') ||
      el.getAttribute('awardcount') ||
      el.getAttribute('awardscount') ||
      el.getAttribute('gold-count') ||
      el.getAttribute('goldcount') ||
      el.getAttribute('data-gilded') ||
      el.getAttribute('gilded') ||
      (el.hasAttribute('has-gold') || el.hasAttribute('gold') ? '1' : null) ||
      actionRow?.getAttribute('award-count') ||
      actionRow?.getAttribute('awards-count') ||
      actionRow?.getAttribute('data-award-count') ||
      actionRow?.getAttribute('data-awards-count') ||
      actionRow?.getAttribute('awardcount') ||
      actionRow?.getAttribute('awardscount') ||
      actionRow?.getAttribute('awards') ||
      actionRow?.getAttribute('gold-count') ||
      actionRow?.getAttribute('goldcount') ||
      actionRow?.getAttribute('data-gilded') ||
      actionRow?.getAttribute('gilded') ||
      (actionRow?.hasAttribute('has-gold') || actionRow?.hasAttribute('gold') ? '1' : null);
    if (hostCountAttr !== null && hostCountAttr !== undefined) {
      let parsed = parseInt(String(hostCountAttr).replace(/,/g, ''), 10);
      if (isNaN(parsed) && (hostCountAttr === '' || hostCountAttr === 'true')) {
        parsed = 1;
      }
      if (!isNaN(parsed) && parsed > 0) {
        totalCount = parsed;
        const isGold = Boolean(
          el.getAttribute('gold-count') || el.getAttribute('goldcount') || el.getAttribute('gilded') || el.getAttribute('data-gilded') ||
          el.hasAttribute('has-gold') || el.hasAttribute('gold') ||
          actionRow?.getAttribute('gold-count') || actionRow?.getAttribute('goldcount') || actionRow?.getAttribute('gilded') ||
          actionRow?.getAttribute('data-gilded') || actionRow?.hasAttribute('has-gold') || actionRow?.hasAttribute('gold')
        );
        awards.push({ name: isGold ? 'Gold' : 'Reddit Award', count: parsed });
      }
    }
  }

  if (awards.length > 0) {
    return {
      dataAvailable: true,
      totalCount,
      awards
    };
  }

  // Check if awards are supported on this Reddit interface/page
  const pageSupportsAwards = isAwardsSupportedOnPage() ||
    Boolean(el.closest?.('shreddit-app, shreddit-post, shreddit-comment, div[data-testid="comment"], div.thing.comment'));

  return {
    dataAvailable: pageSupportsAwards,
    totalCount: pageSupportsAwards ? 0 : null,
    awards: []
  };
}

/** Format relative time from UTC epoch seconds */
export function formatRelativeTime(utcSeconds: number | null): string | null {
  if (!utcSeconds) return null;
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - utcSeconds);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

/**
 * Resilient score parser for Reddit that accurately handles negative scores,
 * downvotes, Unicode minus characters (e.g. \u2212, \u2013), and 'points' suffixes.
 */
export function parseRedditScore(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') {
    return isNaN(raw) ? 0 : raw;
  }
  if (!raw || typeof raw !== 'string') return 0;

  // Replace unicode minuses, en-dashes, em-dashes, hyphens with standard ASCII hyphen
  // and remove whitespace between sign and digits (e.g. '− 5' -> '-5')
  const clean = raw.trim()
    .replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015]\s*/g, '-')
    .replace(/([+-])\s+/g, '$1');

  // Match e.g. -1.5k, -5, +3, 120, -5 points
  const match = clean.match(/([+-]?\d+(?:\.\d+)?)\s*([kKmM])?/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;

  const multiplier = match[2]?.toLowerCase() === 'm' ? 1000000 : match[2]?.toLowerCase() === 'k' ? 1000 : 1;
  return Math.round(num * multiplier);
}

/**
 * Recursively queries elements matching a selector, piercing any open shadow roots
 * within Reddit custom elements (shreddit-comment, faceplate-partial, etc.).
 * Safely defaults without evaluating document in non-DOM environments.
 */
export function querySelectorAllDeep(
  selector: string,
  root?: Document | ShadowRoot | Element
): HTMLElement[] {
  const results: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  const targetRoot = root || (typeof document !== 'undefined' ? document : null);
  if (!targetRoot) return results;

  function search(node: Document | ShadowRoot | Element) {
    try {
      const matched = node.querySelectorAll(selector);
      for (let i = 0; i < matched.length; i++) {
        const el = matched[i] as HTMLElement;
        if (!seen.has(el)) {
          seen.add(el);
          results.push(el);
        }
      }
    } catch {}

    try {
      // Direct query for known custom elements first for speed
      const hosts = node.querySelectorAll(
        'shreddit-comment, shreddit-comment-tree, faceplate-partial, faceplate-batch, faceplate-tracker, shreddit-post, shreddit-async-loader, [data-testid="comment"]'
      );
      for (let i = 0; i < hosts.length; i++) {
        const host = hosts[i];
        if (host.shadowRoot) {
          search(host.shadowRoot);
        }
      }

      // Also inspect any other elements with shadowRoot
      const allEls = node.querySelectorAll('*');
      for (let i = 0; i < allEls.length; i++) {
        const el = allEls[i];
        if (el.shadowRoot && !Array.from(hosts).includes(el)) {
          search(el.shadowRoot);
        }
      }
    } catch {}
  }

  search(targetRoot);
  return results;
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** Safely fetches JSON from Reddit with credentials, with fallback to background service worker */
export async function safeFetchJson(url: string, options: SafeFetchOptions = {}): Promise<any | null> {
  const method = options.method || 'GET';
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };

  // 1. Direct fetch from current page origin
  try {
    const fetchInit: RequestInit = {
      method,
      headers,
      credentials: 'include',
      signal: options.signal
    };
    if (options.body) {
      fetchInit.body = options.body;
    }

    const res = await fetch(url, fetchInit);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
    }
  } catch (directErr) {
    // If direct fetch threw, fall back to background worker
  }

  // 2. Fallback via background service worker (with host_permissions: https://*.reddit.com/*)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const fullUrl = url.startsWith('http')
        ? url
        : `${typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://www.reddit.com'}${url.startsWith('/') ? '' : '/'}${url}`;
      const bgRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'FETCH_REDDIT_JSON',
            url: fullUrl,
            method,
            headers: options.headers,
            body: options.body
          },
          (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              resolve(null);
            } else {
              resolve(response.data);
            }
          }
        );
      });
      if (bgRes) return bgRes;
    } catch {}
  }

  return null;
}

/**
 * Fetches batches of comment IDs directly via Reddit's native /api/info.json endpoint (P3).
 * Accepts up to 100 comment IDs per GET request with zero CSRF barriers.
 */
export async function fetchCommentsByInfoBatch(
  commentIds: string[],
  postAuthor: string,
  signal?: AbortSignal
): Promise<{ comments: ExtractedComment[]; deletedOrRemovedCount: number }> {
  const comments: ExtractedComment[] = [];
  let deletedOrRemovedCount = 0;
  if (!commentIds || commentIds.length === 0) return { comments, deletedOrRemovedCount };

  // Reddit /api/info accepts up to 100 fullnames per call
  const batchSize = 100;
  for (let i = 0; i < commentIds.length; i += batchSize) {
    if (signal?.aborted) break;
    const chunk = commentIds.slice(i, i + batchSize);
    const fullnames = chunk.map((id) => (id.startsWith('t1_') ? id : `t1_${id}`)).join(',');
    const url = `/api/info.json?id=${encodeURIComponent(fullnames)}&raw_json=1`;

    const data = await safeFetchJson(url, { signal });
    const children = data?.data?.children;
    if (Array.isArray(children)) {
      for (const item of children) {
        if (item.kind === 't1' && item.data) {
          const d = item.data;
          const cleanId = (d.id || '').replace(/^t1_/, '');
          const body = (d.body || '').trim();
          const author = d.author || '[deleted]';

          if (!body || body === '[deleted]' || body === '[removed]' || (author === '[deleted]' && !body)) {
            deletedOrRemovedCount++;
            continue;
          }

          const createdUtc = typeof d.created_utc === 'number' ? Math.floor(d.created_utc) : null;
          const timestampDisplay = createdUtc
            ? new Date(createdUtc * 1000).toLocaleString()
            : 'Timestamp unavailable';

          const awardsList: Array<{ name: string; count: number; iconUrl?: string }> = [];
          if (Array.isArray(d.all_awardings)) {
            for (const a of d.all_awardings) {
              const rawUrl = a.icon_url || a.resized_icons?.[0]?.url;
              awardsList.push({
                name: a.name || 'Award',
                count: typeof a.count === 'number' ? a.count : 1,
                iconUrl: rawUrl ? String(rawUrl).replace(/&amp;/g, '&') : undefined
              });
            }
          }
          let totalAwards = typeof d.total_awards_received === 'number'
            ? d.total_awards_received
            : awardsList.reduce((sum, a) => sum + a.count, 0);

          if (totalAwards === 0 && typeof d.gilded === 'number' && d.gilded > 0) {
            totalAwards = d.gilded;
            if (awardsList.length === 0) {
              awardsList.push({ name: 'Gold', count: d.gilded });
            }
          }

          if (totalAwards === 0 && d.gildings && typeof d.gildings === 'object') {
            let gildingSum = 0;
            for (const [gid, count] of Object.entries(d.gildings)) {
              if (typeof count === 'number' && count > 0) {
                gildingSum += count;
                const gName = gid === 'gid_1' ? 'Silver' : gid === 'gid_2' ? 'Gold' : gid === 'gid_3' ? 'Platinum' : 'Award';
                awardsList.push({ name: gName, count });
              }
            }
            if (gildingSum > 0) {
              totalAwards = gildingSum;
            }
          }

          if (totalAwards === 0) {
            const directAwards = typeof d.awards_count === 'number' ? d.awards_count : (typeof d.award_count === 'number' ? d.award_count : 0);
            if (directAwards > 0) {
              totalAwards = directAwards;
              if (awardsList.length === 0) {
                awardsList.push({ name: 'Reddit Award', count: directAwards });
              }
            }
          }
          totalAwards = Math.max(totalAwards, awardsList.reduce((sum, a) => sum + a.count, 0));

          const curPostId = typeof window !== 'undefined' ? window.location?.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1] : null;
          const permalink = d.permalink
            ? (d.permalink.startsWith('http') ? d.permalink : `https://www.reddit.com${d.permalink}`)
            : (typeof window !== 'undefined'
                ? (curPostId
                    ? `${window.location?.origin || 'https://www.reddit.com'}/comments/${curPostId}/_/${cleanId}/`
                    : `${window.location?.origin || 'https://www.reddit.com'}${window.location?.pathname.replace(/\/+$/, '')}/_/${cleanId}/`)
                : '');

          const parentId = d.parent_id && d.parent_id.startsWith('t1_') ? d.parent_id : null;

          comments.push({
            id: `t1_${cleanId}`,
            redditId: cleanId,
            parentId,
            author,
            body,
            score: typeof d.score === 'number' ? d.score : parseRedditScore(d.score),
            repliesCount: 0,
            depth: typeof d.depth === 'number' ? d.depth : 0,
            createdUtc,
            createdRelative: formatRelativeTime(createdUtc),
            timestampDisplay,
            awardsDataAvailable: true,
            awardsCount: totalAwards,
            awardsData: awardsList,
            permalink,
            isOp: Boolean(
              d.is_submitter ||
              (postAuthor && author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]')
            )
          });
        }
      }
    }
  }

  return { comments, deletedOrRemovedCount };
}

/** Fetches a batch of truncated comment IDs via /api/morechildren */
export async function fetchMoreChildrenBatch(
  postId: string,
  ids: string[],
  signal?: AbortSignal
): Promise<{ things: any[]; newMoreIds: string[] } | null> {
  if (ids.length === 0) return null;
  const idsParam = ids.join(',');

  const body = new URLSearchParams({
    api_type: 'json',
    link_id: `t3_${postId}`,
    children: idsParam
  }).toString();

  const data = await safeFetchJson('/api/morechildren', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body,
    signal
  });

  const things = data?.json?.data?.things;
  if (Array.isArray(things)) {
    const newMoreIds: string[] = [];
    for (const item of things) {
      if (item.kind === 'more' && item.data && Array.isArray(item.data.children)) {
        for (const cid of item.data.children) {
          if (cid && typeof cid === 'string') {
            newMoreIds.push(cid);
          }
        }
      }
    }
    return { things, newMoreIds };
  }

  return null;
}

export class RedditPageAdapter {
  /** Detect whether current window location is an active Reddit thread */
  static isRedditThread(): boolean {
    const path = window.location.pathname;
    return /\/comments\/[a-z0-9]+/i.test(path);
  }

  /** Extract thread post ID */
  static getPostId(): string | null {
    const match = window.location.pathname.match(/\/comments\/([a-z0-9]+)/i);
    return match ? match[1] : null;
  }

  /** Extract post metadata from page DOM using fallback cascades */
  static extractPost(): ExtractedPost {
    const postId = this.getPostId() || 'unknown';
    const currentUrl = window.location.href;

    // 1. Shreddit Modern Reddit
    const shredditPost = document.querySelector('shreddit-post');
    if (shredditPost) {
      const title =
        shredditPost.getAttribute('post-title') ||
        shredditPost.querySelector('[slot="title"]')?.textContent?.trim() ||
        document.title.replace(/ : r\/.*$/, '').replace(/ - Reddit$/, '');
      const author = shredditPost.getAttribute('author') || '[deleted]';
      const subreddit = (shredditPost.getAttribute('subreddit-prefixed-name') || '').replace(/^r\//, '');
      const score = parseRedditScore(shredditPost.getAttribute('score'));
      const permalink = shredditPost.getAttribute('permalink') || window.location.pathname;
      const textBodyEl = shredditPost.querySelector('[slot="text-body"]');
      const selftext = textBodyEl?.textContent?.trim() || '';
      const commentCountAttr = shredditPost.getAttribute('comment-count');
      let commentCount = commentCountAttr ? parseInt(commentCountAttr, 10) : null;

      // Modern Reddit button fallback badge (e.g. 101 comments badge)
      if (!commentCount || isNaN(commentCount)) {
        const commentButton = shredditPost.querySelector(
          '[noun="comment"], [data-testid="post-comment-header"], button[aria-label*="comment"], a[href*="/comments/"] span'
        );
        const match = commentButton?.textContent?.match(/([\d,]+)/);
        if (match) {
          commentCount = parseInt(match[1].replace(/,/g, ''), 10);
        }
      }

      const timestamp = extractTimestampFromElement(shredditPost);

      return {
        id: postId,
        url: currentUrl,
        title: title || document.title,
        author,
        subreddit,
        selftext,
        score,
        upvoteRatio: parseFloat(shredditPost.getAttribute('upvote-ratio') || '1.0'),
        createdUtc: timestamp.utc,
        createdRelative: timestamp.relativeText,
        timestampDisplay: timestamp.displayText,
        commentCount,
        permalink: permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`
      };
    }

    // 2. Classic New Reddit
    const postContainer = document.querySelector('div[data-testid="post-container"]');
    if (postContainer) {
      const titleEl = postContainer.querySelector('h1, h2');
      const authorEl = postContainer.querySelector('a[data-testid="post_author_link"]');
      const scoreEl = postContainer.querySelector('div[id*="vote-arrows"] div');
      const bodyEl = postContainer.querySelector('div[data-click-id="text"]');
      const timestamp = extractTimestampFromElement(postContainer);

      let commentCount: number | null = null;
      const commentCountEl = postContainer.querySelector('a[data-testid="comments-page-link-num-comments"], div[data-click-id="comments"]');
      if (commentCountEl) {
        const match = commentCountEl.textContent?.match(/([\d,]+)\s*comments?/i);
        if (match) {
          commentCount = parseInt(match[1].replace(/,/g, ''), 10);
        }
      }

      return {
        id: postId,
        url: currentUrl,
        title: titleEl?.textContent?.trim() || document.title,
        author: authorEl?.textContent?.replace(/^u\//, '').trim() || '[deleted]',
        subreddit: window.location.pathname.split('/')[2] || '',
        selftext: bodyEl?.textContent?.trim() || '',
        score: parseRedditScore(scoreEl?.textContent),
        upvoteRatio: 1.0,
        createdUtc: timestamp.utc,
        createdRelative: timestamp.relativeText,
        timestampDisplay: timestamp.displayText,
        commentCount,
        permalink: currentUrl
      };
    }

    // 3. Old Reddit Fallback
    const oldTitle = document.querySelector('p.title a.title')?.textContent?.trim() || document.title;
    const oldAuthor = document.querySelector('p.tagline a.author')?.textContent?.trim() || '[deleted]';
    const oldBody = document.querySelector('div.usertext-body')?.textContent?.trim() || '';
    const oldScore = parseRedditScore(document.querySelector('div.score.unvoted')?.textContent);
    const postEl = document.querySelector('div.thing.link') || document.body;
    const timestamp = extractTimestampFromElement(postEl);

    let oldCommentCount: number | null = null;
    const oldCommentCountEl = document.querySelector('a.comments');
    if (oldCommentCountEl) {
      const match = oldCommentCountEl.textContent?.match(/([\d,]+)\s*comments?/i);
      if (match) {
        oldCommentCount = parseInt(match[1].replace(/,/g, ''), 10);
      }
    }

    return {
      id: postId,
      url: currentUrl,
      title: oldTitle,
      author: oldAuthor,
      subreddit: window.location.pathname.split('/')[2] || '',
      selftext: oldBody,
      score: oldScore,
      upvoteRatio: 1.0,
      createdUtc: timestamp.utc,
      createdRelative: timestamp.relativeText,
      timestampDisplay: timestamp.displayText,
      commentCount: oldCommentCount,
      permalink: currentUrl
    };
  }

  /** Extract all currently accessible comments in the DOM with tree hierarchy */
  static extractComments(postAuthor: string): {
    comments: ExtractedComment[];
    unexpandedCount: number;
    deletedOrRemovedCount: number;
  } {
    const comments: ExtractedComment[] = [];
    const seenIds = new Set<string>();
    let deletedOrRemovedCount = 0;

    // 1. Shreddit Modern Reddit (pierces shadow roots)
    const shredditComments = querySelectorAllDeep('shreddit-comment');
    if (shredditComments.length > 0) {
      for (const el of shredditComments) {
        const rawThingId = el.getAttribute('thingid') || el.getAttribute('thing-id') || el.getAttribute('data-comment-id') || el.getAttribute('data-fullname') || el.id;
        let cleanId = (rawThingId || '').replace(/^t1_/, '');
        if (!cleanId) {
          const permalinkAttr = el.getAttribute('permalink');
          const m = permalinkAttr?.match(/\/comments\/[^\/]+\/[^\/]+\/([a-z0-9]+)/i);
          if (m) cleanId = m[1];
        }
        if (!cleanId || seenIds.has(cleanId)) continue;
        seenIds.add(cleanId);

        const author = el.getAttribute('author') || '[deleted]';
        const scoreAttr = el.getAttribute('score');
        let score = 0;
        if (scoreAttr !== null && scoreAttr !== undefined && scoreAttr.trim() !== '') {
          score = parseRedditScore(scoreAttr);
        } else {
          // Check child score elements inside shreddit-comment (slotted score, faceplate-number, testid)
          const scoreEl = el.querySelector('[slot="score"], faceplate-number[number], span[data-testid="comment-score"]');
          if (scoreEl) {
            const rawScore = scoreEl.getAttribute('number') || scoreEl.getAttribute('score') || scoreEl.textContent;
            score = parseRedditScore(rawScore);
          } else {
            const actionRow = el.querySelector('shreddit-comment-action-row');
            const rowScore = actionRow?.getAttribute('score');
            if (rowScore !== null && rowScore !== undefined) {
              score = parseRedditScore(rowScore);
            }
          }
        }
        let depth = parseInt(el.getAttribute('depth') || '-1', 10);
        if (isNaN(depth) || depth < 0) {
          let d = 0;
          let p = el.parentElement;
          while (p) {
            if (p.tagName && p.tagName.toLowerCase() === 'shreddit-comment') {
              d++;
            }
            p = p.parentElement;
          }
          depth = d;
        }
        const permalink = el.getAttribute('permalink') || '';
        let parentId = el.getAttribute('parentid') || null;
        if (!parentId) {
          const parentEl = el.parentElement?.closest('shreddit-comment');
          if (parentEl) {
            parentId = parentEl.getAttribute('thingid') || parentEl.id;
          }
        }

        // Extract body text cleanly
        const contentEl = el.querySelector('[slot="comment"]') || el.querySelector('div[id*="-post-rtjson-content"]');
        let body = contentEl?.textContent?.trim() || '';
        if (!body) {
          const paragraphs = Array.from(el.querySelectorAll('p')).map(p => p.textContent?.trim()).filter(Boolean);
          body = paragraphs.join('\n\n');
        }

        if (!body || body === '[deleted]' || body === '[removed]') {
          deletedOrRemovedCount++;
          continue;
        }

        const timestamp = extractTimestampFromElement(el);
        const awards = extractAwardsFromElement(el);

        comments.push({
          id: `t1_${cleanId}`,
          redditId: cleanId,
          parentId: parentId ? (parentId.startsWith('t1_') ? parentId : `t1_${parentId.replace(/^t1_/, '')}`) : null,
          author,
          body,
          score,
          repliesCount: 0, // Computed below
          depth,
          createdUtc: timestamp.utc,
          createdRelative: timestamp.relativeText,
          timestampDisplay: timestamp.displayText,
          awardsDataAvailable: awards.dataAvailable,
          awardsCount: awards.totalCount,
          awardsData: awards.awards,
          permalink: permalink.startsWith('http')
            ? permalink
            : (permalink
                ? `https://www.reddit.com${permalink}`
                : (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/_/${cleanId}/` : '')),
          isOp: author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]'
        });
      }
    }

    // 2. Classic New Reddit fallback
    if (comments.length === 0) {
      const newRedditComments = Array.from(document.querySelectorAll('div[data-testid="comment"]'));
      for (let idx = 0; idx < newRedditComments.length; idx++) {
        const el = newRedditComments[idx];
        const authorEl = el.querySelector('a[data-testid="comment_author_link"], a[href*="/user/"]');
        const author = authorEl?.textContent?.replace(/^u\//, '').trim() || '[deleted]';
        const scoreEl = el.querySelector('div[id*="vote-arrows"] div, span[data-testid="comment-score"]');
        const score = parseRedditScore(scoreEl?.textContent);
        const paragraphs = Array.from(el.querySelectorAll('p')).map(p => p.textContent?.trim()).filter(Boolean);
        const body = paragraphs.join('\n\n');

        if (!body || body === '[deleted]' || body === '[removed]') {
          deletedOrRemovedCount++;
          continue;
        }

        let depth = 0;
        let p = el.parentElement;
        let parentCommentId: string | null = null;
        while (p) {
          if (p.matches?.('div[data-testid="comment"]')) {
            depth++;
            if (!parentCommentId) {
              parentCommentId = p.id ? (p.id.startsWith('t1_') ? p.id : `t1_${p.id}`) : null;
            }
          }
          p = p.parentElement;
        }

        // Extract real comment ID from element attributes or timestamp anchor
        const rawAttrId = el.getAttribute('data-comment-id') || el.getAttribute('data-fullname') || el.id || el.closest('.Comment')?.id;
        const timeAnchor = el.querySelector('a[data-testid="comment_timestamp"], a[data-click-id="timestamp"], a[href*="/comments/"]');
        const anchorHref = timeAnchor?.getAttribute('href') || '';
        const hrefMatch = anchorHref.match(/\/comments\/[a-z0-9]+\/[^\/]+\/([a-z0-9]+)/i);
        const resolvedId = (rawAttrId || '').replace(/^t1_/, '').replace(/^comment-t1_/, '') || hrefMatch?.[1] || `c_${idx + 1}`;
        const id = resolvedId;
        const timestamp = extractTimestampFromElement(el);
        const awards = extractAwardsFromElement(el);

        comments.push({
          id: `t1_${id}`,
          redditId: id,
          parentId: parentCommentId,
          author,
          body,
          score,
          repliesCount: 0,
          depth,
          createdUtc: timestamp.utc,
          createdRelative: timestamp.relativeText,
          timestampDisplay: timestamp.displayText,
          awardsDataAvailable: awards.dataAvailable,
          awardsCount: awards.totalCount,
          awardsData: awards.awards,
          permalink: typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/_/${id}/` : '',
          isOp: author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]'
        });
      }
    }

    // 3. Old Reddit fallback
    if (comments.length === 0) {
      const oldComments = Array.from(document.querySelectorAll('div.thing.comment'));
      for (const el of oldComments) {
        const rawId = el.getAttribute('data-fullname') || el.id;
        const cleanId = (rawId || '').replace(/^t1_/, '');
        const author = el.querySelector('a.author')?.textContent?.trim() || '[deleted]';
        const scoreEl = el.querySelector('span.score.unvoted, span.score, span.dislikes');
        const score = parseRedditScore(scoreEl?.textContent);
        const body = el.querySelector('div.usertext-body')?.textContent?.trim() || '';

        if (!body || body === '[deleted]' || body === '[removed]') {
          deletedOrRemovedCount++;
          continue;
        }

        let depth = 0;
        let p = el.parentElement;
        let parentCommentId: string | null = null;
        while (p) {
          if (p.matches?.('div.thing.comment')) {
            depth++;
            if (!parentCommentId) {
              const pRaw = p.getAttribute('data-fullname') || p.id;
              if (pRaw) {
                parentCommentId = pRaw.startsWith('t1_') ? pRaw : `t1_${pRaw}`;
              }
            }
          }
          p = p.parentElement;
        }

        const timestamp = extractTimestampFromElement(el);
        const awards = extractAwardsFromElement(el);

        comments.push({
          id: `t1_${cleanId}`,
          redditId: cleanId,
          parentId: parentCommentId,
          author,
          body,
          score,
          repliesCount: 0,
          depth,
          createdUtc: timestamp.utc,
          createdRelative: timestamp.relativeText,
          timestampDisplay: timestamp.displayText,
          awardsDataAvailable: awards.dataAvailable,
          awardsCount: awards.totalCount,
          awardsData: awards.awards,
          permalink: typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/_/${cleanId}/` : '',
          isOp: author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]'
        });
      }
    }

    // Count explicit deleted nodes (only true deleted/removed comment placeholders, not active comments by deleted users)
    const explicitDeleted = document.querySelectorAll(
      'shreddit-comment[is-deleted], shreddit-comment[collapsed-because-deleted], [data-testid="comment"][data-is-deleted="true"], div.thing.comment.deleted'
    );
    deletedOrRemovedCount = Math.max(deletedOrRemovedCount, explicitDeleted.length);

    // Recompute repliesCount based on parent relationships
    const childrenCountMap = new Map<string, number>();
    for (const c of comments) {
      if (c.parentId) {
        childrenCountMap.set(c.parentId, (childrenCountMap.get(c.parentId) || 0) + 1);
      }
    }
    for (const c of comments) {
      c.repliesCount = childrenCountMap.get(c.id) || 0;
    }

    // Detect unexpanded/more comments controls in the DOM
    const unexpandedElements = this.getExpandableControls();
    const unexpandedCount = unexpandedElements.length;

    return { comments, unexpandedCount, deletedOrRemovedCount };
  }

  /** Locate all currently unexpanded comment controls in DOM, piercing shadow roots */
  static getExpandableControls(): HTMLElement[] {
    const selectors = [
      'button[id*="more-comments"]:not([data-redditdig-clicked])',
      'button[data-testid="load-more-comments"]:not([data-redditdig-clicked])',
      'button[noun="load_more_comments"]:not([data-redditdig-clicked])',
      'button[noun="view_more_replies"]:not([data-redditdig-clicked])',
      'button[noun="comment_more_replies"]:not([data-redditdig-clicked])',
      'button[noun="comment_fold"]:not([data-redditdig-clicked])',
      'button[slot="more-comments-button"]:not([data-redditdig-clicked])',
      'button[slot="more-replies-button"]:not([data-redditdig-clicked])',
      'faceplate-partial[loading="lazy"] button:not([data-redditdig-clicked])',
      'faceplate-partial[src*="more-comments"] button:not([data-redditdig-clicked])',
      'faceplate-partial[src*="more-replies"] button:not([data-redditdig-clicked])',
      'faceplate-partial[loading="lazy"]:not([data-redditdig-clicked])',
      'shreddit-comment-tree [slot="more"] button:not([data-redditdig-clicked])',
      'shreddit-comment[collapsed] button[aria-expanded="false"]:not([data-redditdig-clicked])',
      'shreddit-comment[collapsed] button:not([data-redditdig-clicked])',
      'button[aria-expanded="false"]:not([data-redditdig-clicked])',
      'button[aria-label*="replies" i]:not([data-redditdig-clicked])',
      'button[aria-label*="more comment" i]:not([data-redditdig-clicked])',
      'span.morecomments a:not([data-redditdig-clicked])',
      'a[data-testid="load-more-comments"]:not([data-redditdig-clicked])'
    ];
    const elements: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    for (const sel of selectors) {
      const found = querySelectorAllDeep(sel);
      for (const el of found) {
        if (!seen.has(el)) {
          seen.add(el);
          elements.push(el);
        }
      }
    }
    return elements;
  }

  /** Safe, progressive dynamic comment acquisition piercing shadow DOM */
  static async expandCommentsSafely(
    postAuthor: string,
    options: ExpandOptions = {}
  ): Promise<{
    comments: ExtractedComment[];
    expansionAttempts: number;
    unexpandedRemaining: number;
    deletedOrRemovedCount: number;
  }> {
    const maxComments = options.maxComments || 500;
    const maxTimeMs = options.maxTimeMs || 25000;
    const maxAttempts = options.maxAttempts || 30;
    const startTime = Date.now();

    let attempts = 0;
    let { comments, unexpandedCount, deletedOrRemovedCount } = this.extractComments(postAuthor);

    options.onProgress?.({
      loadedComments: comments.length,
      step: `Loaded ${comments.length} comments from initial page...`
    });

    while (
      comments.length < maxComments &&
      attempts < maxAttempts &&
      Date.now() - startTime < maxTimeMs &&
      !options.signal?.aborted
    ) {
      // 1. Progressive auto-scroll to trigger viewport lazy loading
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          const scrollTarget = Math.min(
            document.body.scrollHeight,
            (window.scrollY || 0) + window.innerHeight * 2
          );
          window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        } catch {}
      }

      // 2. Uncollapse modern Reddit collapsed comments directly
      const collapsedComments = querySelectorAllDeep('shreddit-comment[collapsed]');
      for (const cc of collapsedComments.slice(0, 8)) {
        cc.removeAttribute('collapsed');
        if ('collapsed' in cc) {
          try { (cc as any).collapsed = false; } catch {}
        }
        const expandBtn = cc.querySelector('button[aria-expanded="false"]');
        if (expandBtn) {
          try { (expandBtn as HTMLButtonElement).click(); } catch {}
        }
      }

      const controls = this.getExpandableControls();
      if (controls.length === 0 && collapsedComments.length === 0) {
        // One final scroll to bottom in case infinite scroll has more
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          const prevHeight = document.body.scrollHeight;
          window.scrollTo(0, prevHeight);
          await new Promise(r => setTimeout(r, 400));
          if (document.body.scrollHeight <= prevHeight) {
            break; // No further expandable elements
          }
        } else {
          break;
        }
      }

      attempts++;
      options.onProgress?.({
        loadedComments: comments.length,
        step: `Expanding thread (${comments.length} loaded, expansion ${attempts}/${maxAttempts})...`
      });

      // 3. Click up to 16 expandable controls or faceplate-partials safely
      const batch = controls.slice(0, 16);
      for (const ctrl of batch) {
        ctrl.setAttribute('data-redditdig-clicked', 'true');
        try {
          if (ctrl.tagName.toLowerCase() === 'faceplate-partial') {
            ctrl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            if (typeof (ctrl as any).load === 'function') {
              (ctrl as any).load();
            }
          } else {
            if (typeof ctrl.scrollIntoView === 'function') {
              ctrl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
            ctrl.click();
            ctrl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
        } catch {}
      }

      // Wait for DOM mutation with timeout
      await new Promise<void>((resolve) => {
        let timer: any = null;
        const observer = new MutationObserver(() => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve();
          }, 350);
        });

        if (typeof document !== 'undefined' && document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }

        setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 1100);
      });

      // Re-extract updated comments
      const updated = this.extractComments(postAuthor);
      comments = updated.comments;
      unexpandedCount = updated.unexpandedCount;
      deletedOrRemovedCount = updated.deletedOrRemovedCount;
    }

    return {
      comments,
      expansionAttempts: attempts,
      unexpandedRemaining: unexpandedCount,
      deletedOrRemovedCount
    };
  }

  /**
   * Pure parser: Converts Reddit discussion JSON into structured ExtractedPost and ExtractedComment arrays.
   * Traverses all recursive comment branches and tracks unexpanded more-stubs.
   */
  static parseRedditJson(
    data: any,
    postId: string,
    postAuthor: string,
    _maxComments: number = 500
  ): {
    post: ExtractedPost;
    comments: ExtractedComment[];
    pendingMoreIds: string[];
    deletedOrRemovedCount: number;
  } | null {
    if (!data || !Array.isArray(data) || data.length < 2) {
      return null;
    }

    const postListing = data[0];
    const postChild = postListing?.data?.children?.[0]?.data;
    if (!postChild) {
      return null;
    }

    const post: ExtractedPost = {
      id: postChild.id || postId,
      url: typeof window !== 'undefined' ? window.location?.href || '' : '',
      title: postChild.title || (typeof document !== 'undefined' ? document.title : ''),
      author: postChild.author || '[deleted]',
      subreddit: postChild.subreddit || '',
      selftext: postChild.selftext || '',
      score: typeof postChild.score === 'number' ? postChild.score : parseRedditScore(postChild.score),
      upvoteRatio: typeof postChild.upvote_ratio === 'number' ? postChild.upvote_ratio : 1.0,
      createdUtc: typeof postChild.created_utc === 'number' ? Math.floor(postChild.created_utc) : null,
      createdRelative: formatRelativeTime(postChild.created_utc || null),
      timestampDisplay: postChild.created_utc
        ? new Date(postChild.created_utc * 1000).toLocaleString()
        : 'Timestamp unavailable',
      commentCount: typeof postChild.num_comments === 'number' ? postChild.num_comments : null,
      permalink: postChild.permalink
        ? (postChild.permalink.startsWith('http') ? postChild.permalink : `https://www.reddit.com${postChild.permalink}`)
        : (typeof window !== 'undefined' ? window.location?.href || '' : '')
    };

    const effectiveAuthor = post.author || postAuthor;
    const comments: ExtractedComment[] = [];
    const seenIds = new Set<string>();
    const pendingMoreIds: string[] = [];
    let deletedOrRemovedCount = 0;

    const traverse = (children: any[], currentDepth: number, parentCommentId: string | null) => {
      if (!Array.isArray(children)) return;
      for (const item of children) {
        if (!item) continue;
        if (item.kind === 't1' && item.data) {
          const d = item.data;
          const cleanId = (d.id || '').replace(/^t1_/, '');
          if (!cleanId || seenIds.has(cleanId)) continue;
          seenIds.add(cleanId);

          const body = (d.body || '').trim();
          const author = d.author || '[deleted]';

          if (!body || body === '[deleted]' || body === '[removed]' || (author === '[deleted]' && !body)) {
            deletedOrRemovedCount++;
          } else {
            const createdUtc = typeof d.created_utc === 'number' ? Math.floor(d.created_utc) : null;
            const timestampDisplay = createdUtc
              ? new Date(createdUtc * 1000).toLocaleString()
              : 'Timestamp unavailable';
            const relativeText = formatRelativeTime(createdUtc);

            const awardsList: Array<{ name: string; count: number; iconUrl?: string }> = [];
            if (Array.isArray(d.all_awardings)) {
              for (const a of d.all_awardings) {
                const rawUrl = a.icon_url || a.resized_icons?.[0]?.url;
                awardsList.push({
                  name: a.name || 'Award',
                  count: typeof a.count === 'number' ? a.count : 1,
                  iconUrl: rawUrl ? String(rawUrl).replace(/&amp;/g, '&') : undefined
                });
              }
            }
            let totalAwards = typeof d.total_awards_received === 'number'
              ? d.total_awards_received
              : awardsList.reduce((sum, a) => sum + a.count, 0);

            if (totalAwards === 0 && typeof d.gilded === 'number' && d.gilded > 0) {
              totalAwards = d.gilded;
              if (awardsList.length === 0) {
                awardsList.push({ name: 'Gold', count: d.gilded });
              }
            }

            if (totalAwards === 0 && d.gildings && typeof d.gildings === 'object') {
              let gildingSum = 0;
              for (const [gid, count] of Object.entries(d.gildings)) {
                if (typeof count === 'number' && count > 0) {
                  gildingSum += count;
                  const gName = gid === 'gid_1' ? 'Silver' : gid === 'gid_2' ? 'Gold' : gid === 'gid_3' ? 'Platinum' : 'Award';
                  awardsList.push({ name: gName, count });
                }
              }
              if (gildingSum > 0) {
                totalAwards = gildingSum;
              }
            }

            if (totalAwards === 0) {
              const directAwards = typeof d.awards_count === 'number' ? d.awards_count : (typeof d.award_count === 'number' ? d.award_count : 0);
              if (directAwards > 0) {
                totalAwards = directAwards;
                if (awardsList.length === 0) {
                  awardsList.push({ name: 'Reddit Award', count: directAwards });
                }
              }
            }
            totalAwards = Math.max(totalAwards, awardsList.reduce((sum, a) => sum + a.count, 0));

            const permalink = d.permalink
              ? (d.permalink.startsWith('http') ? d.permalink : `https://www.reddit.com${d.permalink}`)
              : (post.permalink && post.permalink !== 'https://www.reddit.com'
                  ? `${post.permalink.replace(/\/+$/, '')}/${cleanId}/`
                  : (typeof window !== 'undefined' ? `${window.location?.href?.split('?')[0].replace(/\/+$/, '')}/_/${cleanId}/` : ''));

            const effectiveParentId = d.parent_id && d.parent_id.startsWith('t1_')
              ? d.parent_id
              : (parentCommentId ? (parentCommentId.startsWith('t1_') ? parentCommentId : `t1_${parentCommentId}`) : null);

            const effectiveDepth = typeof d.depth === 'number' ? d.depth : currentDepth;

            comments.push({
              id: `t1_${cleanId}`,
              redditId: cleanId,
              parentId: effectiveParentId,
              author,
              body,
              score: typeof d.score === 'number' ? d.score : parseRedditScore(d.score),
              repliesCount: 0,
              depth: effectiveDepth,
              createdUtc,
              createdRelative: relativeText,
              timestampDisplay,
              awardsDataAvailable: true,
              awardsCount: totalAwards,
              awardsData: awardsList,
              permalink,
              isOp: Boolean(
                d.is_submitter ||
                (effectiveAuthor && author.toLowerCase() === effectiveAuthor.toLowerCase() && author !== '[deleted]')
              )
            });
          }

          if (d.replies && typeof d.replies === 'object' && d.replies.data && Array.isArray(d.replies.data.children)) {
            traverse(d.replies.data.children, currentDepth + 1, `t1_${cleanId}`);
          }
        } else if (item.kind === 'more' && item.data) {
          const moreData = item.data;
          if (Array.isArray(moreData.children)) {
            for (const cid of moreData.children) {
              if (cid && typeof cid === 'string' && !seenIds.has(cid)) {
                pendingMoreIds.push(cid);
              }
            }
          }
        }
      }
    };

    const initialChildren = data[1]?.data?.children || [];
    traverse(initialChildren, 0, null);

    // Recompute repliesCount across parsed tree
    const childrenMap = new Map<string, number>();
    for (const c of comments) {
      if (c.parentId) {
        childrenMap.set(c.parentId, (childrenMap.get(c.parentId) || 0) + 1);
      }
    }
    for (const c of comments) {
      c.repliesCount = childrenMap.get(c.id) || 0;
    }

    return {
      post,
      comments,
      pendingMoreIds,
      deletedOrRemovedCount
    };
  }

  /**
   * Fetches the complete Reddit discussion tree via Reddit's native JSON endpoint.
   * Traverses all comments and expands truncated reply stubs using /api/info.json and /api/morechildren.
   */
  static async fetchThreadJson(
    postId: string,
    postAuthor: string,
    maxComments: number = 500,
    signal?: AbortSignal,
    onProgress?: (step: string) => void
  ): Promise<{
    post: ExtractedPost;
    comments: ExtractedComment[];
    unexpandedCount: number;
    deletedOrRemovedCount: number;
  } | null> {
    if (!postId || postId === 'unknown') return null;

    // Use clean canonical comment thread URL (never append .json to arbitrary single-comment permalink subpaths)
    const jsonUrl = `/comments/${encodeURIComponent(postId)}.json?raw_json=1&limit=${Math.min(Math.max(maxComments, 500), 1000)}&sort=confidence`;

    onProgress?.('Fetching full discussion tree from Reddit API...');
    const data = await safeFetchJson(jsonUrl, { signal });
    const parsed = this.parseRedditJson(data, postId, postAuthor, maxComments);
    if (!parsed) return null;

    const { post, comments } = parsed;
    let deletedOrRemovedCount = parsed.deletedOrRemovedCount;
    const seenIds = new Set(comments.map((c) => c.redditId));
    let pendingMoreIds = [...parsed.pendingMoreIds];

    // Expand truncated more-stubs via /api/info.json (GET) and /api/morechildren (POST)
    if (comments.length < maxComments && pendingMoreIds.length > 0) {
      onProgress?.(`Resolving ${pendingMoreIds.length} truncated comments from Reddit API...`);

      // 1. High-speed, CSRF-free batch retrieval via /api/info.json (handles up to 100 IDs per GET)
      const infoResult = await fetchCommentsByInfoBatch(pendingMoreIds, post.author, signal);
      deletedOrRemovedCount += infoResult.deletedOrRemovedCount;

      for (const ic of infoResult.comments) {
        if (!seenIds.has(ic.redditId) && comments.length < maxComments) {
          seenIds.add(ic.redditId);
          comments.push(ic);
        }
      }

      // Remove successfully fetched IDs from pendingMoreIds
      pendingMoreIds = pendingMoreIds.filter(id => !seenIds.has(id));

      // 2. If any stubs remain or deeper trees need expansion, query /api/morechildren
      let moreAttempts = 0;
      const maxMoreAttempts = 5;

      while (
        comments.length < maxComments &&
        pendingMoreIds.length > 0 &&
        moreAttempts < maxMoreAttempts &&
        !signal?.aborted
      ) {
        moreAttempts++;
        const batch = pendingMoreIds.splice(0, 50);
        onProgress?.(`Expanding nested comment replies (${comments.length} loaded)...`);

        const res = await fetchMoreChildrenBatch(postId, batch, signal);
        if (res && res.things.length > 0) {
          for (const thing of res.things) {
            if (thing.kind === 't1' && thing.data) {
              const d = thing.data;
              const cleanId = (d.id || '').replace(/^t1_/, '');
              if (!cleanId || seenIds.has(cleanId)) continue;
              seenIds.add(cleanId);

              const body = (d.body || '').trim();
              const author = d.author || '[deleted]';

              if (!body || body === '[deleted]' || body === '[removed]' || (author === '[deleted]' && !body)) {
                deletedOrRemovedCount++;
                continue;
              }

              const createdUtc = typeof d.created_utc === 'number' ? Math.floor(d.created_utc) : null;
              const timestampDisplay = createdUtc
                ? new Date(createdUtc * 1000).toLocaleString()
                : 'Timestamp unavailable';

              const awardsList: Array<{ name: string; count: number; iconUrl?: string }> = [];
              if (Array.isArray(d.all_awardings)) {
                for (const a of d.all_awardings) {
                  const rawUrl = a.icon_url || a.resized_icons?.[0]?.url;
                  awardsList.push({
                    name: a.name || 'Award',
                    count: typeof a.count === 'number' ? a.count : 1,
                    iconUrl: rawUrl ? String(rawUrl).replace(/&amp;/g, '&') : undefined
                  });
                }
              }
              let totalAwards = typeof d.total_awards_received === 'number'
                ? d.total_awards_received
                : awardsList.reduce((sum, a) => sum + a.count, 0);

              if (totalAwards === 0 && typeof d.gilded === 'number' && d.gilded > 0) {
                totalAwards = d.gilded;
                if (awardsList.length === 0) {
                  awardsList.push({ name: 'Gold', count: d.gilded });
                }
              }

              if (totalAwards === 0 && d.gildings && typeof d.gildings === 'object') {
                let gildingSum = 0;
                for (const [gid, count] of Object.entries(d.gildings)) {
                  if (typeof count === 'number' && count > 0) {
                    gildingSum += count;
                    const gName = gid === 'gid_1' ? 'Silver' : gid === 'gid_2' ? 'Gold' : gid === 'gid_3' ? 'Platinum' : 'Award';
                    awardsList.push({ name: gName, count });
                  }
                }
                if (gildingSum > 0) {
                  totalAwards = gildingSum;
                }
              }

              if (totalAwards === 0) {
                const directAwards = typeof d.awards_count === 'number' ? d.awards_count : (typeof d.award_count === 'number' ? d.award_count : 0);
                if (directAwards > 0) {
                  totalAwards = directAwards;
                  if (awardsList.length === 0) {
                    awardsList.push({ name: 'Reddit Award', count: directAwards });
                  }
                }
              }
              totalAwards = Math.max(totalAwards, awardsList.reduce((sum, a) => sum + a.count, 0));

              const effectiveParentId = d.parent_id && d.parent_id.startsWith('t1_') ? d.parent_id : null;

              comments.push({
                id: `t1_${cleanId}`,
                redditId: cleanId,
                parentId: effectiveParentId,
                author,
                body,
                score: typeof d.score === 'number' ? d.score : parseRedditScore(d.score),
                repliesCount: 0,
                depth: typeof d.depth === 'number' ? d.depth : 1,
                createdUtc,
                createdRelative: formatRelativeTime(createdUtc),
                timestampDisplay,
                awardsDataAvailable: true,
                awardsCount: totalAwards,
                awardsData: awardsList,
                permalink: d.permalink
                  ? (d.permalink.startsWith('http') ? d.permalink : `https://www.reddit.com${d.permalink}`)
                  : (post.permalink && post.permalink !== 'https://www.reddit.com'
                      ? `${post.permalink.replace(/\/+$/, '')}/${cleanId}/`
                      : (typeof window !== 'undefined' ? `${window.location?.href?.split('?')[0].replace(/\/+$/, '')}/_/${cleanId}/` : '')),
                isOp: Boolean(
                  d.is_submitter ||
                  (post.author && author.toLowerCase() === post.author.toLowerCase() && author !== '[deleted]')
                )
              });
            }
          }

          // Queue any new deeper more-stubs
          for (const newId of res.newMoreIds) {
            if (!seenIds.has(newId) && !pendingMoreIds.includes(newId)) {
              pendingMoreIds.push(newId);
            }
          }
        } else {
          break;
        }
      }
    }

    // Recompute depths and repliesCount across complete unified tree
    const commentMap = new Map<string, ExtractedComment>();
    for (const c of comments) {
      commentMap.set(c.id, c);
    }
    for (const c of comments) {
      if (c.parentId) {
        let depth = 0;
        let curr = commentMap.get(c.parentId);
        while (curr && depth < 20) {
          depth++;
          curr = curr.parentId ? commentMap.get(curr.parentId) : undefined;
        }
        c.depth = depth;
      }
    }
    const childrenMap = new Map<string, number>();
    for (const c of comments) {
      if (c.parentId) {
        childrenMap.set(c.parentId, (childrenMap.get(c.parentId) || 0) + 1);
      }
    }
    for (const c of comments) {
      c.repliesCount = childrenMap.get(c.id) || 0;
    }

    return {
      post,
      comments,
      unexpandedCount: pendingMoreIds.length,
      deletedOrRemovedCount
    };
  }

  /** Complete thread extraction package: Multi-tier acquisition with truthful coverage */
  static async extractCompleteThread(
    maxComments: number = 500,
    options: ExpandOptions = {}
  ): Promise<ExtractionResult> {
    const domPost = this.extractPost();
    const postId = this.getPostId() || domPost.id;

    options.onProgress?.({
      loadedComments: 0,
      step: 'Reading discussion from Reddit...'
    });

    // Tier 1: Reddit Native JSON API (retrieves all comments directly)
    let jsonResult: {
      post: ExtractedPost;
      comments: ExtractedComment[];
      unexpandedCount: number;
      deletedOrRemovedCount: number;
    } | null = null;

    if (postId && postId !== 'unknown') {
      try {
        jsonResult = await this.fetchThreadJson(
          postId,
          domPost.author,
          maxComments,
          options.signal,
          (step) => {
            options.onProgress?.({ loadedComments: 0, step });
          }
        );
      } catch (err) {
        console.warn('RedditDIG: JSON fetch error, falling back to DOM extraction:', err);
      }
    }

    let finalPost: ExtractedPost = domPost;
    let allComments: ExtractedComment[] = [];
    let unexpandedRemaining = 0;
    let deletedOrRemovedCount = 0;
    let expansionAttempts = 0;

    if (jsonResult && jsonResult.comments.length > 0) {
      finalPost = {
        ...domPost,
        ...jsonResult.post,
        title: domPost.title && domPost.title !== 'Reddit' ? domPost.title : jsonResult.post.title,
        commentCount: jsonResult.post.commentCount || domPost.commentCount
      };
      allComments = jsonResult.comments;
      deletedOrRemovedCount = jsonResult.deletedOrRemovedCount;
      unexpandedRemaining = jsonResult.unexpandedCount;

      // Tier 2: Merge any comments currently rendered in the DOM
      const domData = this.extractComments(finalPost.author);
      const seenIds = new Set(allComments.map((c) => c.redditId));
      const commentMap = new Map(allComments.map(c => [c.redditId, c]));

      for (const dc of domData.comments) {
        if (!seenIds.has(dc.redditId)) {
          seenIds.add(dc.redditId);
          allComments.push(dc);
          commentMap.set(dc.redditId, dc);
        } else {
          // Merge DOM award data into existing JSON comment
          const existing = commentMap.get(dc.redditId);
          if (existing) {
            existing.awardsDataAvailable = existing.awardsDataAvailable || dc.awardsDataAvailable;
            const domCount = dc.awardsCount ?? (dc.awardsData?.reduce((s, a) => s + (a.count || 1), 0) || 0);
            const existingCount = existing.awardsCount ?? (existing.awardsData?.reduce((s, a) => s + (a.count || 1), 0) || 0);
            if (domCount > existingCount) {
              existing.awardsCount = domCount;
              if (dc.awardsData && dc.awardsData.length > 0) {
                existing.awardsData = dc.awardsData;
              }
            } else if (existingCount === 0 && domCount === 0 && dc.awardsDataAvailable) {
              existing.awardsDataAvailable = true;
              existing.awardsCount = 0;
            }
          }
        }
      }
      deletedOrRemovedCount = Math.max(deletedOrRemovedCount, domData.deletedOrRemovedCount);

      // If comments remain unexpanded and we have not hit maxComments or total reported, run progressive DOM expansion
      const totalReported = finalPost.commentCount || null;
      if (
        totalReported &&
        (allComments.length + deletedOrRemovedCount) < totalReported &&
        allComments.length < maxComments &&
        this.getExpandableControls().length > 0
      ) {
        const domExpanded = await this.expandCommentsSafely(finalPost.author, {
          ...options,
          maxComments
        });
        for (const ec of domExpanded.comments) {
          if (!seenIds.has(ec.redditId)) {
            seenIds.add(ec.redditId);
            allComments.push(ec);
            commentMap.set(ec.redditId, ec);
          } else {
            const existing = commentMap.get(ec.redditId);
            if (existing) {
              existing.awardsDataAvailable = existing.awardsDataAvailable || ec.awardsDataAvailable;
              const expCount = ec.awardsCount ?? (ec.awardsData?.reduce((s, a) => s + (a.count || 1), 0) || 0);
              const curCount = existing.awardsCount ?? (existing.awardsData?.reduce((s, a) => s + (a.count || 1), 0) || 0);
              if (expCount > curCount) {
                existing.awardsCount = expCount;
                if (ec.awardsData && ec.awardsData.length > 0) {
                  existing.awardsData = ec.awardsData;
                }
              }
            }
          }
        }
        deletedOrRemovedCount = Math.max(deletedOrRemovedCount, domExpanded.deletedOrRemovedCount);
        unexpandedRemaining = domExpanded.unexpandedRemaining;
        expansionAttempts = domExpanded.expansionAttempts;
      }
    } else {
      // Fallback: Safe progressive DOM expansion
      const domExpanded = await this.expandCommentsSafely(domPost.author, {
        ...options,
        maxComments
      });
      allComments = domExpanded.comments;
      expansionAttempts = domExpanded.expansionAttempts;
      unexpandedRemaining = domExpanded.unexpandedRemaining;
      deletedOrRemovedCount = domExpanded.deletedOrRemovedCount;
    }

    // Ensure all comments reflect thread-wide awards capability when running on an awards-capable platform/API
    const threadSupportsAwards = isAwardsSupportedOnPage() ||
      jsonResult !== null ||
      allComments.some(c => c.awardsDataAvailable);

    if (threadSupportsAwards) {
      for (const c of allComments) {
        c.awardsDataAvailable = true;
        if (c.awardsCount === null || c.awardsCount === undefined) {
          c.awardsCount = c.awardsData?.reduce((s, a) => s + (a.count || 1), 0) || 0;
        }
      }
    }

    const finalComments = allComments.slice(0, maxComments);
    const commentsAnalyzed = finalComments.length;
    const commentsFound = allComments.length;
    const totalReported = finalPost.commentCount || null;

    // Truthful coverage calculation
    const totalAccounted = commentsAnalyzed + deletedOrRemovedCount;
    const commentsUnavailable = totalReported && totalReported > totalAccounted
      ? totalReported - totalAccounted
      : 0;

    const coverageRatio = totalReported && totalReported > 0
      ? Math.min(Math.round(((commentsAnalyzed + deletedOrRemovedCount) / totalReported) * 100), 100)
      : 100;

    const isComplete = commentsUnavailable === 0 || coverageRatio >= 98;

    let explanation = `${commentsAnalyzed.toLocaleString()} comments extracted and analyzed.`;
    let coverageText = `${commentsAnalyzed.toLocaleString()} comments analyzed`;

    if (totalReported && totalReported > 0) {
      if (isComplete) {
        if (deletedOrRemovedCount > 0) {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} readable comments analyzed (${deletedOrRemovedCount} deleted/moderated)`;
          explanation = `All ${commentsAnalyzed} readable comments analyzed (${deletedOrRemovedCount} comments were deleted by author or removed by moderators).`;
        } else {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} reported comments analyzed`;
          explanation = `All ${commentsAnalyzed} reported comments analyzed.`;
        }
      } else {
        coverageText = `${commentsAnalyzed.toLocaleString()} analyzed of ~${totalReported.toLocaleString()} reported comments (${100 - coverageRatio}% unexpanded or unavailable)`;
        explanation = `${commentsAnalyzed} of ${totalReported} reported comments analyzed (~${commentsUnavailable} comments are unexpanded, deleted by author, or filtered by moderation).`;
      }
    } else if (unexpandedRemaining > 0) {
      coverageText += ` (~${unexpandedRemaining * 4} replies remain unexpanded)`;
      explanation = `${commentsAnalyzed} comments analyzed (~${unexpandedRemaining * 4} replies remain unexpanded in page DOM).`;
    }

    const coverage: CoverageInfo = {
      expected_comments: totalReported,
      extracted_comments: commentsFound,
      analyzed_comments: commentsAnalyzed,
      collapsed_comments: unexpandedRemaining,
      removed_or_deleted_comments: deletedOrRemovedCount,
      unavailable_comments: commentsUnavailable,
      coverage_percentage: coverageRatio,
      status: isComplete ? 'complete' : 'partial',
      explanation
    };

    return {
      post: finalPost,
      comments: finalComments,
      totalReportedComments: totalReported,
      commentsFound,
      commentsAnalyzed,
      commentsUnavailable,
      expansionAttempts,
      coverageRatio,
      coverageText,
      coverage
    };
  }

  /** Synchronous initial extraction fallback */
  static extractThreadData(maxComments: number = 500): ExtractionResult {
    const post = this.extractPost();
    const { comments, unexpandedCount, deletedOrRemovedCount } = this.extractComments(post.author);
    const threadSupportsAwards = isAwardsSupportedOnPage() || comments.some(c => c.awardsDataAvailable);
    if (threadSupportsAwards) {
      for (const c of comments) {
        c.awardsDataAvailable = true;
        if (c.awardsCount === null || c.awardsCount === undefined) {
          c.awardsCount = c.awardsData?.reduce((s, a) => s + (a.count || 1), 0) || 0;
        }
      }
    }
    const finalComments = comments.slice(0, maxComments);
    const commentsAnalyzed = finalComments.length;
    const totalReported = post.commentCount || null;

    const totalAccounted = commentsAnalyzed + deletedOrRemovedCount;
    const commentsUnavailable = totalReported && totalReported > totalAccounted
      ? totalReported - totalAccounted
      : 0;

    const coverageRatio = totalReported && totalReported > 0
      ? Math.min(Math.round(((commentsAnalyzed + deletedOrRemovedCount) / totalReported) * 100), 100)
      : 100;

    const isComplete = commentsUnavailable === 0 || coverageRatio >= 98;

    let coverageText = `${commentsAnalyzed} comments extracted from initial DOM state`;
    let explanation = `${commentsAnalyzed} comments extracted from initial DOM state.`;

    if (totalReported && totalReported > 0) {
      if (isComplete) {
        if (deletedOrRemovedCount > 0) {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} readable comments analyzed (${deletedOrRemovedCount} deleted/moderated)`;
          explanation = `All ${commentsAnalyzed} readable comments analyzed (${deletedOrRemovedCount} comments were deleted by author or removed by moderators).`;
        } else {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} reported comments analyzed`;
          explanation = `All ${commentsAnalyzed} reported comments analyzed.`;
        }
      } else {
        coverageText = `${commentsAnalyzed.toLocaleString()} of ${totalReported.toLocaleString()} comments analyzed`;
        if (commentsUnavailable > 0) {
          coverageText += ` (${commentsUnavailable.toLocaleString()} comments currently unavailable)`;
          explanation = `${commentsAnalyzed} of ${totalReported} reported comments analyzed (~${commentsUnavailable} unexpanded or removed).`;
        }
      }
    }

    const coverage: CoverageInfo = {
      expected_comments: totalReported,
      extracted_comments: comments.length,
      analyzed_comments: commentsAnalyzed,
      collapsed_comments: unexpandedCount,
      removed_or_deleted_comments: deletedOrRemovedCount,
      unavailable_comments: commentsUnavailable,
      coverage_percentage: coverageRatio,
      status: isComplete ? 'complete' : 'partial',
      explanation
    };

    return {
      post,
      comments: finalComments,
      totalReportedComments: totalReported,
      commentsFound: comments.length,
      commentsAnalyzed,
      commentsUnavailable,
      expansionAttempts: 0,
      coverageRatio,
      coverageText,
      coverage
    };
  }

  /** Locate comment in DOM, uncollapse any collapsed parents, and smoothly highlight with pulse animation (pierces shadow roots) */
  static scrollToAndHighlight(commentId: string): boolean {
    if (!commentId || typeof commentId !== 'string') return false;
    const cleanId = commentId.replace(/^t1_/, '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanId) return false;

    // Comprehensive selector list for modern shreddit, classic new Reddit, old Reddit, and inner link anchors
    const selectors = [
      `shreddit-comment[thingid="t1_${cleanId}"]`,
      `shreddit-comment[thingid="${cleanId}"]`,
      `shreddit-comment[thing-id="t1_${cleanId}"]`,
      `shreddit-comment[thing-id="${cleanId}"]`,
      `shreddit-comment[id="t1_${cleanId}"]`,
      `shreddit-comment[id="${cleanId}"]`,
      `shreddit-comment[id="comment-${cleanId}"]`,
      `shreddit-comment[id*="${cleanId}"]`,
      `shreddit-comment[data-fullname="t1_${cleanId}"]`,
      `shreddit-comment[data-comment-id="${cleanId}"]`,
      `shreddit-comment[permalink*="${cleanId}"]`,
      `#t1_${cleanId}`,
      `#${cleanId}`,
      `[id="comment-${cleanId}"]`,
      `[id*="${cleanId}"]`,
      `[data-fullname="t1_${cleanId}"]`,
      `[data-comment-id="${cleanId}"]`,
      `[data-comment-id="t1_${cleanId}"]`,
      `[data-thing-id="t1_${cleanId}"]`,
      `[data-thing-id="${cleanId}"]`,
      `[data-testid="comment"][id*="${cleanId}"]`,
      `[data-testid="comment"][data-comment-id*="${cleanId}"]`,
      `div.thing.comment[data-fullname="t1_${cleanId}"]`,
      `a[name="${cleanId}"]`,
      `a[name="t1_${cleanId}"]`,
      `a[id="${cleanId}"]`,
      `a[href*="/comments/"][href*="${cleanId}"]`
    ];

    for (const selector of selectors) {
      try {
        const found = querySelectorAllDeep(selector);
        if (found && found.length > 0) {
          const el = found[0];
          // If a child anchor or nested element was matched, resolve its enclosing comment container piercing shadow boundaries
          let targetEl: HTMLElement | null = (el.closest?.(
            'shreddit-comment, div[data-testid="comment"], div.thing.comment, [role="article"]'
          ) as HTMLElement) || null;

          if (!targetEl) {
            let n: Node | null = el;
            while (n && n !== document.body) {
              if (n instanceof HTMLElement && n.matches?.('shreddit-comment, div[data-testid="comment"], div.thing.comment, [role="article"]')) {
                targetEl = n;
                break;
              }
              if ((n as ShadowRoot).host) {
                n = (n as ShadowRoot).host;
              } else {
                n = n.parentNode;
              }
            }
          }
          if (!targetEl) targetEl = el;

          this._applyHighlight(targetEl);
          return true;
        }
      } catch {}
    }

    return false;
  }

  private static _uncollapseAncestors(el: HTMLElement) {
    const ancestors: HTMLElement[] = [];
    let curr: Node | null = el.parentElement || el.parentNode;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (curr instanceof HTMLElement) {
        ancestors.unshift(curr);
      }
      if ((curr as ShadowRoot).host) {
        curr = (curr as ShadowRoot).host;
      } else if (curr.parentElement) {
        curr = curr.parentElement;
      } else if (curr.parentNode) {
        curr = curr.parentNode;
      } else {
        break;
      }
    }

    for (const a of ancestors) {
      if (a.tagName && a.tagName.toLowerCase() === 'shreddit-comment') {
        if (a.hasAttribute('collapsed') || (a as any).collapsed) {
          a.removeAttribute('collapsed');
          try { (a as any).collapsed = false; } catch {}
          try { a.setAttribute('aria-expanded', 'true'); } catch {}
          const expandBtn = a.querySelector('button[aria-expanded="false"], button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]') ||
            a.shadowRoot?.querySelector('button[aria-expanded="false"], button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]');
          if (expandBtn) (expandBtn as HTMLElement).click();
        }
      }
      if (a.tagName?.toLowerCase() === 'details' && !(a as HTMLDetailsElement).open) {
        (a as HTMLDetailsElement).open = true;
      }
      if (a.classList?.contains('collapsed')) {
        a.classList.remove('collapsed');
        const expandLink = a.querySelector('a.expand, button.expand') as HTMLElement;
        if (expandLink) expandLink.click();
      }
      if (a.hasAttribute('collapsed')) {
        a.removeAttribute('collapsed');
      }
      const ariaBtn = a.querySelector(':scope > button[aria-expanded="false"], :scope > div > button[aria-expanded="false"]') as HTMLElement;
      if (ariaBtn) ariaBtn.click();
    }

    if (el.tagName && el.tagName.toLowerCase() === 'shreddit-comment') {
      if (el.hasAttribute('collapsed') || (el as any).collapsed) {
        el.removeAttribute('collapsed');
        try { (el as any).collapsed = false; } catch {}
        try { el.setAttribute('aria-expanded', 'true'); } catch {}
        const expandBtn = el.querySelector('button[aria-expanded="false"], button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]') ||
          el.shadowRoot?.querySelector('button[aria-expanded="false"], button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]');
        if (expandBtn) (expandBtn as HTMLElement).click();
      }
    } else if (el.classList?.contains('collapsed')) {
      el.classList.remove('collapsed');
      const expandLink = el.querySelector('a.expand, button.expand') as HTMLElement;
      if (expandLink) expandLink.click();
    }
  }

  private static _applyHighlight(el: HTMLElement) {
    this._uncollapseAncestors(el);

    const doScroll = () => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        try { el.scrollIntoView(); } catch {}
      }
    };

    doScroll();
    // Layout-shift compensation: browser needs time to reflow uncollapsed parent elements
    setTimeout(doScroll, 80);
    setTimeout(doScroll, 250);
    setTimeout(doScroll, 500);

    if (typeof document !== 'undefined' && !document.getElementById('redditdig-highlight-styles')) {
      try {
        const style = document.createElement('style');
        style.id = 'redditdig-highlight-styles';
        style.textContent = `
          @keyframes redditdigPulse {
            0% { outline: 3px solid #ff4500; box-shadow: 0 0 16px rgba(255, 69, 0, 0.7); background-color: rgba(255, 69, 0, 0.12); }
            50% { outline: 3px solid #ff6a00; box-shadow: 0 0 24px rgba(255, 106, 0, 0.85); background-color: rgba(255, 106, 0, 0.22); }
            100% { outline: 3px solid transparent; box-shadow: none; background-color: transparent; }
          }
          .redditdig-highlight {
            animation: redditdigPulse 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards !important;
            transition: all 0.3s ease !important;
            border-radius: 8px !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      } catch {}
    }

    const originalOutline = el.style.outline;
    const originalBoxShadow = el.style.boxShadow;
    const originalBg = el.style.backgroundColor;
    const originalTransition = el.style.transition;
    const originalRadius = el.style.borderRadius;

    el.style.transition = 'all 0.4s ease';
    el.style.outline = '3px solid #ff4500';
    el.style.boxShadow = '0 0 20px rgba(255, 69, 0, 0.7)';
    el.style.backgroundColor = 'rgba(255, 69, 0, 0.12)';
    el.style.borderRadius = '8px';

    el.classList.add('redditdig-highlight');

    setTimeout(() => {
      el.classList.remove('redditdig-highlight');
      el.style.outline = originalOutline;
      el.style.boxShadow = originalBoxShadow;
      el.style.backgroundColor = originalBg;
      el.style.transition = originalTransition;
      el.style.borderRadius = originalRadius;
    }, 3500);
  }
}
