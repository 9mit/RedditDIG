import React, { useState } from 'react';
import { Flame, Lightbulb, MessageCircle, Gem, AlertTriangle, Trophy } from 'lucide-react';
import { CommentRankingsResponse } from '../../types';
import { CommentCard } from '../common/CommentCard';

interface CommentRankingsProps {
  rankings: CommentRankingsResponse;
}

type Category = 'popular' | 'supported' | 'gem' | 'discussed' | 'disputed' | 'rewarded';

const categories: Array<{ id: Category; label: string; icon: any; color: string }> = [
  { id: 'popular', label: 'Most Upvoted', icon: Flame, color: 'var(--warning)' },
  { id: 'supported', label: 'Best Proof', icon: Lightbulb, color: 'var(--royal-blue)' },
  { id: 'gem', label: 'Hidden Gem', icon: Gem, color: 'var(--purple)' },
  { id: 'discussed', label: 'Most Replies', icon: MessageCircle, color: 'var(--text-secondary)' },
  { id: 'disputed', label: 'Disputed', icon: AlertTriangle, color: 'var(--negative)' },
  { id: 'rewarded', label: 'Most Awards', icon: Trophy, color: 'var(--warning)' },
];

export const CommentRankings: React.FC<CommentRankingsProps> = ({ rankings }) => {
  const [active, setActive] = useState<Category>('popular');

  const renderContent = () => {
    switch (active) {
      case 'popular':
        return rankings.most_popular
          ? <CommentCard comment={rankings.most_popular} badgeLabel="Most Upvoted" />
          : <EmptySlot text="No comments found yet." />;
      case 'supported':
        return rankings.best_supported
          ? <>
              <Explanation text={rankings.best_supported_reason} />
              <CommentCard comment={rankings.best_supported} badgeLabel="Best Proof" />
            </>
          : <EmptySlot text="No comments with strong proof identified yet." />;
      case 'gem':
        return rankings.hidden_gem
          ? <>
              <Explanation text={rankings.hidden_gem_reason} />
              <CommentCard comment={rankings.hidden_gem} badgeLabel="Hidden Gem" />
            </>
          : <EmptySlot text="No hidden gems found. (These are high-quality comments buried deep in replies)." />;
      case 'discussed':
        return rankings.most_discussed
          ? <CommentCard comment={rankings.most_discussed} badgeLabel="Most Replies" />
          : <EmptySlot text="No reply chains found." />;
      case 'disputed':
        return rankings.questionable_suggestion
          ? <>
              <Explanation text={rankings.questionable_reason} />
              <CommentCard comment={rankings.questionable_suggestion} badgeLabel="Disputed" />
            </>
          : <EmptySlot text="No heavily disputed comments found." />;
      case 'rewarded':
        if (rankings.most_rewarded) {
          const directCount = typeof rankings.most_rewarded.awards_count === 'number' && rankings.most_rewarded.awards_count > 0
            ? rankings.most_rewarded.awards_count
            : 0;
          const dataCount = (rankings.most_rewarded.awards_data || []).reduce(
            (sum, a) => sum + (typeof a.count === 'number' && a.count > 0 ? a.count : 1),
            0
          );
          const awardCount = Math.max(directCount, dataCount) || 1;
          const awardWord = awardCount === 1 ? 'award' : 'awards';
          const defaultReason = `Recognized by the community with ${awardCount} ${awardWord}.`;
          return (
            <>
              <Explanation text={rankings.most_rewarded_reason || defaultReason} />
              <CommentCard comment={rankings.most_rewarded} badgeLabel="Most Awards" />
            </>
          );
        }

        if (rankings.reward_data_available) {
          return <EmptySlot text="No comments have received awards in this thread." />;
        }

        return <EmptySlot text="Awards are not displayed on this version of Reddit." />;
    }
  };

  return (
    <div className="rdg-card">
      <div className="rdg-card-header">
        <h3>Top Comments by Category</h3>
      </div>
      <div className="rdg-card-body">
        {/* Category chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Ranking categories">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = active === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActive(cat.id)}
                className="rdg-chip"
                data-active={isActive}
                aria-pressed={isActive}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon size={12} style={{ color: isActive ? '#ffffff' : cat.color }} aria-hidden="true" />
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12 }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

const EmptySlot: React.FC<{ text: string }> = ({ text }) => (
  <p style={{
    fontSize: 12, color: 'var(--text-muted)',
    padding: '16px 0', textAlign: 'center'
  }}>
    {text}
  </p>
);

const Explanation: React.FC<{ text: string }> = ({ text }) => (
  text ? (
    <p style={{
      fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)',
      lineHeight: 1.5, marginBottom: 8, padding: '6px 10px',
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-dim)'
    }}>
      {text}
    </p>
  ) : null
);
