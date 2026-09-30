import React, { useState, useMemo } from 'react';
import { Users, Search, ArrowUp, ArrowDown, MessageSquare, Crown } from 'lucide-react';
import { ParticipantItem, QuestionResolutionResponse, OPInteractionResponse } from '../../types';
import { CommentCard } from '../common/CommentCard';

interface Props {
  participants: ParticipantItem[];
  resolution: QuestionResolutionResponse;
  opInteraction: OPInteractionResponse;
}

type SortKey = 'comments' | 'score' | 'replies';

export const ParticipantAnalytics: React.FC<Props> = ({ participants, resolution, opInteraction }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('comments');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = [...participants];
    if (search.trim()) {
      const q = search.toLowerCase().replace(/^u\//, '');
      list = list.filter(p => p.username.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortBy === 'score') return b.total_score - a.total_score;
      if (sortBy === 'replies') return b.replies_count - a.replies_count;
      return b.comments_count - a.comments_count;
    });
    return list.slice(0, 50);
  }, [participants, search, sortBy]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* OP Interaction card */}
      {opInteraction.op_username && opInteraction.op_username !== '[deleted]' && (
        <div className="rdg-card">
          <div className="rdg-card-header">
            <h3>
              <Crown size={13} style={{ color: 'var(--royal-blue)' }} />
              <span>Original Poster (OP)</span>
            </h3>
            <span className="rdg-badge rdg-badge-ai">{resolution.status}</span>
          </div>
          <div className="rdg-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <MetricBox label="Comments" value={String(opInteraction.comments_made)} />
              <MetricBox label="Replies" value={String(opInteraction.replies_received)} />
              <MetricBox label="Topics" value={String(opInteraction.topics_followed.length)} />
            </div>
            {resolution.reason && (
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>
                {resolution.reason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Participant list */}
      <div className="rdg-card">
        <div className="rdg-card-header">
          <h3>
            <Users size={13} style={{ color: 'var(--royal-blue)' }} />
            <span>People in Discussion ({participants.length})</span>
          </h3>
        </div>
        <div className="rdg-card-body">
          {/* Search + sort */}
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="rdg-input-with-icon" style={{ flex: 1 }}>
              <Search size={12} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find username..."
                className="rdg-input"
                style={{ fontSize: 11 }}
              />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="rdg-select">
              <option value="comments">Most Comments</option>
              <option value="score">Highest Score</option>
              <option value="replies">Most Replies</option>
            </select>
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 440, overflowY: 'auto', marginTop: 8 }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                Nobody found matching "{search}"
              </p>
            )}
            {filtered.map((p) => {
              const isOpen = expandedUser === p.username;
              return (
                <div
                  key={p.username}
                  style={{
                    border: '1.5px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    flexShrink: 0,
                    minHeight: 40,
                    background: '#ffffff'
                  }}
                >
                  <div
                    className="rdg-participant"
                    style={{ border: 'none' }}
                    onClick={() => setExpandedUser(isOpen ? null : p.username)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--royal-blue)' }} className="rdg-truncate">
                          u/{p.username}
                        </span>
                        {p.is_op && <span className="rdg-badge rdg-badge-ai" style={{ fontSize: 8 }}>OP</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <MessageSquare size={10} />{p.comments_count}
                      </span>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        color: p.total_score < 0 ? 'var(--negative)' : p.total_score === 0 ? 'var(--text-muted)' : 'var(--positive)',
                        fontWeight: 600
                      }}>
                        {p.total_score < 0 ? <ArrowDown size={10} /> : p.total_score === 0 ? null : <ArrowUp size={10} />}{p.total_score}
                      </span>
                    </div>
                  </div>

                  {isOpen && p.highest_scoring_comment && (
                    <div style={{ padding: '8px 10px 10px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-dim)' }} className="animate-fade-in">
                      <div className="rdg-section-label" style={{ marginBottom: 4 }}>Top Comment by u/{p.username}</div>
                      <CommentCard comment={p.highest_scoring_comment} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{
    background: '#ffffff', border: '1.5px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)', padding: '6px 8px', textAlign: 'center'
  }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</div>
  </div>
);
