// RedditDIG Content Script (Manifest V3, classic script bundled as a single IIFE)
// Communicates with the side panel to run DOM/JSON extraction and scroll-highlight comments.

import { RedditPageAdapter } from './adapter';
import { extractTargetCommentId } from '../services/url';

declare global {
  interface Window {
    __redditDigContentLoaded?: boolean;
  }
}

const COMMENT_ID_RE = /^[a-z0-9_-]{3,16}$/i;
const MAX_COMMENTS_CAP = 10_000;

let activeExtraction: AbortController | null = null;

function reportProgress(progress: { loadedComments: number; totalReported?: number | null; step: string }) {
  try {
    // Rejects when the side panel is closed; that is expected and must not surface as an unhandled rejection.
    const maybePromise = chrome.runtime.sendMessage({
      action: 'EXTRACTION_PROGRESS',
      loadedComments: progress.loadedComments,
      totalReported: progress.totalReported,
      step: progress.step
    }) as Promise<unknown> | undefined;
    maybePromise?.catch?.(() => {});
  } catch {
    /* extension context invalidated or panel closed */
  }
}

function registerMessageHandlers() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Only accept messages from this extension's own pages/workers.
    if ((sender.id && sender.id !== chrome.runtime.id) || !request || typeof request !== 'object') return false;

    if (request.action === 'CHECK_IS_THREAD') {
      sendResponse({
        isThread: RedditPageAdapter.isRedditThread(),
        postId: RedditPageAdapter.getPostId(),
        url: window.location.href,
        title: document.title
      });
      return false;
    }

    if (request.action === 'EXTRACT_THREAD_DATA') {
      (async () => {
        if (!RedditPageAdapter.isRedditThread()) {
          sendResponse({ success: false, error: 'Current page is not an active Reddit discussion thread.' });
          return;
        }

        activeExtraction?.abort();
        const controller = new AbortController();
        activeExtraction = controller;

        try {
          const requested = Number(request.maxComments);
          const maxComments = Number.isFinite(requested) && requested > 0
            ? Math.min(Math.floor(requested), MAX_COMMENTS_CAP)
            : 1000;

          const extraction = await RedditPageAdapter.extractCompleteThread(maxComments, {
            signal: controller.signal,
            onProgress: reportProgress
          });

          if (controller.signal.aborted) {
            sendResponse({ success: false, error: 'Cancelled.' });
          } else {
            sendResponse({ success: true, data: extraction });
          }
        } catch (e: unknown) {
          console.error('RedditDIG extraction error:', e);
          sendResponse({
            success: false,
            error: (e instanceof Error && e.message) || 'Failed to extract Reddit page comments.'
          });
        } finally {
          if (activeExtraction === controller) activeExtraction = null;
        }
      })();
      return true; // asynchronous sendResponse
    }

    if (request.action === 'CANCEL_EXTRACTION') {
      activeExtraction?.abort();
      activeExtraction = null;
      sendResponse({ success: true });
      return false;
    }

    if (request.action === 'SCROLL_AND_HIGHLIGHT') {
      const commentId = typeof request.commentId === 'string' ? request.commentId : '';
      const valid = COMMENT_ID_RE.test(commentId.replace(/^t1_/, ''));
      if (!valid) {
        sendResponse({ success: false, reason: 'Invalid comment ID format' });
        return false;
      }

      // Try to locate, uncollapse, and highlight comment in the current DOM
      const found = RedditPageAdapter.scrollToAndHighlight(commentId);
      if (found) {
        sendResponse({
          success: true,
          method: 'scroll',
          reason: 'Scrolled and highlighted in active DOM'
        });
        return false;
      }

      // Comment not rendered in DOM — return false so the caller can open a new tab if needed.
      // Never reload or navigate the page, as that destroys the user's scroll position and
      // any analysis already loaded.
      sendResponse({
        success: false,
        reason: 'Comment not currently rendered in DOM'
      });
      return false;
    }

    return false;
  });
}

// Locate and highlight the comment when the URL is a comment permalink. Rendering of Reddit's web
// components is asynchronous, so retry briefly via a debounced observer, then stop for good.
function autoHighlightTargetComment() {
  if (!RedditPageAdapter.isRedditThread()) return;
  const targetId = extractTargetCommentId(window.location);
  if (!targetId) return;

  let done = false;
  let observer: MutationObserver | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];

  const stop = () => {
    done = true;
    observer?.disconnect();
    observer = null;
    if (debounceTimer) clearTimeout(debounceTimer);
    timers.forEach(clearTimeout);
  };

  const tryHighlight = () => {
    if (done) return;
    if (RedditPageAdapter.scrollToAndHighlight(targetId)) stop();
  };

  tryHighlight();
  if (done) return;

  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => {
      if (debounceTimer) return;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        tryHighlight();
      }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  for (const delay of [800, 2500, 5000]) timers.push(setTimeout(tryHighlight, delay));
  timers.push(setTimeout(stop, 8000));
}

if (!window.__redditDigContentLoaded) {
  window.__redditDigContentLoaded = true;
  registerMessageHandlers();

  // Listen for SPA history/hash navigation
  window.addEventListener('popstate', () => autoHighlightTargetComment());
  window.addEventListener('hashchange', () => autoHighlightTargetComment());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoHighlightTargetComment, { once: true });
  } else {
    autoHighlightTargetComment();
  }
}
