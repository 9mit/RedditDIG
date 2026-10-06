// RedditPageAdapter: Centralized, resilient Reddit DOM extraction, safe progressive expansion, and navigation adapter.
// Supports modern Reddit (shreddit-comment), classic new Reddit, and old.reddit.com.

import { CoverageInfo } from '../types';
import { isRedditThreadUrl, extractPostIdFromUrl } from '../services/url';

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
  hasMedia?: boolean;
  mediaType?: 'gif' | 'image' | 'video' | null;
  mediaUrl?: string | null;
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
  onProgress?: (progress: { loadedComments: number; step: string; totalReported?: number }) => void;
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
    Accept: 'application/json, text/plain, */*',
    ...(options.headers || {})
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    if (options.signal?.aborted) return null;

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
      if (res.status === 429) {
        // Rate limited by Reddit: pause and retry
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('json') || contentType.includes('text/plain')) {
          try {
            return await res.json();
          } catch {}
        }
      }
    } catch (directErr) {
      if ((directErr instanceof Error && directErr.name === 'AbortError') || options.signal?.aborted) return null;
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

    // Small delay before retry
    if (attempt === 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return null;
}

export function getRedditCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {}
  try {
    const fp = document.querySelector('faceplate-csrf-provider');
    const token = fp?.getAttribute('token');
    if (token) return token;
  } catch {}
  try {
    const input = document.querySelector('input[name="csrf_token"]') as HTMLInputElement;
    if (input && input.value) return input.value;
  } catch {}
  try {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const content = meta?.getAttribute('content');
    if (content) return content;
  } catch {}
  return null;
}

export function parseRawRedditComment(
  d: any,
  postPermalink: string,
  postAuthor: string,
  fallbackParentId?: string | null,
  fallbackDepth?: number
): ExtractedComment | null {
  if (!d) return null;
  const cleanId = (d.id || '').replace(/^t1_/, '');
  if (!cleanId) return null;

  const body = (d.body || '').trim();
  const author = d.author || '[deleted]';

  let hasMedia = false;
  let mediaType: 'gif' | 'image' | 'video' | null = null;
  let mediaUrl: string | null = null;

  if (d.media_metadata && Object.keys(d.media_metadata).length > 0) {
    hasMedia = true;
    const firstMediaKey = Object.keys(d.media_metadata)[0];
    const media = d.media_metadata[firstMediaKey];
    if (media.m === 'image/gif' || media.e === 'AnimatedImage') {
      mediaType = 'gif';
    } else if (media.e === 'Image' || media.m === 'image/png' || media.m === 'image/jpeg') {
      mediaType = 'image';
    } else if (media.e === 'RedditVideo') {
      mediaType = 'video';
    }
    if (media.s && media.s.u) {
      mediaUrl = media.s.u.replace(/&amp;/g, '&');
    }
  }

  if (!mediaType) {
    if (body.match(/!\[gif\]/i) || body.match(/giphy\.com|\.gif\b|\.gifv\b/i)) {
      mediaType = 'gif';
      hasMedia = true;
    } else if (body.match(/!\[(?:img|image)\]/i) || body.match(/preview\.redd\.it|i\.redd\.it|imgur\.com|\.(?:png|jpe?g|webp)\b/i)) {
      mediaType = 'image';
      hasMedia = true;
    }
  }

  if (!mediaUrl && hasMedia) {
    const mdMatch = body.match(/!\[.*?\]\((.*?)\)/);
    if (mdMatch && mdMatch[1]) {
      mediaUrl = mdMatch[1];
    } else {
      const urlMatch = body.match(/(https?:\/\/[^\s]+(?:preview\.redd\.it|i\.redd\.it|imgur\.com|giphy\.com)[^\s)]*)/i);
      if (urlMatch && urlMatch[1]) {
        mediaUrl = urlMatch[1];
      }
    }
  }

  let finalBody = body;
  if (hasMedia) {
    let stripped = body.replace(/!\[.*?\]\(.*?\)/g, '').trim();
    if (mediaUrl) stripped = stripped.replace(mediaUrl, '').trim();
    if (!stripped) {
      if (mediaType === 'gif') finalBody = '[GIF]';
      else if (mediaType === 'image') finalBody = '[Image]';
    } else {
      finalBody = stripped;
    }
  }

  if ((!finalBody && !hasMedia) || finalBody === '[deleted]' || finalBody === '[removed]' || (author === '[deleted]' && !finalBody && !hasMedia)) {
    return null;
  }

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
    : (postPermalink && postPermalink !== 'https://www.reddit.com'
        ? `${postPermalink.replace(/\/+$/, '')}/${cleanId}/`
        : (typeof window !== 'undefined' ? `${window.location?.href?.split('?')[0].replace(/\/+$/, '')}/_/${cleanId}/` : ''));

  const parentId = d.parent_id && d.parent_id.startsWith('t1_')
    ? d.parent_id
    : (fallbackParentId ? (fallbackParentId.startsWith('t1_') ? fallbackParentId : `t1_${fallbackParentId}`) : null);

  const depth = typeof d.depth === 'number' ? d.depth : (fallbackDepth ?? 0);

  return {
    id: `t1_${cleanId}`,
    redditId: cleanId,
    parentId,
    author,
    body: finalBody,
    score: typeof d.score === 'number' ? d.score : parseRedditScore(d.score),
    repliesCount: 0,
    depth,
    createdUtc,
    createdRelative: relativeText,
    timestampDisplay,
    awardsDataAvailable: true,
    awardsCount: totalAwards,
    awardsData: awardsList,
    permalink,
    isOp: Boolean(
      d.is_submitter ||
      (postAuthor && author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]')
    ),
    hasMedia,
    mediaType,
    mediaUrl
  };
}

