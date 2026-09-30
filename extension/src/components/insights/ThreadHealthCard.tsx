import React from 'react';
import { Activity } from 'lucide-react';
import { HealthDashboardResponse } from '../../types';

interface Props {
  health: HealthDashboardResponse;
}

export const ThreadHealthCard: React.FC<Props> = ({ health }) => {
  return (
    <div className="rdg-card">
      <div className="rdg-card-header">
        <h3>
          <Activity size={13} style={{ color: 'var(--royal-blue)' }} />
          <span>Thread Stats</span>
        </h3>
      </div>
      <div className="rdg-card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <MetricCell label="Comments Read" value={health.comments_analyzed.toLocaleString()} />
          <MetricCell label="People Talking" value={health.distinct_participants.toLocaleString()} />
          <MetricCell label="Main Sides" value={String(health.major_viewpoints_count)} />
          <MetricCell label="Helpful Comments" value={String(health.useful_comments_count)} />
          <MetricCell label="Questions Asked" value={String(health.unresolved_questions_count)} />
          <MetricCell label="Disagreements" value={String(health.conflicting_claims_count)} />
        </div>

        {/* Coverage bar */}
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-surface, #f8fafc)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Coverage Breakdown</span>
            <span style={{ fontWeight: 700, color: 'var(--royal-blue)' }}>{health.coverage_percentage}%</span>
          </div>
          <div className="rdg-bar-track" style={{ height: 6 }}>
            <div className="rdg-bar-fill rdg-bar-fill-blue" style={{ width: `${health.coverage_percentage}%` }} />
          </div>
          {health.coverage ? (
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
              <div>• <strong>{health.comments_analyzed}</strong> analyzed of <strong>{health.coverage.expected_comments || health.comments_analyzed}</strong> reported</div>
              {health.coverage.unavailable_comments > 0 ? (
                <div>• ~<strong>{health.coverage.unavailable_comments}</strong> comments unavailable (collapsed, author-deleted, or filtered by moderation)</div>
              ) : health.coverage.removed_or_deleted_comments > 0 ? (
                <div>• <strong>{health.coverage.removed_or_deleted_comments}</strong> comments were removed or deleted by author/moderator</div>
              ) : null}
            </div>
          ) : health.comments_unavailable > 0 ? (
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 5 }}>
              ~{health.comments_unavailable} comments unexpanded or unavailable.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const MetricCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{
    background: '#ffffff', border: '1.5px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)', padding: '8px 10px'
  }}>
    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
      {value}
    </div>
    <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>
      {label}
    </div>
  </div>
);
