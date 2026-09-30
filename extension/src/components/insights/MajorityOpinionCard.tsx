import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ViewpointItem, ConsensusResponse } from '../../types';
import { CommentCard } from '../common/CommentCard';

interface MajorityOpinionCardProps {
  viewpoints: ViewpointItem[];
  consensus: ConsensusResponse;
}

export const MajorityOpinionCard: React.FC<MajorityOpinionCardProps> = ({ viewpoints, consensus }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const getConsensusStyle = () => {
    if (consensus.is_true_majority) {
      return consensus.label.toLowerCase().includes('strong')
        ? { color: 'var(--positive)', bg: 'var(--positive-dim)', border: 'var(--positive-border)' }
        : { color: 'var(--royal-blue)', bg: 'var(--royal-blue-dim)', border: 'var(--royal-blue-border)' };
    }
    if (consensus.label.toLowerCase().includes('plurality'))
      return { color: 'var(--warning)', bg: 'var(--warning-dim)', border: 'var(--warning-border)' };
    return { color: 'var(--negative)', bg: 'var(--negative-dim)', border: 'var(--negative-border)' };
  };

  const getSimpleConsensusLabel = () => {
    const l = consensus.label.toLowerCase();
    if (l.includes('strong majority')) return 'Clear Majority';
    if (l.includes('majority')) return 'Most Agree';
    if (l.includes('plurality')) return 'Split Opinions';
    if (l.includes('polarized') || l.includes('divided')) return 'Heated Debate';
    return consensus.label;
  };

  const getBarClass = (label: string) => {
    if (label.toLowerCase().includes('support') || label.toLowerCase().includes('agree')) return 'rdg-bar-fill-green';
    if (label.toLowerCase().includes('against') || label.toLowerCase().includes('disagree')) return 'rdg-bar-fill-red';
    return 'rdg-bar-fill-blue';
  };

  const cs = getConsensusStyle();

  return (
    <div className="rdg-card">
      <div className="rdg-card-header">
        <h3>What People Think</h3>
        <span className="rdg-badge" style={{
          background: cs.bg, color: cs.color,
          border: `1px solid ${cs.border}`,
          fontWeight: 700
        }}>
          {getSimpleConsensusLabel()}
        </span>
      </div>

      <div className="rdg-card-body">
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {consensus.rationale}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {viewpoints.map((vp, idx) => {
            const isOpen = expandedIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${isOpen ? 'var(--royal-blue)' : 'var(--border-default)'}`,
                  cursor: 'pointer', transition: 'border-color 0.12s'
                }}
                onClick={() => setExpandedIdx(isOpen ? null : idx)}
              >
                <div style={{ padding: '10px 12px' }}>
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{vp.label}</span>
                      {vp.is_majority && (
                        <span className="rdg-badge rdg-badge-support" style={{ fontSize: 9 }}>
                          MOST AGREE · {vp.user_share}%
                        </span>
                      )}
                      {vp.is_plurality && !vp.is_majority && (
                        <span className="rdg-badge rdg-badge-warning" style={{ fontSize: 9 }}>
                          TOP PICK · {vp.user_share}%
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      <span>{vp.unique_users} people</span>
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="rdg-bar-track">
                    <div className={`rdg-bar-fill ${getBarClass(vp.label)}`} style={{ width: `${Math.max(vp.user_share, 3)}%` }} />
                  </div>

                  {/* Dual metrics */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 6
                  }}>
                    <span>
                      <strong style={{ color: 'var(--text-primary)' }}>{vp.user_share}% of people</strong>
                      {' · '}{vp.comments_count} comments
                    </span>
                    <span>
                      Average score:{' '}
                      <span style={{ color: vp.median_score < 0 ? 'var(--negative)' : 'var(--positive)', fontWeight: 600 }}>
                        {vp.median_score > 0 ? `+${vp.median_score}` : vp.median_score}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border-dim)', marginTop: 0 }}>
                    {vp.strongest_supporting_arg && (
                      <div style={{
                        marginTop: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--royal-blue-dim)', border: '1px solid var(--royal-blue-border)'
                      }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--royal-blue)', fontWeight: 700, marginBottom: 3 }}>
                          Main Argument
                        </div>
                        <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{vp.strongest_supporting_arg}..."
                        </p>
                      </div>
                    )}

                    {vp.representative_comments?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div className="rdg-section-label">Top Examples</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {vp.representative_comments.map((rep) => (
                            <CommentCard key={rep.id} comment={rep} compact />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
