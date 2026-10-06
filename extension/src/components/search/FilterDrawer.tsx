import React, { useId } from 'react';
import { X } from 'lucide-react';
import { SearchRequest } from '../../types';

interface FilterDrawerProps {
  request: SearchRequest;
  onChange: (req: SearchRequest) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  request, onChange, onApply, onReset, onClose
}) => {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const parseScore = (value: string): number | undefined => {
    if (value.trim() === '') return undefined;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <div
      style={{
        background: '#ffffff', border: '1.5px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', padding: 12
      }}
      className="animate-fade-in"
      role="group"
      aria-label="Filter comments"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Filter Comments
        </span>
        <button type="button" onClick={onClose} className="rdg-btn-ghost" style={{ padding: 3 }} aria-label="Close filters" title="Close filters">
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Username */}
        <div className="rdg-filter-row">
          <label className="rdg-filter-label" htmlFor={id('user')}>By Username</label>
          <input
            id={id('user')}
            type="text"
            value={request.username || ''}
            onChange={(e) => onChange({ ...request, username: e.target.value })}
            placeholder="u/username"
            autoComplete="off"
            maxLength={50}
            className="rdg-input"
            style={{ fontSize: 11 }}
          />
        </div>

        {/* Min Score */}
        <div className="rdg-filter-row">
          <label className="rdg-filter-label" htmlFor={id('score')}>Minimum Upvotes</label>
          <input
            id={id('score')}
            type="number"
            inputMode="numeric"
            value={request.min_score ?? ''}
            onChange={(e) => onChange({ ...request, min_score: parseScore(e.target.value) })}
            placeholder="0"
            className="rdg-input"
            style={{ fontSize: 11, width: 80 }}
          />
        </div>

        {/* Stance */}
        <div className="rdg-filter-row">
          <label className="rdg-filter-label" htmlFor={id('stance')}>Stance (Agree or Disagree)</label>
          <select
            id={id('stance')}
            value={request.stance || 'all'}
            onChange={(e) => onChange({ ...request, stance: e.target.value })}
            className="rdg-select" style={{ width: '100%' }}
          >
            <option value="all">Any stance</option>
            <option value="support">Agrees</option>
            <option value="against">Disagrees</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        {/* Comment Type */}
        <div className="rdg-filter-row">
          <label className="rdg-filter-label" htmlFor={id('type')}>Comment Type</label>
          <select
            id={id('type')}
            value={request.comment_type || 'all'}
            onChange={(e) => onChange({ ...request, comment_type: e.target.value })}
            className="rdg-select" style={{ width: '100%' }}
          >
            <option value="all">Any type</option>
            <option value="recommendation">Recommendation / Tip</option>
            <option value="experience">Personal Experience</option>
            <option value="counterargument">Counterargument / Pushback</option>
            <option value="question">Question</option>
            <option value="evidence">Evidence / Facts</option>
          </select>
        </div>

        {/* Evidence Type */}
        <div className="rdg-filter-row">
          <label className="rdg-filter-label" htmlFor={id('evidence')}>Proof / Backing</label>
          <select
            id={id('evidence')}
            value={request.evidence_type || 'all'}
            onChange={(e) => onChange({ ...request, evidence_type: e.target.value })}
            className="rdg-select" style={{ width: '100%' }}
          >
            <option value="all">Any kind</option>
            <option value="evidence_backed">With Sources / Links</option>
            <option value="personal_experience">Personal Story</option>
            <option value="speculation">Guess / Theory</option>
            <option value="opinion">Just Opinion</option>
          </select>
        </div>

        {/* Top-level only */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={request.top_level_only || false}
            onChange={(e) => onChange({ ...request, top_level_only: e.target.checked })}
            style={{ accentColor: 'var(--royal-blue)' }}
          />
          Direct replies to post only (ignore deeper threads)
        </label>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onReset} className="rdg-btn rdg-btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }}>
          Reset
        </button>
        <button type="button" onClick={onApply} className="rdg-btn rdg-btn-primary" style={{ fontSize: 11, padding: '5px 14px' }}>
          Apply Filters
        </button>
      </div>
    </div>
  );
};
