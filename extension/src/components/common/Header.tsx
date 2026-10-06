import React from 'react';
import { RefreshCw, Play, ExternalLink, Settings, X, Info } from 'lucide-react';
import { ThreadIntelligenceEnvelope } from '../../types';
import { MainLogo } from './MainLogo';
import { toSafeRedditUrl } from '../../services/url';

function getVersion(): string {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : '';
  } catch {
    return '';
  }
}

interface HeaderProps {
  thread: ThreadIntelligenceEnvelope | null;
  isLoading: boolean;
  statusStep: string;
  progress: number;
  onAnalyze: (forceRefresh?: boolean) => void;
  onCancel?: () => void;
  onOpenSettings?: () => void;
  activeUrl: string;
  /** False when the active tab is not a Reddit thread (Analyze is disabled with an explanation). */
  canAnalyze?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  thread, isLoading, statusStep, progress,
  onAnalyze, onCancel, onOpenSettings, activeUrl, canAnalyze = true
}) => {
  const safeThreadUrl = thread ? toSafeRedditUrl(thread.url) : null;
  const version = getVersion();
  return (
    <header className="rdg-header">
      {/* Top bar: Logo + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MainLogo size={24} />
          <div>
            <h1 style={{
              fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em',
              color: 'var(--text-primary)', lineHeight: 1
            }}>
              Reddit<span style={{ color: 'var(--royal-blue)' }}>DIG</span>
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rdg-btn-ghost"
              title="Settings"
              aria-label="Settings"
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              <Settings size={14} aria-hidden="true" />
            </button>
          )}

          {isLoading && onCancel ? (
            <button type="button" onClick={onCancel} className="rdg-btn rdg-btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
              <X size={12} aria-hidden="true" />
              <span>Cancel</span>
            </button>
          ) : thread ? (
            <button
              type="button"
              onClick={() => onAnalyze(true)}
              disabled={isLoading || !canAnalyze}
              className="rdg-btn rdg-btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px' }}
              title={canAnalyze ? 'Re-analyze the current tab' : 'Open a Reddit post in the active tab to refresh'}
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAnalyze(false)}
              disabled={isLoading || !canAnalyze}
              className="rdg-btn rdg-btn-primary"
              style={{ fontSize: 11, padding: '5px 12px' }}
              title={canAnalyze ? 'Read this post' : 'Open a Reddit post in the active tab to analyze'}
            >
              <Play size={12} aria-hidden="true" />
              <span>Analyze</span>
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="rdg-loader" style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="rdg-loader-step" role="status" aria-live="polite">
              <RefreshCw size={11} className="animate-spin" aria-hidden="true" />
              {statusStep || 'Processing...'}
            </span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {progress}%
            </span>
          </div>
          <div
            className="rdg-progress-track"
            role="progressbar"
            aria-label="Analysis progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div className="rdg-progress-fill" style={{ width: `${Math.max(progress, 3)}%` }} />
          </div>
        </div>
      )}

      {/* Thread info when loaded */}
      {thread && !isLoading && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-dim)' }}>
          {safeThreadUrl ? (
            <a
              href={safeThreadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rdg-line-clamp-2 rdg-thread-link"
              title="Open thread on Reddit"
              style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 4,
                textDecoration: 'none'
              }}
            >
              <span>{thread.title}</span>
              <ExternalLink size={10} style={{ flexShrink: 0, marginTop: 2, opacity: 0.55 }} aria-hidden="true" />
            </a>
          ) : (
            <div className="rdg-line-clamp-2" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {thread.title}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
            flexWrap: 'wrap'
          }}>
            <span style={{ color: 'var(--royal-blue)', fontWeight: 600 }}>r/{thread.subreddit}</span>
            <span>·</span>
            {thread.coverage && thread.coverage.expected_comments && thread.coverage.unavailable_comments > 0 ? (
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{thread.total_analyzed.toLocaleString()}</strong> of{' '}
                <strong>{thread.coverage.expected_comments.toLocaleString()}</strong> comments
              </span>
            ) : (
              <span>{thread.total_analyzed.toLocaleString()} comments</span>
            )}
            <span>·</span>
            <span>{thread.unique_participants.toLocaleString()} people</span>
            {thread.coverage && thread.coverage.expected_comments && thread.coverage.unavailable_comments > 0 ? (
              <span
                className={`rdg-badge ${thread.coverage.coverage_percentage >= 95 ? 'rdg-badge-ai' : 'rdg-badge-warning'}`}
                style={{
                  marginLeft: 'auto',
                  cursor: 'help',
                  ...(thread.coverage.coverage_percentage >= 95 ? {
                    background: 'var(--positive-dim)',
                    color: 'var(--positive)',
                    borderColor: 'transparent'
                  } : {})
                }}
                title={thread.coverage.explanation}
              >
                {thread.coverage.coverage_percentage}% coverage{thread.coverage.unavailable_comments > 0 ? ` (~${thread.coverage.unavailable_comments.toLocaleString()} ${thread.coverage.coverage_percentage >= 95 ? 'deleted/filtered' : 'unexpanded/filtered'})` : ''}
              </span>
            ) : thread.is_truncated ? (
              <span className="rdg-badge rdg-badge-warning" style={{ marginLeft: 'auto' }}>Partial read</span>
            ) : (
              <span
                className="rdg-badge rdg-badge-ai"
                style={{ marginLeft: 'auto', background: 'var(--positive-dim)', color: 'var(--positive)', borderColor: 'transparent', cursor: 'help' }}
                title={thread.coverage?.explanation || 'All available comments analyzed'}
              >
                100% read
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pre-analysis state */}
      {!thread && !isLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 6, fontSize: 11, color: 'var(--text-dim)'
        }}>
          <span className="rdg-truncate" style={{ maxWidth: 230 }}>
            {activeUrl ? activeUrl.replace('https://', '') : 'Open any Reddit post to start'}
          </span>
          {version && <span className="rdg-version">v{version}</span>}
        </div>
      )}
    </header>
  );
};
