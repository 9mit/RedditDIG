// URL safety helpers shared by the side panel, popup, background worker and content script.
// All URLs that originate from page DOM / Reddit JSON are untrusted and must pass through
// one of these helpers before reaching a navigation or link sink.

const REDDIT_HOST_RE = /^(?:[a-z0-9-]+\.)*reddit\.com$/i;
const REDDIT_SHORT_HOST = 'redd.it';
/** Path segments that can follow /comments/<id>/<slug>/ but are views, not comment ids. */
const RESERVED_THREAD_SEGMENTS = new Set([
  'duplicates', 'related', 'new', 'top', 'best', 'controversial', 'old', 'qa', 'live', 'hot', 'rising'
]);

function parse(raw: unknown): URL | null {
  if (typeof raw !== 'string' || !raw || raw.length > 4096) return null;
  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return new URL(trimmed, 'https://www.reddit.com');
    }
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** True when the hostname is reddit.com or any subdomain of it. */
export function isRedditHostname(hostname: string): boolean {
  return REDDIT_HOST_RE.test(hostname);
}

/**
 * Returns a normalized https Reddit URL, or null if the input is not an https URL on
 * reddit.com / *.reddit.com / redd.it, or if it embeds credentials.
 */
export function toSafeRedditUrl(raw: unknown): string | null {
  const u = parse(raw);
  if (!u || u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (!isRedditHostname(u.hostname) && u.hostname.toLowerCase() !== REDDIT_SHORT_HOST) return null;
  return u.toString();
}

/** Returns a normalized http(s) URL or null (blocks javascript:, data:, file:, chrome-extension:, ...). */
export function toSafeHttpUrl(raw: unknown): string | null {
  const u = parse(raw);
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return null;
  if (u.username || u.password) return null;
  return u.toString();
}

/**
 * True for pages RedditDIG can analyze: a Reddit post ("comments") page on reddit.com or a
 * redd.it short link. Anchored via URL parsing, so look-alike hosts and URLs that merely
 * contain a Reddit URL in their query string are rejected.
 */
export function isRedditThreadUrl(raw: unknown): boolean {
  const u = parse(raw);
  if (!u || (u.protocol !== 'https:' && u.protocol !== 'http:')) return false;
  const host = u.hostname.toLowerCase();
  if (host === REDDIT_SHORT_HOST) {
    return /^\/[a-z0-9]+\/?$/i.test(u.pathname);
  }
  if (!isRedditHostname(host)) return false;
  return /^\/(?:(?:r|u|user)\/[^/]+\/)?comments\/[a-z0-9]+(?:\/|$)/i.test(u.pathname);
}

/** Extracts the base-36 post id from a Reddit thread URL, or null. */
export function extractPostIdFromUrl(raw: unknown): string | null {
  const u = parse(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  if (host === REDDIT_SHORT_HOST) {
    const m = u.pathname.match(/^\/([a-z0-9]+)\/?$/i);
    return m ? m[1].toLowerCase() : null;
  }
  if (!isRedditHostname(host)) return null;
  const m = u.pathname.match(/\/comments\/([a-z0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Extracts the subreddit name from a Reddit URL, or null. */
export function extractSubredditFromUrl(raw: unknown): string | null {
  const u = parse(raw);
  if (!u || !isRedditHostname(u.hostname)) return null;
  const m = u.pathname.match(/^\/r\/([^/]+)/i);
  return m ? m[1] : null;
}

/** Extracts a target comment id from a Reddit permalink/location, avoiding slug false-positives. */
export function extractTargetCommentId(loc: { pathname: string; search: string; hash: string }): string | null {
  // 1. /r/sub/comments/<postId>/<slug>/<commentId>/  (slug is mandatory; Reddit uses "_" when it is omitted)
  const segments = loc.pathname.split('/').filter(Boolean);
  const start = segments.length > 0 && ['r', 'u', 'user'].includes(segments[0].toLowerCase()) ? 2 : 0;
  const ci = segments.findIndex((s, i) => i >= start && s.toLowerCase() === 'comments');
  if (ci !== -1 && segments.length >= ci + 4) {
    const candidate = segments[ci + 3];
    if (/^[a-z0-9]{3,12}$/i.test(candidate) && !RESERVED_THREAD_SEGMENTS.has(candidate.toLowerCase())) {
      return candidate.toLowerCase();
    }
  }

  // 2. ?comment=<id>
  const q = loc.search.match(/[?&]comment=([a-z0-9]{3,12})(?:&|$)/i);
  if (q) return q[1].toLowerCase();
  // 3. #t1_<id> or #<id> (explicit comment fullname or base36 id, ignoring ordinary anchors like #comments)
  const h = loc.hash.match(/^#(?:t1_)?([a-z0-9]{3,12})$/i);
  if (h && !RESERVED_THREAD_SEGMENTS.has(h[1].toLowerCase()) && h[1].toLowerCase() !== 'comments') {
    return h[1].toLowerCase();
  }
  return null;
}
