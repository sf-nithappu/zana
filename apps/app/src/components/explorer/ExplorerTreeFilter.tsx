import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ExplorerTreeFilterProps {
  query: string;
  matchCount: number | null;
  onChange: (query: string) => void;
  /** Escape or the clear button: drop the filter and close the box. */
  onClose: () => void;
  /** Enter / ArrowDown: hand keyboard focus to the tree. */
  onFocusTree: () => void;
}

export function ExplorerTreeFilter({ query, matchCount, onChange, onClose, onFocusTree }: ExplorerTreeFilterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="explorer-tree-filter">
      <div className="explorer-tree-filter-row">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Filter files"
          aria-label="Filter files by name"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
            else if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); onFocusTree(); }
          }}
        />
        <button type="button" className="opener-btn" title="Clear filter" aria-label="Clear filter" onClick={onClose}>
          <X size={13} />
        </button>
      </div>
      <p className="explorer-tree-filter-note" role="status">
        {matchCount === null
          ? 'Searches folders you have opened.'
          : `${matchCount} ${matchCount === 1 ? 'match' : 'matches'} in opened folders.`}
      </p>
    </div>
  );
}
