// RedditDIG Background Service Worker (Manifest V3)
// All listeners are registered synchronously at top level so they survive service-worker restarts.

import { validateRelayRequest } from '../services/fetchPolicy';
import { isRedditHostname } from '../services/url';

const RELAY_TIMEOUT_MS = 20_000;

chrome.runtime.onInstalled.addListener(() => {
  // The toolbar icon opens the popup; the side panel is opened explicitly from the popup / shortcut.
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

/** sidePanel.open() must run inside the user gesture, so it is called before any await. */
function openSidePanel(tabId: number | undefined): Promise<void> {
  if (typeof tabId !== 'number' || !chrome.sidePanel?.open) {
    return Promise.reject(new Error('Side panel is not available in this browser.'));
  }
  return chrome.sidePanel.open({ tabId });
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'open-redditdig') return;
  if (tab?.id !== undefined) {
    openSidePanel(tab.id).catch((err) => console.warn('RedditDIG: could not open side panel:', err));
    return;
  }
  // Older Chromium builds do not pass the tab; fall back to a query (may lose the user gesture).
  chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) =>
    openSidePanel(active?.id).catch((err) => console.warn('RedditDIG: could not open side panel:', err))
  );
});

function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id;
}

function senderIsRedditTab(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  // If it comes from our extension's sidepanel or popup:
  if (!sender.tab) return true;
  // If tab.url is available, ensure it's a reddit tab:
  if (sender.tab.url) {
    try {
      const u = new URL(sender.tab.url);
      return (u.protocol === 'https:' || u.protocol === 'http:') && isRedditHostname(u.hostname);
    } catch {
      return false;
    }
  }
  // Content script running in a tab whose url may be restricted
  return typeof sender.tab.id === 'number';
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender) || !message || typeof message !== 'object') return false;

  if (message.action === 'OPEN_SIDEPANEL') {
    const requested = Number.isInteger(message.tabId) ? (message.tabId as number) : undefined;
    openSidePanel(requested ?? sender.tab?.id)
      .then(() => sendResponse({ success: true }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true; // async sendResponse
  }

  if (message.action === 'GET_ACTIVE_REDDIT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ tab: tab || null });
    }).catch(() => sendResponse({ tab: null }));
    return true;
  }

  if (message.action === 'FETCH_REDDIT_JSON') {
    // Only content scripts running on Reddit pages or extension UI may use the relay.
    if (!senderIsRedditTab(sender)) {
      sendResponse({ success: false, error: 'Relay is only available to Reddit pages.' });
      return false;
    }
    const validation = validateRelayRequest(message);
    if (!validation.ok) {
      sendResponse({ success: false, error: validation.reason });
      return false;
    }

    const { url, init } = validation.request;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

    fetch(url, { ...init, signal: controller.signal })
      .then(async (res) => {
        let finalHost = '';
        try {
          finalHost = new URL(res.url).hostname;
        } catch {
          /* ignore */
        }
        if (!isRedditHostname(finalHost)) {
          sendResponse({ success: false, error: 'Unexpected redirect target.' });
          return;
        }
        if (!res.ok) {
          sendResponse({ success: false, status: res.status });
          return;
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('json') && !contentType.includes('text/plain')) {
          sendResponse({ success: false, error: 'Response was not JSON (redirected to HTML).' });
          return;
        }
        try {
          const data = await res.json();
          sendResponse({ success: true, data });
        } catch (jsonErr: any) {
          sendResponse({ success: false, error: jsonErr?.message || 'JSON parse error.' });
        }
      })
      .catch((err: Error) => sendResponse({ success: false, error: err.message }))
      .finally(() => clearTimeout(timer));
    return true; // async sendResponse
  }

  return false;
});