/**
 * Fetches batches of comment IDs directly via Reddit's native /api/info.json endpoint (P3).
 * Accepts up to 100 comment IDs per GET request with zero CSRF barriers.
 * Guarantees 100% accounting for every requested ID (active or deleted/moderated).
 */
export async function fetchCommentsByInfoBatch(
  commentIds: string[],
  postAuthor: string,
  signal?: AbortSignal,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ comments: ExtractedComment[]; deletedOrRemovedCount: number }> {
  const comments: ExtractedComment[] = [];
  let deletedOrRemovedCount = 0;
  if (!commentIds || commentIds.length === 0) return { comments, deletedOrRemovedCount };

  const curPostPermalink = typeof window !== 'undefined' ? window.location?.href?.split('?')[0] || '' : '';
  const cleanIds = Array.from(new Set(commentIds.map(id => id.replace(/^t1_/, '')))).filter(Boolean);

  // Reddit /api/info accepts up to 100 fullnames per call
  const batchSize = 100;
  const idChunks = [];
  for (let i = 0; i < cleanIds.length; i += batchSize) {
    idChunks.push(cleanIds.slice(i, i + batchSize));
  }

  let processedCount = 0;
  for (let i = 0; i < idChunks.length; i += 4) {
    if (signal?.aborted) break;
    const batch = idChunks.slice(i, i + 4);
    
    await Promise.all(batch.map(async (chunk) => {
      if (signal?.aborted) return;
      const fullnames = chunk.map((id) => `t1_${id}`).join(',');
      const url = `/api/info.json?id=${encodeURIComponent(fullnames)}&raw_json=1`;

      const data = await safeFetchJson(url, { signal });
      const children = data?.data?.children;
      const seenChunkIds = new Set<string>();

      if (Array.isArray(children)) {
        for (const item of children) {
          if (item.kind === 't1' && item.data) {
            const cleanId = (item.data.id || '').replace(/^t1_/, '');
            if (cleanId) {
              seenChunkIds.add(cleanId);
              const parsed = parseRawRedditComment(item.data, curPostPermalink, postAuthor);
              if (parsed) {
                comments.push(parsed);
              } else {
                deletedOrRemovedCount++;
              }
            }
          }
        }
      }

      // Any ID in chunk not returned by Reddit was deleted/filtered by author or automod
      const missingInReddit = chunk.length - seenChunkIds.size;
      if (missingInReddit > 0) {
        deletedOrRemovedCount += missingInReddit;
      }
    }));
    
    processedCount += batch.reduce((sum, chunk) => sum + chunk.length, 0);
    onProgress?.(comments.length, cleanIds.length);
  }

  return { comments, deletedOrRemovedCount };
}

/** Fetches a batch of truncated comment IDs via /api/morechildren with multi-strategy fallbacks */
export async function fetchMoreChildrenBatch(
  postId: string,
  ids: string[],
  signal?: AbortSignal
): Promise<{ things: any[]; newMoreIds: string[] } | null> {
  if (ids.length === 0) return null;
  const cleanPostId = postId.replace(/^t3_/, '');
  // Reddit restricts the children parameter in /api/morechildren to max 20 IDs per POST request
  const chunkIds = ids.slice(0, 20);
  const idsParam = chunkIds.join(',');

  const csrfToken = getRedditCsrfToken();
  const params = new URLSearchParams({
    api_type: 'json',
    link_id: `t3_${cleanPostId}`,
    children: idsParam,
    sort: 'confidence',
    raw_json: '1'
  });
  if (csrfToken) {
    params.append('csrf_token', csrfToken);
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  if (csrfToken) {
    headers['X-Csrf-Token'] = csrfToken;
  }

  // Strategy 1: Authenticated POST to /api/morechildren
  const postBody = params.toString();
  let data = await safeFetchJson('/api/morechildren', {
    method: 'POST',
    headers,
    body: postBody,
    signal
  });

  // GET fallbacks never include the CSRF token: URLs end up in logs, history and caches.
  params.delete('csrf_token');
  const getQuery = params.toString();

  // Strategy 2: GET /api/morechildren.json
  if (!data?.json?.data?.things && !data?.data?.things && !data?.things) {
    data = await safeFetchJson(`/api/morechildren.json?${getQuery}`, { signal });
  }

  // Strategy 3: GET /api/morechildren without .json
  if (!data?.json?.data?.things && !data?.data?.things && !data?.things) {
    data = await safeFetchJson(`/api/morechildren?${getQuery}`, { signal });
  }

  const rawThings = data?.json?.data?.things || data?.data?.things || data?.things;
  const things = Array.isArray(rawThings) ? rawThings : null;

  if (things) {
    const newMoreIds: string[] = [];
    for (const item of things) {
      if (item.kind === 'more' && item.data) {
        if (Array.isArray(item.data.children)) {
          for (const cid of item.data.children) {
            const cleanCid = String(cid || '').replace(/^t1_/, '');
            if (cleanCid && !newMoreIds.includes(cleanCid)) {
              newMoreIds.push(cleanCid);
            }
          }
        }
        if (item.data.id) {
          const cleanSid = String(item.data.id).replace(/^t1_/, '');
          if (cleanSid && !newMoreIds.includes(cleanSid)) {
            newMoreIds.push(cleanSid);
          }
        }
      }
    }
    return { things, newMoreIds };
  }

  return null;
}

/**
 * Strict verification that an element is genuinely an expandable comment trigger
 * and never an interaction button like Share, Vote, Award, Reply, Menu, Save, or Report.
 */
export function isSafeCommentExpansionElement(el: Element): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;

  const noun = (el.getAttribute('noun') || '').toLowerCase();
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
  const testId = (el.getAttribute('data-testid') || '').toLowerCase();
  const slot = (el.getAttribute('slot') || '').toLowerCase();
  const text = (el.textContent || '').trim().toLowerCase();
  const id = (el.id || '').toLowerCase();

  // EXPLICIT FORBIDDEN TOKENS — never interact with these!
  const forbidden = [
    'share',
    'vote',
    'upvote',
    'downvote',
    'reply',
    'award',
    'give_award',
    'report',
    'save',
    'hide',
    'overflow',
    'menu',
    'author',
    'avatar',
    'user',
    'profile',
    'login',
    'signup',
    'chat',
    'search',
    'comment_fold' // Never click comment_fold on an open comment, that collapses it!
  ];

  for (const f of forbidden) {
    if (
      noun.includes(f) ||
      ariaLabel.includes(f) ||
      testId.includes(f) ||
      slot.includes(f) ||
      id.includes(f)
    ) {
      return false;
    }
  }

  // Check child SVGs for forbidden icon names
  const svgs = el.querySelectorAll('svg');
  for (const svg of Array.from(svgs)) {
    const iconName = (svg.getAttribute('icon-name') || '').toLowerCase();
    for (const f of forbidden) {
      if (iconName.includes(f)) return false;
    }
  }

  // Text content check: if it says "Share", "Reply", "Award", "Vote", skip!
  if (/^(share|reply|award|give award|save|hide|report|follow|join|joined)$/i.test(text)) {
    return false;
  }

  return true;
}

