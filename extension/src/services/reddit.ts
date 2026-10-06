import {
  extractPostIdFromUrl as extractPostId,
  isRedditThreadUrl,
  toSafeRedditUrl
} from './url';

/** True when `url` is a Reddit discussion page that RedditDIG can read. */
export function isRedditUrl(url: string): boolean {
  return isRedditThreadUrl(url);
}

export function extractPostIdFromUrl(url: string): string | null {
  return extractPostId(url);
}

const COMMENT_ID_RE = /^[a-z0-9_-]{3,16}$/i;
const POST_BASE_RE = /^(https:\/\/[^/]+(?:\/(?:r|u|user)\/[^/]+)?\/comments\/[a-z0-9]+)/i;

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return undefined;
  const current = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (current.length > 0) return current[0];
  const focused = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  return focused[0];
}

async function openInNewTab(url: string): Promise<boolean> {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      await chrome.tabs.create({ url });
      return true;
    }
  } catch (e) {
    console.warn('RedditDIG: chrome.tabs.create failed, falling back to window.open:', e);
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Scrolls to a comment in the active Reddit tab when it shows the same post, otherwise opens the
 * comment's permalink in a new tab. Every navigation target is validated as an https Reddit URL,
 * so DOM-derived permalinks can never trigger javascript:/data: or off-site navigation.
 */
export async function jumpToRedditComment(commentId: string, permalink?: string): Promise<boolean> {
  const cleanId = (commentId || '').replace(/^t1_/, '').trim();
  if (!COMMENT_ID_RE.test(cleanId)) return false;

  const safePermalink = toSafeRedditUrl(permalink);
  const permalinkPostId = safePermalink ? extractPostId(safePermalink) : null;

  const buildCommentUrl = (base: string | null): string | null => {
    if (!base) return null;
    if (base.includes(cleanId)) return base;
    const m = base.match(POST_BASE_RE);
    return m ? toSafeRedditUrl(`${m[1]}/_/${cleanId}/`) : null;
  };

  try {
    const tab = await getActiveTab();
    const tabIsSamePost =
      !!tab?.id &&
      !!tab.url &&
      isRedditThreadUrl(tab.url) &&
      (!permalinkPostId || extractPostId(tab.url) === permalinkPostId);

    if (tab?.id && tabIsSamePost) {
      // 1. Send message to content script to scroll in-page
      const response = await chrome.tabs
        .sendMessage(tab.id, {
          action: 'SCROLL_AND_HIGHLIGHT',
          commentId: cleanId
        })
        .catch(() => null);

      if (response?.success) {
        return true;
      }

      // 2. If content script is missing or not responding (e.g. extension reloaded on existing tab),
      // execute direct in-page scroll via chrome.scripting.executeScript — no navigation fallback
      if (typeof chrome !== 'undefined' && chrome.scripting?.executeScript) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (cid: string) => {
              const clean = cid.replace(/^t1_/, '');
              const selectors = [
                `shreddit-comment[thingid*="${clean}"]`,
                `shreddit-comment[id*="${clean}"]`,
                `[data-comment-id*="${clean}"]`,
                `[id*="${clean}"]`
              ];
              for (const sel of selectors) {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.style.outline = '3px solid #ff4500';
                  setTimeout(() => { el.style.outline = ''; }, 3500);
                  return true;
                }
              }
              return false;
            },
            args: [cleanId]
          });
          if (results?.[0]?.result) {
            return true;
          }
        } catch (scriptErr) {
          console.warn('RedditDIG: scripting.executeScript scroll fallback failed:', scriptErr);
        }
      }

      // 3. Comment not found in DOM — open permalink in new tab instead of reloading the page
      const commentUrl = buildCommentUrl(safePermalink) ?? buildCommentUrl(toSafeRedditUrl(tab.url));
      if (commentUrl) {
        return openInNewTab(commentUrl);
      }

      return true;
    }
  } catch (e) {
    console.warn('RedditDIG: could not jump to comment in active tab:', e);
  }

  // Only open in a new tab if there is no active tab or the active tab is NOT on this post!
  const fallback = buildCommentUrl(safePermalink);
  return fallback ? openInNewTab(fallback) : false;
}
