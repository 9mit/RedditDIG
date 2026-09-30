// RedditDIG Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('RedditDIG Extension installed successfully.');
  // Configure side panel behavior
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-redditdig') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ tabId: tab.id }).catch((err) => {
          console.warn('Could not open side panel:', err);
        });
      }
    }
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_SIDEPANEL') {
    const tabId = message.tabId || (sender.tab && sender.tab.id);
    if (tabId && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId }).then(() => {
        sendResponse({ success: true });
      }).catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
      return true; // async sendResponse
    }
  }

  if (message.action === 'GET_ACTIVE_REDDIT_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      sendResponse({ tab: tab || null });
    });
    return true;
  }

  if (message.action === 'FETCH_REDDIT_JSON') {
    const targetUrl = message.url;
    const fetchOptions: RequestInit = {
      method: message.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(message.headers || {})
      },
      credentials: 'include'
    };
    if (message.body) {
      fetchOptions.body = message.body;
    }

    fetch(targetUrl, fetchOptions)
      .then(async (res) => {
        if (!res.ok) {
          sendResponse({ success: false, status: res.status });
          return;
        }
        const data = await res.json();
        sendResponse({ success: true, data });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // async sendResponse
  }
});

