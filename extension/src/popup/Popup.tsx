import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, MessageSquare, Compass } from 'lucide-react';
import { isRedditUrl } from '../services/reddit';
import { extractSubredditFromUrl } from '../services/url';
import { MainLogo } from '../components/common/MainLogo';

export const Popup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab) setActiveTab(tab);
      }).catch(() => {});
    }
  }, []);

  const handleOpenSidePanel = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action: 'OPEN_SIDEPANEL', tabId: activeTab?.id }).catch(() => {});
      window.close();
    }
  };

  const isReddit = activeTab?.url ? isRedditUrl(activeTab.url) : false;
  const subredditName = activeTab?.url ? extractSubredditFromUrl(activeTab.url) : null;

  const displayTitle = activeTab?.title
    ? activeTab.title.replace(/\s*:\s*r\/[^\s]+.*$/i, '').replace(/\s*-\s*Reddit.*$/i, '').trim()
    : 'Reddit Discussion';

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

  return (
    <div className="redditdig-popup-container" role="dialog" aria-label="RedditDIG extension launcher">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1.5px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MainLogo size={22} />
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Reddit<span style={{ color: 'var(--royal-blue)' }}>DIG</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--positive)' }} aria-hidden="true" />
          Ready
        </div>
      </div>

      {/* Active Page Card */}
      {isReddit ? (
        <div style={{
          background: '#ffffff', padding: 12, borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 8,
          boxShadow: 'var(--shadow-card)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {subredditName && (
              <span className="rdg-badge rdg-badge-ai">r/{subredditName}</span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--positive)', fontWeight: 600, marginLeft: 'auto' }}>
              <CheckCircle2 size={11} aria-hidden="true" /> Reddit post detected
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.4 }} className="rdg-line-clamp-2">
            {displayTitle}
          </p>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--text-muted)' }}>
            <MessageSquare size={10} aria-hidden="true" /> Ready to read comments
          </span>
        </div>
      ) : (
        <div style={{
          background: '#ffffff', padding: 12, borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--border-default)', display: 'flex', alignItems: 'flex-start', gap: 10,
          boxShadow: 'var(--shadow-card)'
        }}>
          <Compass size={18} style={{ color: 'var(--royal-blue)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
              Open a Reddit post
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Go to any Reddit discussion to see what people are saying.
            </div>
          </div>
        </div>
      )}

      {/* Action */}
      <button
        type="button"
        onClick={handleOpenSidePanel}
        className="rdg-btn rdg-btn-primary"
        style={{ width: '100%', padding: '10px 14px', fontSize: 12 }}
      >
        <span>{isReddit ? 'Read Discussion in Side Panel' : 'Open Side Panel'}</span>
        <ArrowRight size={13} aria-hidden="true" />
      </button>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, borderTop: '1px solid var(--border-dim)', fontSize: 10.5, color: 'var(--text-muted)' }}>
        <span>Keyboard shortcut:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 10 }} aria-label={`Shortcut: ${isMac ? 'Command' : 'Control'}+Shift+L`}>
          <span className="redditdig-kbd">{isMac ? 'Cmd' : 'Ctrl'}</span>
          <span>+</span>
          <span className="redditdig-kbd">Shift</span>
          <span>+</span>
          <span className="redditdig-kbd">L</span>
        </div>
      </div>
    </div>
  );
};
