// RedditDIG Content Script (Manifest V3)
// Communicates with Sidepanel and executes DOM extractions and scrolling highlights

import { RedditPageAdapter } from './adapter';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'CHECK_IS_THREAD') {
    sendResponse({
      isThread: RedditPageAdapter.isRedditThread(),
      postId: RedditPageAdapter.getPostId(),
      url: window.location.href,
      title: document.title
    });
    return true;
  }

  if (request.action === 'EXTRACT_THREAD_DATA') {
    (async () => {
      try {
        if (!RedditPageAdapter.isRedditThread()) {
          sendResponse({
            success: false,
            error: 'Current page is not an active Reddit discussion thread.'
          });
          return;
        }

        const maxComments = request.maxComments || 500;
        const extraction = await RedditPageAdapter.extractCompleteThread(maxComments);
        sendResponse({
          success: true,
          data: extraction
        });
      } catch (e: any) {
        console.error('RedditDIG extraction error:', e);
        sendResponse({
          success: false,
          error: e.message || 'Failed to extract Reddit page comments.'
        });
      }
    })();
    return true; // asynchronous sendResponse
  }

  if (request.action === 'SCROLL_AND_HIGHLIGHT') {
    const { commentId } = request;
    const found = RedditPageAdapter.scrollToAndHighlight(commentId);
    sendResponse({
      success: found,
      reason: found ? 'Scrolled and highlighted' : 'Comment not currently rendered in DOM'
    });
    return true;
  }
});

// Automatically locate and highlight comment on page load if URL targets a specific comment permalink
function autoHighlightTargetComment() {
  if (typeof window === 'undefined') return;
  const hashMatch = window.location.hash.match(/#(?:t1_)?([a-z0-9]+)/i);
  const pathMatch = window.location.pathname.match(/\/comments\/[a-z0-9]+\/(?:[^\/]+\/)?([a-z0-9]+)/i);
  const queryMatch = window.location.search.match(/[?&]comment=([a-z0-9]+)/i);
  const targetId = hashMatch?.[1] || pathMatch?.[1] || queryMatch?.[1];

  if (!targetId || targetId.length < 3) return;

  let attempts = 0;
  const maxAttempts = 15;
  let observer: MutationObserver | null = null;

  const tryHighlight = () => {
    attempts++;
    const found = RedditPageAdapter.scrollToAndHighlight(targetId);
    if (found && observer) {
      observer.disconnect();
      observer = null;
    }
    return found;
  };

  // Immediate attempt
  if (tryHighlight()) return;

  // MutationObserver to catch asynchronous rendering of Web Components (shreddit-comment)
  if (typeof MutationObserver !== 'undefined' && document.body) {
    observer = new MutationObserver(() => {
      if (tryHighlight()) {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Safety disconnect after 8 seconds
    setTimeout(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }, 8000);
  }

  // Progressive timer attempts
  const delays = [150, 400, 800, 1500, 2500, 4000, 6000];
  for (const delay of delays) {
    setTimeout(() => {
      if (attempts < maxAttempts) {
        tryHighlight();
      }
    }, delay);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoHighlightTargetComment);
  } else {
    autoHighlightTargetComment();
  }
}