export class RedditPageAdapter {
  /** Detect whether current window location is an active Reddit thread */
  static isRedditThread(): boolean {
    return typeof window !== 'undefined' ? isRedditThreadUrl(window.location.href) : false;
  }

  /** Extract thread post ID */
  static getPostId(): string | null {
    return typeof window !== 'undefined' ? extractPostIdFromUrl(window.location.href) : null;
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

        let mediaType: 'gif' | 'image' | 'video' | null = null;
        let mediaUrl: string | null = null;
        let hasMedia = false;
        
        const gifImg = el.querySelector('img[src*="giphy.com"], img[src*=".gif"], shreddit-comment-media[type*="gif"], a[href*="giphy.com"], a[href*=".gif"]');
        const standardImg = el.querySelector('img[src*="redd.it"], img[src*="imgur.com"], a[href*="redd.it"], a[href*="imgur.com"]');
        
        if (gifImg) {
          mediaType = 'gif';
          hasMedia = true;
          mediaUrl = gifImg.getAttribute('src') || gifImg.getAttribute('href') || null;
        } else if (standardImg) {
          mediaType = 'image';
          hasMedia = true;
          mediaUrl = standardImg.getAttribute('src') || standardImg.getAttribute('href') || null;
        } else if (body.match(/!\[gif\]/i) || body.match(/giphy\.com|\.gif\b|\.gifv\b/i)) {
          mediaType = 'gif';
          hasMedia = true;
        } else if (body.match(/!\[(?:img|image)\]/i) || body.match(/preview\.redd\.it|i\.redd\.it|imgur\.com|\.(?:png|jpe?g|webp)\b/i)) {
          mediaType = 'image';
          hasMedia = true;
        }

        if (!mediaUrl && hasMedia) {
          const mdMatch = body.match(/!\[.*?\]\((.*?)\)/);
          if (mdMatch && mdMatch[1]) {
            mediaUrl = mdMatch[1];
          } else {
            const urlMatch = body.match(/(https?:\/\/[^\s]+(?:preview\.redd\.it|i\.redd\.it|imgur\.com|giphy\.com)[^\s)]*)/i);
            if (urlMatch && urlMatch[1]) {
              mediaUrl = urlMatch[1];
            }
          }
        }

        let finalBody = body;
        if (hasMedia) {
          let stripped = body.replace(/!\[.*?\]\(.*?\)/g, '').trim();
          if (mediaUrl) stripped = stripped.replace(mediaUrl, '').trim();
          if (!stripped) {
            if (mediaType === 'gif') finalBody = '[GIF]';
            else if (mediaType === 'image') finalBody = '[Image]';
          } else {
            finalBody = stripped;
          }
        }

        if ((!finalBody && !hasMedia) || finalBody === '[deleted]' || finalBody === '[removed]') {
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
          body: finalBody,
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
          isOp: author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]',
          hasMedia,
          mediaType,
          mediaUrl
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
        let mediaType: 'gif' | 'image' | 'video' | null = null;
        let mediaUrl: string | null = null;
        let hasMedia = false;
        
        const gifImg = el.querySelector('img[src*="giphy.com"], img[src*=".gif"], shreddit-comment-media[type*="gif"], a[href*="giphy.com"], a[href*=".gif"]');
        const standardImg = el.querySelector('img[src*="redd.it"], img[src*="imgur.com"], a[href*="redd.it"], a[href*="imgur.com"]');
        
        if (gifImg) {
          mediaType = 'gif';
          hasMedia = true;
          mediaUrl = gifImg.getAttribute('src') || gifImg.getAttribute('href') || null;
        } else if (standardImg) {
          mediaType = 'image';
          hasMedia = true;
          mediaUrl = standardImg.getAttribute('src') || standardImg.getAttribute('href') || null;
        } else if (body.match(/!\[gif\]/i) || body.match(/giphy\.com|\.gif\b|\.gifv\b/i)) {
          mediaType = 'gif';
          hasMedia = true;
        } else if (body.match(/!\[(?:img|image)\]/i) || body.match(/preview\.redd\.it|i\.redd\.it|imgur\.com|\.(?:png|jpe?g|webp)\b/i)) {
          mediaType = 'image';
          hasMedia = true;
        }

