export function isRedditUrl(url: string): boolean {
  if (!url) return false;
  return /https?:\/\/(www\.|old\.|sh\.)?reddit\.com\/r\/[^\/]+\/comments\/[a-z0-9]+/i.test(url) ||
         /https?:\/\/redd\.it\/[a-z0-9]+/i.test(url);
}

export function extractPostIdFromUrl(url: string): string | null {
  if (!url) return null;
  const m1 = url.match(/\/comments\/([a-z0-9]+)/i);
  if (m1) return m1[1];
  const m2 = url.match(/redd\.it\/([a-z0-9]+)/i);
  if (m2) return m2[1];
  return null;
}

export async function jumpToRedditComment(commentId: string, permalink?: string): Promise<boolean> {
  const cleanId = (commentId || '').replace(/^t1_/, '').trim();
  if (!cleanId) return false;

  let targetUrl = permalink;
  const isGeneric = !targetUrl || targetUrl === 'https://www.reddit.com' || targetUrl === 'https://www.reddit.com/' || !targetUrl.includes(cleanId);

  if (typeof chrome !== 'undefined' && chrome.tabs) {
    try {
      let activeTab: chrome.tabs.Tab | undefined;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
      if (tabs && tabs.length > 0) {
        activeTab = tabs[0];
      } else {
        const lastFocused = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
        if (lastFocused && lastFocused.length > 0) {
          activeTab = lastFocused[0];
        }
      }
      if (!activeTab) {
        const allActive = await chrome.tabs.query({ active: true }).catch(() => []);
        activeTab = allActive.find(t => t.url?.includes('reddit.com')) || allActive[0];
      }

      if (activeTab && activeTab.id && activeTab.url && activeTab.url.includes('reddit.com')) {
        // Send message to content script in active tab
        const response = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'SCROLL_AND_HIGHLIGHT',
          commentId: cleanId
        }).catch(() => null);

        if (response && response.success) {
          return true;
        }

        // If content script didn't find the element rendered in DOM, resolve canonical permalink
        if (isGeneric && activeTab.url) {
          const postMatch = activeTab.url.match(/^(https?:\/\/[^\/]+(?:\/r\/[^\/]+)?\/comments\/[a-z0-9]+)/i);
          if (postMatch) {
            targetUrl = `${postMatch[1]}/_/${cleanId}/`;
          }
        }

        // Navigate current active Reddit tab
        if (targetUrl && activeTab.id) {
          if (activeTab.url === targetUrl && typeof chrome.tabs.reload === 'function') {
            await Promise.resolve(chrome.tabs.reload(activeTab.id)).catch(() => null);
          } else {
            await chrome.tabs.update(activeTab.id, { url: targetUrl });
          }
          return true;
        }
      }

      // If active tab wasn't on the Reddit thread, open in new tab
      if (isGeneric && permalink) {
        targetUrl = permalink;
      }
      if (targetUrl) {
        window.open(targetUrl, '_blank');
        return true;
      }
    } catch (e) {
      console.warn('Could not message content script, opening permalink directly:', e);
    }
  }

  // Fallback to direct window.open
  if (targetUrl || permalink) {
    window.open(targetUrl || permalink, '_blank');
    return true;
  }
  return false;
}
