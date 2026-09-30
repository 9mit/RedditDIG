import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { ContradictionItem } from '../../types';
import { jumpToRedditComment } from '../../services/reddit';

interface Props {
  contradictions: ContradictionItem[];
}

export const ContradictionDetector: React.FC<Props> = ({ contradictions }) => {
  if (!contradictions || contradictions.length === 0) {
    return (
      <div className="rdg-card">
        <div className="rdg-card-header">
          <h3>
            <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />
            <span>Direct Disagreements</span>
          </h3>
        </div>
        <div className="rdg-card-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
            No major disagreements found in this thread.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rdg-card">
      <div className="rdg-card-header">
        <h3>
          <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />
          <span>Direct Disagreements</span>
        </h3>
        <span className="rdg-badge rdg-badge-ai">{contradictions.length} clash{contradictions.length > 1 ? 'es' : ''}</span>
      </div>
      <div className="rdg-card-body">
        {contradictions.map((c, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-surface)', border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', padding: '10px 12px'
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              {c.topic}
              {c.is_direct_contradiction && (
                <span className="rdg-badge rdg-badge-against" style={{ marginLeft: 6, fontSize: 9 }}>Direct clash</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Claim A */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 8px', background: 'var(--positive-dim)',
                border: '1px solid var(--positive-border)', borderRadius: 'var(--radius-sm)'
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--positive)', flexShrink: 0 }}>Side A</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{c.claim_a}</span>
                {c.sample_a_ids?.[0] && (
                  <button onClick={() => jumpToRedditComment(c.sample_a_ids[0])} className="rdg-source-link" style={{ flexShrink: 0 }}>
                    <span>Source</span>
                    <ExternalLink size={9} />
                  </button>
                )}
              </div>

              {/* VS divider */}
              <div style={{ textAlign: 'center', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.1em' }}>
                VS
              </div>

              {/* Claim B */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 8px', background: 'var(--negative-dim)',
                border: '1px solid var(--negative-border)', borderRadius: 'var(--radius-sm)'
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--negative)', flexShrink: 0 }}>Side B</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{c.claim_b}</span>
                {c.sample_b_ids?.[0] && (
                  <button onClick={() => jumpToRedditComment(c.sample_b_ids[0])} className="rdg-source-link" style={{ flexShrink: 0 }}>
                    <span>Source</span>
                    <ExternalLink size={9} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