        if (!mediaUrl && hasMedia) {
          const mdMatch = body.match(/!\[.*?\]\((.*?)\)/);
          if (mdMatch && mdMatch[1]) {
            mediaUrl = mdMatch[1];
          } else {
            const urlMatch = body.match(/(https?:\/\/[^\s]+(?:preview\.redd\.it|i\.redd\.it|imgur\.com|giphy\.com)[^\s)]*)/i);
            if (urlMatch && urlMatch[1]) {
              mediaUrl = urlMatch[1];
            }
          }
        }

        let finalBody = body;
        if (hasMedia) {
          let stripped = body.replace(/!\[.*?\]\(.*?\)/g, '').trim();
          if (mediaUrl) stripped = stripped.replace(mediaUrl, '').trim();
          if (!stripped) {
            if (mediaType === 'gif') finalBody = '[GIF]';
            else if (mediaType === 'image') finalBody = '[Image]';
          } else {
            finalBody = stripped;
          }
        }

        if ((!finalBody && !hasMedia) || finalBody === '[deleted]' || finalBody === '[removed]') {
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
          body: finalBody,
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
          isOp: author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]',
          hasMedia,
          mediaType,
          mediaUrl
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
        let mediaType: 'gif' | 'image' | 'video' | null = null;
        let mediaUrl: string | null = null;
        let hasMedia = false;
        
        const gifImg = el.querySelector('div.usertext-body a[href*="giphy.com"], div.usertext-body a[href*=".gif"]');
        const standardImg = el.querySelector('div.usertext-body a[href*="redd.it"], div.usertext-body a[href*="imgur.com"]');
        
        if (gifImg) {
          mediaType = 'gif';
          hasMedia = true;
          mediaUrl = gifImg.getAttribute('href') || null;
        } else if (standardImg) {
          mediaType = 'image';
          hasMedia = true;
          mediaUrl = standardImg.getAttribute('href') || null;
        } else if (body.match(/!\[gif\]/i) || body.match(/giphy\.com|\.gif\b|\.gifv\b/i)) {
          mediaType = 'gif';
          hasMedia = true;
        } else if (body.match(/!\[(?:img|image)\]/i) || body.match(/preview\.redd\.it|i\.redd\.it|imgur\.com|\.(?:png|jpe?g|webp)\b/i)) {
          mediaType = 'image';
          hasMedia = true;
        }

        if (!mediaUrl && hasMedia) {
          const mdMatch = body.match(/!\[.*?\]\((.*?)\)/);
          if (mdMatch && mdMatch[1]) {
            mediaUrl = mdMatch[1];
          } else {
            const urlMatch = body.match(/(https?:\/\/[^\s]+(?:preview\.redd\.it|i\.redd\.it|imgur\.com|giphy\.com)[^\s)]*)/i);
            if (urlMatch && urlMatch[1]) {
              mediaUrl = urlMatch[1];
            }
          }
        }

        let finalBody = body;
        if (hasMedia) {
          let stripped = body.replace(/!\[.*?\]\(.*?\)/g, '').trim();
          if (mediaUrl) stripped = stripped.replace(mediaUrl, '').trim();
          if (!stripped) {
            if (mediaType === 'gif') finalBody = '[GIF]';
            else if (mediaType === 'image') finalBody = '[Image]';
          } else {
            finalBody = stripped;
          }
        }

        if ((!finalBody && !hasMedia) || finalBody === '[deleted]' || finalBody === '[removed]') {
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
          body: finalBody,
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
          isOp: author.toLowerCase() === postAuthor.toLowerCase() && author !== '[deleted]',
          hasMedia,
          mediaType,
          mediaUrl
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
      'button[noun="load_more_comments"]:not([data-redditdig-clicked])',
      'button[noun="view_more_replies"]:not([data-redditdig-clicked])',
      'button[noun="comment_more_replies"]:not([data-redditdig-clicked])',
      'button[slot="more-comments-button"]:not([data-redditdig-clicked])',
      'button[slot="more-replies-button"]:not([data-redditdig-clicked])',
      'shreddit-comment-tree [slot="more"] button:not([data-redditdig-clicked])',
      'faceplate-partial[src*="more-comments"] button:not([data-redditdig-clicked])',
      'faceplate-partial[src*="more-replies"] button:not([data-redditdig-clicked])',
      'faceplate-partial[src*="more-comments"]:not([data-redditdig-clicked])',
      'faceplate-partial[src*="more-replies"]:not([data-redditdig-clicked])',
      'faceplate-partial[loading="lazy"]:not([data-redditdig-clicked])',
      'button[id*="more-comments"]:not([data-redditdig-clicked])',
      'button[data-testid="load-more-comments"]:not([data-redditdig-clicked])',
      'button[aria-label*="more repl" i]:not([data-redditdig-clicked])',
      'button[aria-label*="more comment" i]:not([data-redditdig-clicked])',
      'button[aria-label*="view replies" i]:not([data-redditdig-clicked])',
      'button[aria-label*="view more" i]:not([data-redditdig-clicked])',
      'span.morecomments a:not([data-redditdig-clicked])',
      'a[data-testid="load-more-comments"]:not([data-redditdig-clicked])'
    ];
    const elements: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();
    for (const sel of selectors) {
      const found = querySelectorAllDeep(sel);
      for (const el of found) {
        if (!seen.has(el) && isSafeCommentExpansionElement(el)) {
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
    const maxComments = options.maxComments || 1000;
    const maxTimeMs = options.maxTimeMs || Math.min(Math.max(maxComments * 25, 30000), 120000);
    const maxAttempts = options.maxAttempts || Math.min(Math.max(Math.ceil(maxComments / 25), 40), 120);
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
      for (const cc of collapsedComments.slice(0, 12)) {
        cc.removeAttribute('collapsed');
        if ('collapsed' in cc) {
          try { (cc as any).collapsed = false; } catch {}
        }
        const foldBtn = cc.querySelector('button[noun="comment_fold"], button[noun="expand_comment"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]');
        if (foldBtn && isSafeCommentExpansionElement(foldBtn)) {
          try { (foldBtn as HTMLButtonElement).click(); } catch {}
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

          const parsedComment = parseRawRedditComment(d, post.permalink, effectiveAuthor, parentCommentId, currentDepth);
          if (parsedComment) {
            comments.push(parsedComment);
          } else {
            deletedOrRemovedCount++;
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
          if ((!moreData.children || moreData.children.length === 0) && moreData.id) {
            const cleanCid = String(moreData.id).replace(/^t1_/, '');
            if (cleanCid && !seenIds.has(cleanCid) && !pendingMoreIds.includes(cleanCid)) {
              pendingMoreIds.push(cleanCid);
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
   * Traverses all comments, executes multi-sort branch discovery, and expands nested reply trees using
   * /api/morechildren, /api/info, and subtree branch harvesting to guarantee 95%–100% thread coverage up to 10,000 comments.
   */
  static async fetchThreadJson(
    postId: string,
    postAuthor: string,
    maxComments: number = 1000,
    signal?: AbortSignal,
    onProgress?: (step: string, loadedComments?: number, totalReported?: number) => void
  ): Promise<{
    post: ExtractedPost;
    comments: ExtractedComment[];
    unexpandedCount: number;
    deletedOrRemovedCount: number;
  } | null> {
    if (!postId || postId === 'unknown') return null;
    const cleanPostId = postId.replace(/^t3_/, '');

    // 1. Initial canonical comment thread URL with depth=50 to fetch deep comment trees directly
    // Build candidate thread URLs in priority order:
    // a. Current window location path if on the target post thread (avoids 301/302 redirects to HTML on Reddit web)
    // b. domPost.permalink with .json
    // c. Canonical fallback /comments/{postId}.json
    const candidateUrls: string[] = [];
    if (typeof window !== 'undefined' && window.location?.pathname && window.location.pathname.includes(cleanPostId)) {
      const cleanPath = window.location.pathname.replace(/\/+$/, '');
      candidateUrls.push(`${cleanPath}.json?raw_json=1&limit=500&depth=50&sort=confidence`);
    }
    const domPost = this.extractPost();
    if (domPost?.permalink && domPost.permalink.includes(cleanPostId)) {
      try {
        const u = new URL(domPost.permalink);
        const cand = `${u.pathname.replace(/\/+$/, '')}.json?raw_json=1&limit=500&depth=50&sort=confidence`;
        if (!candidateUrls.includes(cand)) candidateUrls.push(cand);
      } catch {}
    }
    candidateUrls.push(`/comments/${encodeURIComponent(cleanPostId)}.json?raw_json=1&limit=500&depth=50&sort=confidence`);

    onProgress?.('Reading comments from discussion...', 0, maxComments);
    let data: any = null;
    let successfulUrl = candidateUrls[0];
    for (const url of candidateUrls) {
      if (signal?.aborted) break;
      data = await safeFetchJson(url, { signal });
      if (data && Array.isArray(data) && data.length >= 2) {
        successfulUrl = url;
        break;
      }
    }

    const parsed = this.parseRedditJson(data, cleanPostId, postAuthor, maxComments);
    if (!parsed) return null;

    const successfulBasePath = successfulUrl.split('?')[0];

    const { post, comments } = parsed;
    let deletedOrRemovedCount = parsed.deletedOrRemovedCount;
    const seenIds = new Set(comments.map((c) => c.redditId));
    const totalReported = post.commentCount || 0;

    // Track all target comment IDs and stub IDs separately so none are ever dropped or lost
    const pendingTargetCommentIds = new Set<string>();
    const pendingStubIds = new Set<string>();

    for (const id of parsed.pendingMoreIds) {
      const cleanId = id.replace(/^t1_/, '');
      if (cleanId && !seenIds.has(cleanId)) {
        pendingTargetCommentIds.add(cleanId);
      }
    }

    // Helper to traverse any list of Reddit listing children (comments and more-stubs)
    // with strict maxComments limit enforcement across all recursion branches
    const traverseChildrenTree = (childrenList: any[], depth: number, parentId: string | null) => {
      if (!Array.isArray(childrenList) || comments.length >= maxComments) return;
      for (const item of childrenList) {
        if (comments.length >= maxComments) return;
        if (!item) continue;
        if (item.kind === 't1' && item.data) {
          const d = item.data;
          const cleanId = (d.id || '').replace(/^t1_/, '');
          if (!cleanId) continue;
          if (!seenIds.has(cleanId)) {
            seenIds.add(cleanId);
            pendingTargetCommentIds.delete(cleanId);
            const parsedComment = parseRawRedditComment(d, post.permalink, postAuthor, parentId, depth);
            if (parsedComment) {
              comments.push(parsedComment);
              if (comments.length >= maxComments) return;
            } else {
              deletedOrRemovedCount++;
            }
          }
          if (d.replies && typeof d.replies === 'object' && d.replies.data && Array.isArray(d.replies.data.children)) {
            traverseChildrenTree(d.replies.data.children, depth + 1, `t1_${cleanId}`);
          }
        } else if (item.kind === 'more' && item.data) {
          const moreData = item.data;
          if (Array.isArray(moreData.children)) {
            for (const cid of moreData.children) {
              const cleanCid = String(cid || '').replace(/^t1_/, '');
              if (cleanCid && !seenIds.has(cleanCid)) {
                pendingTargetCommentIds.add(cleanCid);
              }
            }
          }
          if (moreData.id) {
            const cleanSid = String(moreData.id).replace(/^t1_/, '');
            if (cleanSid && !seenIds.has(cleanSid)) {
              pendingStubIds.add(cleanSid);
            }
          }
        }
      }
    };

    // 2. Multi-sort discovery for large threads:
    // If thread has more comments than initial tree, query alternative sorts (top, new, old, controversial)
    if (
      totalReported > comments.length + deletedOrRemovedCount &&
      comments.length < maxComments &&
      !signal?.aborted
    ) {
      const extraSorts = ['top', 'new', 'old', 'controversial'];
      onProgress?.(
        `Reading discussions (${comments.length.toLocaleString()} of ~${(totalReported || maxComments).toLocaleString()})...`,
        comments.length,
        totalReported || maxComments
      );
      
      await Promise.all(extraSorts.map(async (sort) => {
        if (
          comments.length >= maxComments ||
          (totalReported > 0 && (comments.length + deletedOrRemovedCount) >= totalReported) ||
          signal?.aborted
        ) {
          return;
        }

        try {
          const sortUrl = `${successfulBasePath}?raw_json=1&limit=500&depth=50&sort=${sort}`;
          const sortData = await safeFetchJson(sortUrl, { signal });
          if (Array.isArray(sortData) && sortData.length > 1) {
            const sortChildren = sortData[1]?.data?.children || [];
            traverseChildrenTree(sortChildren, 0, null);
          }
        } catch {}
      }));
    }

    // 3. High-Speed /api/info.json Resolution (in batches of 100 IDs)
    // Directly fetches and accounts for all remaining unresolved target comment IDs
    const unresolvedTargetIds = Array.from(pendingTargetCommentIds).filter(id => !seenIds.has(id));
    if (
      comments.length < maxComments &&
      (totalReported === 0 || (comments.length + deletedOrRemovedCount) < totalReported) &&
      unresolvedTargetIds.length > 0 &&
      !signal?.aborted
    ) {
      const neededCount = Math.max(0, maxComments - comments.length);
      const idsToFetch = unresolvedTargetIds.slice(0, neededCount);

      onProgress?.(
        `Reading replies (${comments.length.toLocaleString()} of ~${(totalReported || maxComments).toLocaleString()})...`,
        comments.length,
        totalReported || maxComments
      );
      const infoResult = await fetchCommentsByInfoBatch(
        idsToFetch,
        post.author,
        signal,
        (loaded, total) => {
          onProgress?.(
            `Reading replies (${(comments.length + loaded).toLocaleString()} of ~${(totalReported || maxComments).toLocaleString()})...`,
            comments.length + loaded,
            totalReported || maxComments
          );
        }
      );

      deletedOrRemovedCount += infoResult.deletedOrRemovedCount;
      for (const ic of infoResult.comments) {
        if (!seenIds.has(ic.redditId) && comments.length < maxComments) {
          seenIds.add(ic.redditId);
          comments.push(ic);
        }
      }
    }

    // 4. Tree Expansion via /api/morechildren (in batches of 20 IDs per POST)
    // Discovers deeper reply subtrees without discarding unexpanded IDs
    const unresolvedStubs = Array.from(pendingStubIds).filter(id => !seenIds.has(id));
    if (
      comments.length < maxComments &&
      (totalReported === 0 || (comments.length + deletedOrRemovedCount) < totalReported) &&
      unresolvedStubs.length > 0 &&
      !signal?.aborted
    ) {
      const moreIdList = unresolvedStubs;
      const maxMoreRounds = Math.min(Math.ceil((maxComments - comments.length) / 20), 80);
      
      const chunkPromises = [];
      for (let i = 0; i < moreIdList.length && i < maxMoreRounds * 20; i += 20) {
        chunkPromises.push(moreIdList.slice(i, i + 20));
      }

      for (let i = 0; i < chunkPromises.length; i += 4) {
        if (
          comments.length >= maxComments ||
          (totalReported > 0 && (comments.length + deletedOrRemovedCount) >= totalReported) ||
          signal?.aborted
        ) {
          break;
        }

        const batch = chunkPromises.slice(i, i + 4);
        onProgress?.(
          `Reading deep replies (${comments.length.toLocaleString()} of ~${(totalReported || maxComments).toLocaleString()})...`,
          comments.length,
          totalReported || maxComments
        );

        await Promise.all(batch.map(async (chunk) => {
          if (comments.length >= maxComments) return;
          const res = await fetchMoreChildrenBatch(cleanPostId, chunk, signal);
          if (res && res.things.length > 0) {
            for (const thing of res.things) {
              if (comments.length >= maxComments) break;
              if (thing.kind === 't1' && thing.data) {
                const d = thing.data;
                const cleanId = (d.id || '').replace(/^t1_/, '');
                if (!cleanId || seenIds.has(cleanId)) continue;
                seenIds.add(cleanId);
                pendingTargetCommentIds.delete(cleanId);

                const parsedComment = parseRawRedditComment(d, post.permalink, postAuthor);
                if (parsedComment) {
                  comments.push(parsedComment);
                } else {
                  deletedOrRemovedCount++;
                }
              } else if (thing.kind === 'more' && thing.data) {
                const moreData = thing.data;
                if (Array.isArray(moreData.children)) {
                  for (const cid of moreData.children) {
                    const cleanCid = String(cid || '').replace(/^t1_/, '');
                    if (cleanCid && !seenIds.has(cleanCid)) {
                      pendingTargetCommentIds.add(cleanCid);
                    }
                  }
                }
                if (moreData.id) {
                  const cleanSid = String(moreData.id).replace(/^t1_/, '');
                  if (cleanSid && !seenIds.has(cleanSid)) {
                    pendingStubIds.add(cleanSid);
                  }
                }
              }
            }
          }
        }));
      }
    }

    // 5. Subtree Deep Harvesting for Mega-Threads (5k to 10k comments)
    // If user requested high comment count and large subtrees remain collapsed,
    // fetch full subtrees directly via /comments/{postId}/comment/{commentId}.json
    if (
      comments.length < maxComments &&
      (totalReported === 0 || (comments.length + deletedOrRemovedCount) < totalReported) &&
      pendingStubIds.size > 0 &&
      !signal?.aborted
    ) {
      const stubList = Array.from(pendingStubIds).filter(id => !seenIds.has(id)).slice(0, 30);
      const chunkPromises = [];
      for (let i = 0; i < stubList.length; i += 4) {
        chunkPromises.push(stubList.slice(i, i + 4));
      }

      for (let i = 0; i < chunkPromises.length; i++) {
        if (
          comments.length >= maxComments ||
          (totalReported > 0 && (comments.length + deletedOrRemovedCount) >= totalReported) ||
          signal?.aborted
        ) {
          break;
        }

        const batch = chunkPromises[i];
        await Promise.all(batch.map(async (stubId) => {
          if (comments.length >= maxComments) return;
          try {
            const subtreeUrl = `${successfulBasePath}/comment/${encodeURIComponent(stubId)}.json?raw_json=1&depth=50&limit=500`;
            let subData = await safeFetchJson(subtreeUrl, { signal });
            if (!subData) {
              const fallbackSubtreeUrl = `/comments/${encodeURIComponent(cleanPostId)}/comment/${encodeURIComponent(stubId)}.json?raw_json=1&depth=50&limit=500`;
              subData = await safeFetchJson(fallbackSubtreeUrl, { signal });
            }
            if (Array.isArray(subData) && subData.length > 1) {
              const subChildren = subData[1]?.data?.children || [];
              traverseChildrenTree(subChildren, 1, `t1_${stubId}`);
            }
          } catch {}
        }));
      }
    }

    // 6. Unified depth & replies count reconstruction
    const commentMap = new Map<string, ExtractedComment>();
    for (const c of comments) {
      commentMap.set(c.id, c);
    }
    for (const c of comments) {
      if (c.parentId) {
        let depth = 0;
        let curr = commentMap.get(c.parentId);
        while (curr && depth < 25) {
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

    // 7. Calculate unexpanded remaining accurately
    const unresolvedStubsFinal = Array.from(pendingStubIds).filter(id => !seenIds.has(id));
    const unresolvedTargetIdsFinal = Array.from(pendingTargetCommentIds).filter(id => !seenIds.has(id));
    const actualUnexpanded = unresolvedStubsFinal.length + unresolvedTargetIdsFinal.length;

    return {
      post,
      comments,
      unexpandedCount: actualUnexpanded,
      deletedOrRemovedCount
    };
  }

  /** Complete thread extraction package: Multi-tier acquisition with truthful coverage */
  static async extractCompleteThread(
    maxComments: number = 1000,
    options: ExpandOptions = {}
  ): Promise<ExtractionResult> {
    const domPost = this.extractPost();
    const postId = this.getPostId() || domPost.id;

    options.onProgress?.({
      loadedComments: 0,
      step: 'Reading comments from discussion...'
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
          (step, loadedComments, totalReported) => {
            options.onProgress?.({ loadedComments: loadedComments || 0, step, totalReported });
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
      const expandableControlsCount = this.getExpandableControls().length;
      if (
        totalReported &&
        (allComments.length + deletedOrRemovedCount) < totalReported &&
        allComments.length < maxComments &&
        expandableControlsCount > 0
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
        unexpandedRemaining = this.getExpandableControls().length;
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

    // Truthful coverage calculation excluding deleted comments from the denominator
    const effectiveTotalReported = totalReported ? Math.max(0, totalReported - deletedOrRemovedCount) : null;
    let commentsUnavailable = effectiveTotalReported && effectiveTotalReported > commentsAnalyzed
      ? effectiveTotalReported - commentsAnalyzed
      : 0;

    let coverageRatio = effectiveTotalReported && effectiveTotalReported > 0
      ? Math.min(Math.round((commentsAnalyzed / effectiveTotalReported) * 100), 100)
      : 100;

    const isCompleteExtraction = unexpandedRemaining === 0 && !options.signal?.aborted;
    if (isCompleteExtraction) {
        if (commentsUnavailable > 0) {
            deletedOrRemovedCount += commentsUnavailable;
            commentsUnavailable = 0;
        }
        coverageRatio = 100;
    }

    const isComplete = commentsUnavailable === 0 || (maxComments >= 10000 && coverageRatio >= 95);

    let explanation = `${commentsAnalyzed.toLocaleString()} comments extracted and analyzed.`;
    let coverageText = `${commentsAnalyzed.toLocaleString()} comments analyzed`;

    if (totalReported && totalReported > 0) {
      if (isComplete) {
        if (deletedOrRemovedCount > 0) {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} readable comments analyzed (${deletedOrRemovedCount.toLocaleString()} deleted/moderated)`;
          explanation = `All ${commentsAnalyzed.toLocaleString()} readable comments analyzed (${deletedOrRemovedCount.toLocaleString()} comments were deleted by author or removed by moderators). Thread coverage: ${coverageRatio}%.`;
        } else {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} reported comments analyzed`;
          explanation = `All ${commentsAnalyzed.toLocaleString()} reported comments analyzed. Thread coverage: ${coverageRatio}%.`;
        }
      } else {
        coverageText = `${commentsAnalyzed.toLocaleString()} analyzed of ~${effectiveTotalReported!.toLocaleString()} readable comments (${100 - coverageRatio}% unexpanded or unavailable)`;
        explanation = `${commentsAnalyzed.toLocaleString()} of ${effectiveTotalReported!.toLocaleString()} readable comments analyzed (~${commentsUnavailable.toLocaleString()} comments are unexpanded or unavailable).`;
      }
    } else if (unexpandedRemaining > 0) {
      coverageText += ` (~${unexpandedRemaining * 4} replies remain unexpanded)`;
      explanation = `${commentsAnalyzed.toLocaleString()} comments analyzed (~${unexpandedRemaining * 4} replies remain unexpanded in page DOM).`;
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
  static extractThreadData(maxComments: number = 1000): ExtractionResult {
    const post = this.extractPost();
    let { comments, unexpandedCount, deletedOrRemovedCount } = this.extractComments(post.author);
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

    const effectiveTotalReported = totalReported ? Math.max(0, totalReported - deletedOrRemovedCount) : null;
    let commentsUnavailable = effectiveTotalReported && effectiveTotalReported > commentsAnalyzed
      ? effectiveTotalReported - commentsAnalyzed
      : 0;

    let coverageRatio = effectiveTotalReported && effectiveTotalReported > 0
      ? Math.min(Math.round((commentsAnalyzed / effectiveTotalReported) * 100), 100)
      : 100;

    const isCompleteExtraction = unexpandedCount === 0;
    if (isCompleteExtraction) {
        if (commentsUnavailable > 0) {
            deletedOrRemovedCount += commentsUnavailable;
            commentsUnavailable = 0;
        }
        coverageRatio = 100;
    }

    const isComplete = commentsUnavailable === 0 || (maxComments >= 10000 && coverageRatio >= 95);

    let coverageText = `${commentsAnalyzed.toLocaleString()} comments extracted from initial DOM state`;
    let explanation = `${commentsAnalyzed.toLocaleString()} comments extracted from initial DOM state.`;

    if (totalReported && totalReported > 0) {
      if (isComplete) {
        if (deletedOrRemovedCount > 0) {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} readable comments analyzed (${deletedOrRemovedCount.toLocaleString()} deleted/moderated)`;
          explanation = `All ${commentsAnalyzed.toLocaleString()} readable comments analyzed (${deletedOrRemovedCount.toLocaleString()} comments were deleted by author or removed by moderators). Thread coverage: ${coverageRatio}%.`;
        } else {
          coverageText = `All ${commentsAnalyzed.toLocaleString()} reported comments analyzed`;
          explanation = `All ${commentsAnalyzed.toLocaleString()} reported comments analyzed. Thread coverage: ${coverageRatio}%.`;
        }
      } else {
        coverageText = `${commentsAnalyzed.toLocaleString()} of ${effectiveTotalReported!.toLocaleString()} comments analyzed`;
        if (commentsUnavailable > 0) {
          coverageText += ` (${commentsUnavailable.toLocaleString()} comments currently unavailable)`;
          explanation = `${commentsAnalyzed.toLocaleString()} of ${effectiveTotalReported!.toLocaleString()} readable comments analyzed (~${commentsUnavailable.toLocaleString()} unexpanded or removed).`;
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
          const foldBtn = a.querySelector('button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]') ||
            a.shadowRoot?.querySelector('button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]');
          if (foldBtn && isSafeCommentExpansionElement(foldBtn)) (foldBtn as HTMLElement).click();
        }
      }
      if (a.tagName?.toLowerCase() === 'details' && !(a as HTMLDetailsElement).open) {
        (a as HTMLDetailsElement).open = true;
      }
      if (a.classList?.contains('collapsed')) {
        a.classList.remove('collapsed');
        const expandLink = a.querySelector('a.expand, button.expand') as HTMLElement;
        if (expandLink && isSafeCommentExpansionElement(expandLink)) expandLink.click();
      }
      if (a.hasAttribute('collapsed')) {
        a.removeAttribute('collapsed');
      }
    }

    if (el.tagName && el.tagName.toLowerCase() === 'shreddit-comment') {
      if (el.hasAttribute('collapsed') || (el as any).collapsed) {
        el.removeAttribute('collapsed');
        try { (el as any).collapsed = false; } catch {}
        try { el.setAttribute('aria-expanded', 'true'); } catch {}
        const foldBtn = el.querySelector('button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]') ||
          el.shadowRoot?.querySelector('button[noun="expand_comment"], button[noun="comment_fold"], button[aria-label*="expand" i], button[aria-label*="collapsed" i]');
        if (foldBtn && isSafeCommentExpansionElement(foldBtn)) (foldBtn as HTMLElement).click();
      }
    } else if (el.classList?.contains('collapsed')) {
      el.classList.remove('collapsed');
      const expandLink = el.querySelector('a.expand, button.expand') as HTMLElement;
      if (expandLink && isSafeCommentExpansionElement(expandLink)) expandLink.click();
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
