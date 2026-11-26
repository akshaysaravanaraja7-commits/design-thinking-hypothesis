import React from 'react';
import { AlertTriangle, HelpCircle, ArrowUpRight } from 'lucide-react';
import type { Investigation } from '../types/investigation';

interface ContradictionsViewProps {
  investigation: Investigation;
  isBusy: boolean;
  onSelectSource: (sourceId: string) => void;
  onCompareSources: (topic: string) => void;
}

export function ContradictionsView({
  investigation,
  isBusy,
  onSelectSource,
  onCompareSources,
}: ContradictionsViewProps) {
  const sourceMap = new Map(investigation.sources.map((s) => [s.id, s]));

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-5 py-5">
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[15px] font-semibold text-[var(--text-primary)]">
                Source contradictions &amp; disagreements
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                Where independent sources diverge and why the evidence does not point in a single direction.
              </p>
            </div>
            <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums shrink-0">
              {investigation.contradictions.length} found
            </span>
          </div>

          {investigation.contradictions.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                No direct contradictions were detected across the currently collected sources. You can explicitly search for counter-evidence to stress-test the leading hypothesis.
              </p>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onCompareSources(investigation.question)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Search for opposing evidence
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {investigation.contradictions.map((ct) => {
                const sourceA = sourceMap.get(ct.sourceAId);
                const sourceB = sourceMap.get(ct.sourceBId);
                return (
                  <article
                    key={ct.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <AlertTriangle
                          className="w-4 h-4 text-[var(--warning)] shrink-0"
                          aria-hidden="true"
                        />
                        <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] truncate">
                          {ct.topic}
                        </h3>
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onCompareSources(ct.topic)}
                        className="text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Compare sources
                      </button>
                    </div>

                    {/* Side-by-side SOURCE A vs SOURCE B */}
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border-subtle)]">
                      <div className="p-4 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-medium text-[var(--text-secondary)] shrink-0">
                            Source A {sourceA ? `· [${sourceA.citationIndex}]` : ''}
                          </span>
                          {sourceA && (
                            <button
                              type="button"
                              onClick={() => onSelectSource(sourceA.id)}
                              className="inline-flex items-center gap-0.5 text-[var(--accent)] hover:underline truncate min-w-0 cursor-pointer"
                            >
                              <span className="truncate">{sourceA.domain}</span>
                              <ArrowUpRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <p className="text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                          “{ct.claimAText}”
                        </p>
                      </div>

                      <div className="p-4 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-medium text-[var(--text-secondary)] shrink-0">
                            Source B {sourceB ? `· [${sourceB.citationIndex}]` : ''}
                          </span>
                          {sourceB && (
                            <button
                              type="button"
                              onClick={() => onSelectSource(sourceB.id)}
                              className="inline-flex items-center gap-0.5 text-[var(--accent)] hover:underline truncate min-w-0 cursor-pointer"
                            >
                              <span className="truncate">{sourceB.domain}</span>
                              <ArrowUpRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <p className="text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                          “{ct.claimBText}”
                        </p>
                      </div>
                    </div>

                    {/* Disagreement analysis */}
                    <div className="px-4 py-3.5 bg-[var(--surface-secondary)] border-t border-[var(--border-subtle)] space-y-2.5">
                      <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-primary)]">
                          Where they diverge:{' '}
                        </span>
                        {ct.disagreementSummary}
                      </p>
                      {ct.possibleReasons.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-[var(--text-muted)] mb-1">
                            Possible reasons for disagreement
                          </p>
                          <ul className="space-y-1 pl-4 list-disc text-[13px] text-[var(--text-secondary)]">
                            {ct.possibleReasons.map((reason, rIdx) => (
                              <li key={rIdx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Open Uncertainties */}
        <section className="space-y-3 pt-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
            <h2 className="font-display text-[15px] font-semibold text-[var(--text-primary)]">
              What remains uncertain
            </h2>
          </div>
          {investigation.uncertainties.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No explicit uncertainty gaps listed yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {investigation.uncertainties.map((item, idx) => (
                <li
                  key={idx}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--text-secondary)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
