import React from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Scale,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import type { Claim, Hypothesis, Source } from '../../types/investigation';

interface HypothesisCardProps {
  hypothesis: Hypothesis;
  claims: Claim[];
  sourceMap: Map<string, Source>;
  selectedClaimId: string | null;
  isExpanded: boolean;
  isBusy: boolean;
  onToggleExpand: () => void;
  onSelectClaim: (claimId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onInvestigateDeeper: (target: string, mode: 'deeper' | 'opposing' | 'primary') => void;
  onRemoveHypothesis: (hypothesisId: string) => void;
}

function getStatusColor(status: Hypothesis['status']): string {
  switch (status) {
    case 'leading':
      return 'text-[var(--success)]';
    case 'contested':
      return 'text-[var(--warning)]';
    case 'weak':
      return 'text-[var(--danger)]';
    case 'user_added':
      return 'text-[var(--accent)]';
    default:
      return 'text-[var(--text-secondary)]';
  }
}

function getClassificationColor(classification: Claim['classification']): string {
  switch (classification) {
    case 'Known':
      return 'text-[var(--success)]';
    case 'Inferred':
      return 'text-[var(--warning)]';
    default:
      return 'text-[var(--text-muted)]';
  }
}

export function HypothesisCard({
  hypothesis,
  claims,
  sourceMap,
  selectedClaimId,
  isExpanded,
  isBusy,
  onToggleExpand,
  onSelectClaim,
  onSelectSource,
  onInvestigateDeeper,
  onRemoveHypothesis,
}: HypothesisCardProps) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-colors">
      {/* Header toggle */}
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        className="w-full text-left px-4 py-3.5 flex items-start gap-2.5 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
      >
        <span className="mt-0.5 text-[var(--text-muted)] shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-mono tabular-nums">
            <span className="text-[var(--text-muted)]">{hypothesis.id}</span>
            <span aria-hidden="true" className="text-[var(--border)]">·</span>
            <span className={`font-medium capitalize ${getStatusColor(hypothesis.status)}`}>
              {hypothesis.status.replace('_', ' ')}
            </span>
            <span aria-hidden="true" className="text-[var(--border)]">·</span>
            <span className="text-[var(--text-secondary)]">
              {hypothesis.confidence} confidence
            </span>
            <span aria-hidden="true" className="text-[var(--border)]">·</span>
            <span className="text-[var(--text-muted)]">
              {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
            </span>
          </div>

          <h3 className="font-display text-[14.5px] font-semibold leading-snug text-[var(--text-primary)]">
            {hypothesis.title}
          </h3>

          {hypothesis.summary && (
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {hypothesis.summary}
            </p>
          )}
        </div>
      </button>

      {/* Expanded Claims & Human Control Actions */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--background)] px-4 py-3.5 space-y-3">
          {claims.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              No claims mapped to this hypothesis yet. Use “Investigate deeper” below to gather evidence.
            </p>
          ) : (
            <ul className="space-y-2">
              {claims.map((claim) => {
                const isSelected = claim.id === selectedClaimId;
                const citedSources = [
                  ...claim.supportingSourceIds,
                  ...claim.contradictingSourceIds,
                ]
                  .map((sid) => sourceMap.get(sid))
                  .filter((s): s is Source => Boolean(s));

                return (
                  <li
                    key={claim.id}
                    className={`rounded-[var(--radius-sm)] border p-3 transition-colors ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectClaim(claim.id)}
                      className="w-full text-left space-y-1.5 cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                        <div className="flex flex-wrap items-center gap-x-1.5">
                          <span className="text-[var(--text-muted)]">{claim.id}</span>
                          <span aria-hidden="true" className="text-[var(--border)]">·</span>
                          <span className={`font-medium ${getClassificationColor(claim.classification)}`}>
                            {claim.classification}
                          </span>
                          <span aria-hidden="true" className="text-[var(--border)]">·</span>
                          <span className="text-[var(--text-secondary)]">
                            {claim.confidence} confidence
                          </span>
                        </div>

                        <span className="text-[var(--text-muted)]">
                          {claim.supportingSourceIds.length} supporting
                          {claim.contradictingSourceIds.length > 0
                            ? ` · ${claim.contradictingSourceIds.length} contradicting`
                            : ''}
                        </span>
                      </div>

                      <p className="text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                        {claim.text}
                      </p>
                    </button>

                    {citedSources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-1.5">
                        {citedSources.map((src) => {
                          const isContradicting = claim.contradictingSourceIds.includes(src.id);
                          return (
                            <button
                              key={`${claim.id}-${src.id}`}
                              type="button"
                              onClick={() => onSelectSource(src.id)}
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors cursor-pointer ${
                                isContradicting
                                  ? 'bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20'
                                  : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
                              }`}
                            >
                              <span>[{src.citationIndex}]</span>
                              <span className="truncate max-w-[140px]">{src.domain}</span>
                              <ArrowUpRight className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Human steering controls */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onInvestigateDeeper(hypothesis.title, 'deeper')}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Search className="w-3 h-3" aria-hidden="true" />
                <span>Investigate deeper</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onInvestigateDeeper(hypothesis.title, 'opposing')}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--warning)] hover:text-[var(--warning)] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Scale className="w-3 h-3" aria-hidden="true" />
                <span>Find opposing evidence</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => onRemoveHypothesis(hypothesis.id)}
              aria-label={`Remove hypothesis ${hypothesis.title}`}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--surface-hover)] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
