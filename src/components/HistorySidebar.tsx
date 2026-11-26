import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Plus, Search, Trash2, X } from 'lucide-react';
import type { InvestigationSummary } from '../types/investigation';
import { filterInvestigations, formatRelativeTime } from '../utils/investigationLogic';

interface HistorySidebarProps {
  isOpen: boolean;
  investigations: InvestigationSummary[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewInvestigation: () => void;
}

export function HistorySidebar({
  isOpen,
  investigations,
  activeId,
  onClose,
  onSelect,
  onDelete,
  onNewInvestigation,
}: HistorySidebarProps) {
  const [query, setQuery] = useState('');
  const [onlySaved, setOnlySaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const filtered = useMemo(
    () => filterInvestigations(investigations, query, onlySaved),
    [investigations, query, onlySaved]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Investigation history"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close history sidebar"
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-[1px] cursor-default"
      />

      {/* Drawer Panel */}
      <aside className="animate-fade-in relative z-10 w-[320px] max-w-[88vw] h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)]">
          <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Investigations
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewInvestigation();
              }}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-2.5 h-8 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close investigations drawer"
              className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="px-4 py-3 space-y-2.5 border-b border-[var(--border-subtle)]">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor="history-search" className="sr-only">
              Search investigations
            </label>
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] w-fit">
            <button
              type="button"
              onClick={() => setOnlySaved(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                !onlySaved
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setOnlySaved(true)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                onlySaved
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Bookmark className="w-3 h-3" aria-hidden="true" />
              <span>Saved</span>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-8">
              {onlySaved ? 'No saved investigations yet.' : 'No matching investigations.'}
            </p>
          ) : (
            filtered.map((item) => {
              const isCurrent = item.id === activeId;
              return (
                <div
                  key={item.id}
                  className={`group rounded-[var(--radius-sm)] border transition-colors ${
                    isCurrent
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="flex items-start gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <p className="text-[13px] font-medium leading-snug text-[var(--text-primary)] line-clamp-2">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                        {item.sourceCount} sources · {item.hypothesisCount} hypotheses · {formatRelativeTime(item.updatedAt)}
                      </p>
                      {item.isDemo && (
                        <p className="mt-0.5 text-[10.5px] font-mono text-[var(--accent)]">
                          DEMO / ILLUSTRATIVE
                        </p>
                      )}
                    </button>

                    {!item.isDemo && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        aria-label={`Delete investigation ${item.title}`}
                        className="p-1 rounded text-[var(--text-muted)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:text-[var(--danger)] transition-opacity cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
