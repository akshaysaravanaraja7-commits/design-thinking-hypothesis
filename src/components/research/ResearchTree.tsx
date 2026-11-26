import React, { useState } from 'react';
import { GitBranch, Plus } from 'lucide-react';
import type { Investigation } from '../../types/investigation';
import { HypothesisCard } from './HypothesisCard';
import { EmptyState } from '../common/EmptyState';

interface ResearchTreeProps {
  investigation: Investigation;
  selectedClaimId: string | null;
  isBusy: boolean;
  onSelectClaim: (claimId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onInvestigateDeeper: (target: string, mode: 'deeper' | 'opposing' | 'primary') => void;
  onAddHypothesis: (title: string, summary: string) => Promise<void>;
  onRemoveHypothesis: (hypothesisId: string) => Promise<void>;
}

export function ResearchTree({
  investigation,
  selectedClaimId,
  isBusy,
  onSelectClaim,
  onSelectSource,
  onInvestigateDeeper,
  onAddHypothesis,
  onRemoveHypothesis,
}: ResearchTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const [addingHypothesis, setAddingHypothesis] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sourceMap = new Map(investigation.sources.map((s) => [s.id, s]));

  const toggleExpand = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateHypothesis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim().length < 3 || submitting) return;
    setSubmitting(true);
    try {
      await onAddHypothesis(newTitle.trim(), newSummary.trim());
      setNewTitle('');
      setNewSummary('');
      setAddingHypothesis(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (investigation.hypotheses.length === 0 && !addingHypothesis) {
    return (
      <EmptyState
        icon={<GitBranch className="w-5 h-5" aria-hidden="true" />}
        title="Your investigation will appear here."
        description="As HYPOTHESIS searches sources and compares explanations, competing hypotheses and verifiable claims will map out here."
        action={
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setAddingHypothesis(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add hypothesis</span>
          </button>
        }
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-5 py-5">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Root Investigation Question & Sub-questions */}
        <header className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--accent)]">
                Root question
              </p>
              <h2 className="font-display text-[15.5px] font-semibold leading-snug text-[var(--text-primary)]">
                {investigation.question}
              </h2>
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => setAddingHypothesis((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add hypothesis</span>
            </button>
          </div>

          {investigation.subQuestions.length > 0 && (
            <div className="pt-2.5 border-t border-[var(--border-subtle)] space-y-1.5">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">
                Decomposed sub-questions
              </p>
              <ul className="space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                {investigation.subQuestions.map((sq, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-[var(--text-muted)] tabular-nums shrink-0">
                      0{idx + 1}
                    </span>
                    <span>{sq}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </header>

        {/* Inline Add Hypothesis Form */}
        {addingHypothesis && (
          <form
            onSubmit={handleCreateHypothesis}
            className="animate-fade-in rounded-[var(--radius-md)] border border-[var(--accent)]/60 bg-[var(--surface)] p-4 space-y-3"
          >
            <div className="space-y-1">
              <label
                htmlFor="new-hypothesis-title"
                className="block text-xs font-medium text-[var(--text-primary)]"
              >
                Propose an alternative hypothesis
              </label>
              <input
                id="new-hypothesis-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Evaluation metric drift exaggerates apparent errors"
                required
                minLength={3}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="new-hypothesis-summary"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Why consider this explanation? (optional)
              </label>
              <textarea
                id="new-hypothesis-summary"
                rows={2}
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="Brief reasoning or angle to investigate..."
                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddingHypothesis(false)}
                className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || newTitle.trim().length < 3}
                className="rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                {submitting ? 'Adding...' : 'Save hypothesis'}
              </button>
            </div>
          </form>
        )}

        {/* Hypotheses List */}
        <section className="space-y-3" aria-label="Competing hypotheses">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="font-medium text-[var(--text-secondary)]">
              Competing hypotheses
            </span>
            <span className="tabular-nums">
              {investigation.hypotheses.length} hypotheses · {investigation.claims.length} claims
            </span>
          </div>

          <div className="space-y-3">
            {investigation.hypotheses.map((hypothesis) => {
              const mappedClaims = investigation.claims.filter((c) =>
                c.hypothesisIds.includes(hypothesis.id)
              );
              const isExpanded = !collapsedIds[hypothesis.id];

              return (
                <HypothesisCard
                  key={hypothesis.id}
                  hypothesis={hypothesis}
                  claims={mappedClaims}
                  sourceMap={sourceMap}
                  selectedClaimId={selectedClaimId}
                  isExpanded={isExpanded}
                  isBusy={isBusy}
                  onToggleExpand={() => toggleExpand(hypothesis.id)}
                  onSelectClaim={onSelectClaim}
                  onSelectSource={onSelectSource}
                  onInvestigateDeeper={onInvestigateDeeper}
                  onRemoveHypothesis={onRemoveHypothesis}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
