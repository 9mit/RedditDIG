import React from 'react';
import { Layers, ExternalLink } from 'lucide-react';
import { VerticalInsightsResponse } from '../../types';
import { jumpToRedditComment } from '../../services/reddit';

interface Props {
  vertical: VerticalInsightsResponse;
}

export const VerticalIntelligenceCard: React.FC<Props> = ({ vertical }) => {
  if (!vertical.is_specialized) return null;

  const sections = [
    { label: 'Top Recommendations', items: vertical.recommendations, color: 'var(--positive)' },
    { label: 'The Good (Pros)', items: vertical.pros, color: 'var(--positive)' },
    { label: 'The Bad (Cons)', items: vertical.cons, color: 'var(--negative)' },
    { label: 'Other Choices Mentioned', items: vertical.alternatives, color: 'var(--royal-blue)' },
  ].filter(s => s.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="rdg-card">
      <div className="rdg-card-header">
        <h3>
          <Layers size={13} style={{ color: 'var(--royal-blue)' }} />
          <span>{vertical.category} Tips</span>
        </h3>
        <span className="rdg-badge rdg-badge-ai">Tips found</span>
      </div>
      <div className="rdg-card-body">
        {sections.map((section, idx) => (
          <div key={idx} style={{ marginTop: idx > 0 ? 12 : 0 }}>
            <div className="rdg-section-label" style={{ color: section.color }}>{section.label}</div>
            {section.items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6
              }}>
                <span style={{ color: section.color, marginTop: 1, fontWeight: 700 }}>•</span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {item.text}
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: item.score < 0 ? 'var(--negative)' : 'var(--text-muted)',
                    marginLeft: 6
                  }}>
                    {item.score > 0 ? `+${item.score}` : item.score}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => jumpToRedditComment(item.comment_id)}
                  className="rdg-source-link"
                  style={{ flexShrink: 0 }}
                  aria-label="View source comment on Reddit"
                >
                  <span>View</span>
                  <ExternalLink size={9} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
