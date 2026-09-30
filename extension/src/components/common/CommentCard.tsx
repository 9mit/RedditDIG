import React, { useState } from 'react';
import { ExternalLink, ArrowUp, ArrowDown, MessageSquare, Award, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { CommentSchema } from '../../types';
import { jumpToRedditComment } from '../../services/reddit';

interface CommentCardProps {
  comment: CommentSchema;
  badgeLabel?: string;
  compact?: boolean;
}

export const CommentCard: React.FC<CommentCardProps> = ({ comment, badgeLabel, compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [isJumping, setIsJumping] = useState(false);

  const handleJump = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsJumping(true);
    await jumpToRedditComment(comment.id, comment.permalink);
    setTimeout(() => setIsJumping(false), 1000);
  };

  const isLong = comment.body.length > 200;
  const displayBody = expanded || !isLong ? comment.body : `${comment.body.slice(0, 200)}...`;

  const effectiveAwardsCount = Math.max(
    typeof comment.awards_count === 'number' && comment.awards_count > 0 ? comment.awards_count : 0,
    (comment.awards_data || []).reduce((sum, a) => sum + (typeof a.count === 'number' && a.count > 0 ? a.count : 1), 0)
  );
  const hasKnownAwards = effectiveAwardsCount > 0;

  const awardsSummary = React.useMemo(() => {
    if (!comment.awards_data || comment.awards_data.length === 0) return '';
    const map = new Map<string, number>();
    for (const a of comment.awards_data) {
      const name = a.name || 'Award';
      map.set(name, (map.get(name) || 0) + (typeof a.count === 'number' && a.count > 0 ? a.count : 1));
    }
    const filteredEntries = Array.from(map.entries()).filter(([n]) => n !== 'Award' && n !== 'Reddit Award');
    if (filteredEntries.length === 0) return '';
    return filteredEntries.map(([n, cnt]) => (cnt > 1 ? `${cnt}x ${n}` : n)).join(', ');
  }, [comment.awards_data]);

  const stanceLabel = comment.stance === 'support' ? 'Agrees' : comment.stance === 'against' ? 'Disagrees' : 'Neutral';

  return (
    <article className="rdg-comment">
      {/* Meta row */}
      <div className="rdg-comment-meta">
        <span className="rdg-comment-author">u/{comment.author}</span>
        {comment.is_op && (
          <span className="rdg-badge rdg-badge-ai" style={{ fontSize: 9 }}>OP</span>
        )}
        {badgeLabel && (
          <span
            className={`rdg-badge ${badgeLabel === 'Disputed' ? 'rdg-badge-against' : 'rdg-badge-warning'}`}
            style={{ fontSize: 9, textTransform: 'uppercase' }}
          >
            {badgeLabel}
          </span>
        )}

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {comment.timestamp_display && comment.timestamp_display !== 'Timestamp unavailable' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-dim)', fontSize: 10 }}
              title={comment.timestamp_display}>
              <Clock size={10} />
              {comment.created_relative || comment.timestamp_display}
            </span>
          )}
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: comment.score < 0 ? 'var(--negative)' : comment.score === 0 ? 'var(--text-muted)' : 'var(--positive)',
            fontWeight: 600
          }}>
            {comment.score < 0 ? <ArrowDown size={11} /> : comment.score === 0 ? null : <ArrowUp size={11} />}{comment.score}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <MessageSquare size={11} />{comment.replies_count}
          </span>
          {hasKnownAwards && (
            <span
              style={{ display: 'flex', alignItems: 'center', gap: 2, color: 'var(--warning)' }}
              title={`${effectiveAwardsCount} ${effectiveAwardsCount === 1 ? 'award' : 'awards'}${
                awardsSummary ? `: ${awardsSummary}` : ''
              }`}
            >
              <Award size={11} />{effectiveAwardsCount}
            </span>
          )}
        </span>
      </div>

      {/* Body */}
      <div className="rdg-comment-body">{displayBody}</div>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 3, marginTop: 4, padding: 0
          }}
        >
          {expanded ? <>Less <ChevronUp size={10} /></> : <>More <ChevronDown size={10} /></>}
        </button>
      )}

      {/* Footer: Tags + Reddit link */}
      <div className="rdg-comment-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span className={`rdg-badge rdg-badge-${comment.stance === 'support' ? 'support' : comment.stance === 'against' ? 'against' : 'neutral'}`}>
            {stanceLabel}
          </span>
          {comment.comment_type && comment.comment_type !== 'opinion' && (
            <span className="rdg-badge rdg-badge-local">{comment.comment_type}</span>
          )}
          {comment.evidence_type && !['opinion', 'none', 'unclear'].includes(comment.evidence_type) && (
            <span className="rdg-badge rdg-badge-ai">{comment.evidence_type.replace('_', ' ')}</span>
          )}
          {comment.topics?.[0] && comment.topics[0] !== 'general' && (
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              #{comment.topics[0]}
            </span>
          )}
        </div>

        <button onClick={handleJump} disabled={isJumping} className="rdg-source-link">
          <span>{isJumping ? 'Locating...' : 'View on Reddit'}</span>
          <ExternalLink size={10} />
        </button>
      </div>
    </article>
  );
};
