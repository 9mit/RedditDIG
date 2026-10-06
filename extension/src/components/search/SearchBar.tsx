import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { SearchRequest } from '../../types';

interface SearchBarProps {
  request: SearchRequest;
  onChange: (req: SearchRequest) => void;
  /** Runs a search. Pass the request explicitly when it was just changed, because state updates are async. */
  onSearch: (req?: SearchRequest) => void;
  isSearching: boolean;
  onToggleFilter: () => void;
  hasActiveFilters: boolean;
  /** When false (Settings → Smart Meaning Search off) only exact keyword search is offered. */
  similarityEnabled?: boolean;
  filtersOpen?: boolean;
}

const ALL_MODES = [
  { id: 'hybrid', label: 'Smart' },
  { id: 'exact', label: 'Exact Word' },
  { id: 'similarity', label: 'Meaning' }
] as const;

export const SearchBar: React.FC<SearchBarProps> = ({
  request, onChange, onSearch, isSearching, onToggleFilter, hasActiveFilters,
  similarityEnabled = true, filtersOpen = false
}) => {
  const modes = similarityEnabled ? ALL_MODES : ALL_MODES.filter((m) => m.id === 'exact');
  const activeMode = similarityEnabled ? (request.mode || 'hybrid') : 'exact';

  const update = (patch: Partial<SearchRequest>) => {
    const next = { ...request, ...patch };
    onChange(next);
    onSearch(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); onSearch(request); }}
        style={{ display: 'flex', gap: 6 }}
      >
        <div className="rdg-input-with-icon" style={{ flex: 1 }}>
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            value={request.query || ''}
            onChange={(e) => onChange({ ...request, query: e.target.value })}
            placeholder="Search comments..."
            aria-label="Search comments"
            maxLength={300}
            className="rdg-input"
          />
        </div>

        <button
          type="button"
          onClick={onToggleFilter}
          className="rdg-btn rdg-btn-ghost"
          style={{
            borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${hasActiveFilters ? 'var(--royal-blue)' : 'var(--border-default)'}`,
            color: hasActiveFilters ? 'var(--royal-blue)' : 'var(--text-muted)',
            background: hasActiveFilters ? 'var(--royal-blue-dim)' : '#ffffff'
          }}
          title="Filters"
          aria-label={hasActiveFilters ? 'Filters (active)' : 'Filters'}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
        </button>

        <button type="submit" disabled={isSearching} className="rdg-btn rdg-btn-primary" style={{ padding: '7px 14px' }}>
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Mode + Sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div className="rdg-chip-group" role="group" aria-label="Search mode">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              className="rdg-chip"
              data-active={activeMode === m.id}
              aria-pressed={activeMode === m.id}
              onClick={() => update({ mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>

        <select
          value={request.sort_by || 'relevance'}
          onChange={(e) => update({ sort_by: e.target.value as SearchRequest['sort_by'] })}
          className="rdg-select"
          aria-label="Sort results"
        >
          <option value="relevance">Best Match</option>
          <option value="score">Most Upvotes</option>
          <option value="replies">Most Replies</option>
          <option value="date">Newest</option>
        </select>
      </div>
    </div>
  );
};
