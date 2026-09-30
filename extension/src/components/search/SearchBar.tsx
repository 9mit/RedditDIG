import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { SearchRequest } from '../../types';

interface SearchBarProps {
  request: SearchRequest;
  onChange: (req: SearchRequest) => void;
  onSearch: () => void;
  isSearching: boolean;
  onToggleFilter: () => void;
  hasActiveFilters: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  request, onChange, onSearch, isSearching, onToggleFilter, hasActiveFilters
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <form
        onSubmit={(e) => { e.preventDefault(); onSearch(); }}
        style={{ display: 'flex', gap: 6 }}
      >
        <div className="rdg-input-with-icon" style={{ flex: 1 }}>
          <Search size={13} />
          <input
            type="text"
            value={request.query || ''}
            onChange={(e) => onChange({ ...request, query: e.target.value })}
            placeholder="Search comments..."
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
        >
          <SlidersHorizontal size={13} />
        </button>

        <button type="submit" disabled={isSearching} className="rdg-btn rdg-btn-primary" style={{ padding: '7px 14px' }}>
          {isSearching ? '...' : 'Search'}
        </button>
      </form>

      {/* Mode + Sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="rdg-chip-group">
          {[
            { id: 'hybrid', label: 'Smart' },
            { id: 'exact', label: 'Exact Word' },
            { id: 'similarity', label: 'Meaning' }
          ].map((m) => (
            <button
              key={m.id}
              className="rdg-chip"
              data-active={(request.mode || 'hybrid') === m.id}
              onClick={() => { onChange({ ...request, mode: m.id as any }); setTimeout(onSearch, 10); }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <select
          value={request.sort_by || 'relevance'}
          onChange={(e) => { onChange({ ...request, sort_by: e.target.value as any }); setTimeout(onSearch, 10); }}
          className="rdg-select"
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
