import React from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import type { Claim, Investigation, Source } from '../../types/investigation';
import { EmptyState } from '../common/EmptyState';

interface EvidenceInspectorProps {
  investigation: Investigation;
  selectedClaimId: string | null;
  isBusy: boolean;
  onSelectClaim: (claimId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onChallengeClaim: (claim: Claim) => void;
  onFindPrimarySources: (claim: Claim) => void;
  onAskUncertainty: (claim: Claim) => void;
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

export function EvidenceInspector({
  investigation,
  selectedClaimId,
  isBusy,
  onSelectClaim,
  onSelectSource,
  onChallengeClaim,
  onFindPrimarySources,
  onAskUncertainty,
}: EvidenceInspectorProps) {
  if (investigation.claims.length === 0) {
    return (
      <EmptyState
        icon={<Scale className="w-5 h-5" aria-hidden="true" />}
        title="No claims to inspect yet"
        description="Sources and evidence will appear here as HYPOTHESIS investigates."
      />
    );
  }

  const activeClaim =
    investigation.claims.find((c) => c.id === selectedClaimId) ||
    investigation.claims[0];

  const sourceMap = new Map(investigation.sources.map((s) => [s.id, s]));

  const supportingSources = activeClaim.supportingSourceIds
    .map((id) => sourceMap.get(id))
    .filter((s): s is Source => Boolean(s));

  const contradictingSources = activeClaim.contradictingSourceIds
    .map((id) => sourceMap.get(id))
    .filter((s): s is Source => Boolean(s));

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Compact claim switcher */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">
              Inspect claim
            </span>
            <span className="font-mono tabular-nums">
              {investigation.claims.length} total
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {investigation.claims.map((claim) => {
              const selected = claim.id === activeClaim.id;
              return (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => onSelectClaim(claim.id)}
                  className={`px-2.5 py-1 rounded-[var(--radius-sm)] border text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {claim.id}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Claim Detail Card */}
        <article className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-mono tabular-nums">
              <span className="text-[var(--text-muted)]">{activeClaim.id}</span>
              <span aria-hidden="true" className="text-[var(--border)]">·</span>
              <span className={`font-semibold ${getClassificationColor(activeClaim.classification)}`}>
                {activeClaim.classification}
              </span>
              <span aria-hidden="true" className="text-[var(--border)]">·</span>
              <span className="text-[var(--text-secondary)]">
                {activeClaim.confidence} confidence
              </span>
              {activeClaim.lastVerified && (
                <>
                  <span aria-hidden="true" className="text-[var(--border)]">·</span>
                  <span className="text-[var(--text-muted)]">
                    Verified {activeClaim.lastVerified}
                  </span>
                </>
              )}
            </div>

            <h3 className="font-display text-[14.5px] font-semibold leading-snug text-[var(--text-primary)]">
              {activeClaim.text}
            </h3>
          </div>

          {/* Reasoning */}
          <div className="space-y-1">
            <p className="text-[11.5px] font-medium text-[var(--text-muted)]">
              Reasoning
            </p>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {activeClaim.reasoning}
            </p>
          </div>

          {/* Uncertainty */}
          <div className="rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-primary)]">
              <AlertCircle className="w-3.5 h-3.5 text-[var(--warning)] shrink-0" aria-hidden="true" />
              <span>Uncertainty &amp; limitations</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              {activeClaim.uncertainty}
            </p>
          </div>

          {/* Supporting Sources */}
          <div className="space-y-2">
            <p className="text-[11.5px] font-medium text-[var(--success)] tabular-nums">
              Supporting sources ({supportingSources.length})
            </p>
            {supportingSources.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No directly verified supporting sources linked yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {supportingSources.map((src) => (
                  <li key={`sup-${src.id}`}>
                    <button
                      type="button"
                      onClick={() => onSelectSource(src.id)}
                      className="w-full text-left rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 hover:border-[var(--accent)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="text-[var(--accent)]">
                          [{src.citationIndex}] {src.domain}
                        </span>
                        <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)] line-clamp-1">
                        {src.title}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contradicting Sources */}
          {contradictingSources.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11.5px] font-medium text-[var(--danger)] tabular-nums">
                Contradicting sources ({contradictingSources.length})
              </p>
              <ul className="space-y-1.5">
                {contradictingSources.map((src) => (
                  <li key={`con-${src.id}`}>
                    <button
                      type="button"
                      onClick={() => onSelectSource(src.id)}
                      className="w-full text-left rounded-[var(--radius-sm)] border border-[var(--danger)]/35 bg-[var(--background)] px-3 py-2 hover:border-[var(--danger)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="text-[var(--danger)]">
                          [{src.citationIndex}] {src.domain}
                        </span>
                        <ArrowUpRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-[var(--text-primary)] line-clamp-1">
                        {src.title}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Researcher Steering Actions */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onChallengeClaim(activeClaim)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--warning)] hover:text-[var(--warning)] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Challenge this claim</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => onFindPrimarySources(activeClaim)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Primary sources</span>
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => onAskUncertainty(activeClaim)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Uncertainty</span>
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
