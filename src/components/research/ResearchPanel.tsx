import React from 'react';
import { GitBranch, Network, AlertTriangle } from 'lucide-react';
import type { Investigation } from '../../types/investigation';
import { ResearchTree } from './ResearchTree';
import { InvestigationGraph } from './InvestigationGraph';
import { ContradictionsView } from '../ContradictionsView';

export type ResearchSubTab = 'tree' | 'graph' | 'contradictions';

interface ResearchPanelProps {
  investigation: Investigation;
  activeTab: ResearchSubTab;
  onChangeTab: (tab: ResearchSubTab) => void;
  selectedClaimId: string | null;
  selectedSourceId: string | null;
  isBusy: boolean;
  onSelectClaim: (claimId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onInvestigateDeeper: (target: string, mode: 'deeper' | 'opposing' | 'primary') => void;
  onAddHypothesis: (title: string, summary: string) => Promise<void>;
  onRemoveHypothesis: (hypothesisId: string) => Promise<void>;
}

export function ResearchPanel({
  investigation,
  activeTab,
  onChangeTab,
  selectedClaimId,
  selectedSourceId,
  isBusy,
  onSelectClaim,
  onSelectSource,
  onInvestigateDeeper,
  onAddHypothesis,
  onRemoveHypothesis,
}: ResearchPanelProps) {
  return (
    <section
      aria-label="Research analysis"
      className="h-full min-h-0 min-w-0 flex flex-col bg-[var(--background)]"
    >
      {/* Clean sub-navigation header */}
      <div className="shrink-0 h-11 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto">
        <div role="tablist" aria-label="Research view mode" className="flex items-center gap-1">
          {(
            [
              { id: 'tree', label: 'Research Tree', icon: GitBranch },
              { id: 'graph', label: 'Graph', icon: Network },
              {
                id: 'contradictions',
                label:
                  investigation.contradictions.length > 0
                    ? `Contradictions (${investigation.contradictions.length})`
                    : 'Contradictions',
                icon: AlertTriangle,
              },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeTab(id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                  active
                    ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Research Sub-View */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {activeTab === 'tree' && (
          <ResearchTree
            investigation={investigation}
            selectedClaimId={selectedClaimId}
            isBusy={isBusy}
            onSelectClaim={onSelectClaim}
            onSelectSource={onSelectSource}
            onInvestigateDeeper={onInvestigateDeeper}
            onAddHypothesis={onAddHypothesis}
            onRemoveHypothesis={onRemoveHypothesis}
          />
        )}

        {activeTab === 'graph' && (
          <InvestigationGraph
            investigation={investigation}
            selectedClaimId={selectedClaimId}
            selectedSourceId={selectedSourceId}
            onSelectClaim={onSelectClaim}
            onSelectSource={onSelectSource}
          />
        )}

        {activeTab === 'contradictions' && (
          <ContradictionsView
            investigation={investigation}
            isBusy={isBusy}
            onSelectSource={onSelectSource}
            onCompareSources={(topic) => onInvestigateDeeper(topic, 'opposing')}
          />
        )}
      </div>
    </section>
  );
}
