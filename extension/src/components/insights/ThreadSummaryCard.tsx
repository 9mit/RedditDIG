import React from 'react';
import { Sparkles, AlertCircle, ArrowRight, Settings, Check, X, HelpCircle } from 'lucide-react';
import { SummaryResponse } from '../../types';
import { jumpToRedditComment } from '../../services/reddit';

interface ThreadSummaryCardProps {
  summary: SummaryResponse;
  onOpenSettings?: () => void;
}

export const ThreadSummaryCard: React.FC<ThreadSummaryCardProps> = ({ summary, onOpenSettings }) => {
  if (summary.ai_error || !summary.overview) {
    return (
      <div className="rdg-card" style={{ borderColor: 'var(--warning-border)' }}>
        <div className="rdg-card-header">
          <h3>
            <AlertCircle size={13} style={{ color: 'var(--warning)' }} />
            <span>Thread Summary</span>
          </h3>
          <span className="rdg-badge rdg-badge-warning">Unavailable</span>
        </div>
        <div className="rdg-card-body">
          <p style={{ fontSize: 12, color: 'var(--warning)', lineHeight: 1.6 }}>
            {summary.ai_error || 'Thread summary is currently unavailable.'}
          </p>
          {onOpenSettings && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Comments and search are still fully active.</span>
              <button onClick={onOpenSettings} className="rdg-btn rdg-btn-secondary" style={{ fontSize: 10, padding: '3px 8px' }}>
                <Settings size={10} /> Settings
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rdg-card">
      <div className="rdg-card-header">
        <h3>
          <Sparkles size={13} style={{ color: 'var(--royal-blue)' }} />
          <span>Quick Summary</span>
        </h3>
        <span className="rdg-badge rdg-badge-ai" style={{ display: 'none' }} aria-hidden="true">{summary.is_ai_generated ? 'AI Summary' : 'Local NLP'}</span>
      </div>
      <div className="rdg-card-body">
        {/* Overview */}
        <p style={{
          fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-primary)',
          padding: '10px 12px', background: 'var(--bg-surface)',
          border: '1.5px solid var(--border-default)', borderRadius: 'var(--radius-md)',
          wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0, maxWidth: '100%',
          boxSizing: 'border-box', overflow: 'hidden'
        }}>
          {summary.overview}
        </p>

        {/* Key Points */}
        {summary.key_takeaways?.length > 0 && (
          <div>
            <div className="rdg-section-label">Key Points</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {summary.key_takeaways.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--royal-blue)', marginTop: 2, flexShrink: 0, fontWeight: 700 }}>•</span>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {t.text}
                    {t.comment_ids?.length > 0 && (
                      <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6 }}>
                        {t.comment_ids.map((cid, ci) => (
                          <button key={ci} onClick={() => jumpToRedditComment(cid)} className="rdg-source-link" style={{ fontSize: 9 }}>
                            [{ci + 1}] <ArrowRight size={7} />
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agreement */}
        {summary.what_agree_on?.length > 0 && (
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-dim)' }}>
            <div className="rdg-section-label" style={{ color: 'var(--positive)' }}>What People Agree On</div>
            {summary.what_agree_on.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <Check size={12} style={{ color: 'var(--positive)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ lineHeight: 1.5, flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Disagreement */}
        {summary.what_disagree_on?.length > 0 && (
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-dim)' }}>
            <div className="rdg-section-label" style={{ color: 'var(--negative)' }}>Where People Clash</div>
            {summary.what_disagree_on.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <X size={12} style={{ color: 'var(--negative)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ lineHeight: 1.5, flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Unresolved */}
        {summary.unresolved_questions?.length > 0 && (
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-dim)' }}>
            <div className="rdg-section-label" style={{ color: 'var(--warning)' }}>Unanswered Questions</div>
            {summary.unresolved_questions.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <HelpCircle size={12} style={{ color: 'var(--warning)', marginTop: 2, flexShrink: 0 }} />
                <span style={{ lineHeight: 1.5, flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
