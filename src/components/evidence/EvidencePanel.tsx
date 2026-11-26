import React, { useMemo, useState } from 'react';
import { FileText, Scale } from 'lucide-react';
import type { Claim, Investigation, SourceQualityTier } from '../../types/investigation';
import { EvidenceInspector } from './EvidenceInspector';
import { SourceCard } from './SourceCard';
import { EmptyState } from '../common/EmptyState';

export type EvidenceSubTab = 'inspector' | 'sources';

interface EvidencePanelProps {
  investigation: Investigation;
  activeTab: EvidenceSubTab;
  onChangeTab: (tab: EvidenceSubTab) => void;
  selectedClaimId: string | null;
  selectedSourceId: string | null;
  isBusy: boolean;
  onSelectClaim: (claimId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onChallengeClaim: (claim: Claim) => void;
  onFindPrimarySources: (claim: Claim) => void;
  onAskUncertainty: (claim: Claim) => void;
}

export function EvidencePanel({
  investigation,
  activeTab,
  onChangeTab,
  selectedClaimId,
  selectedSourceId,
  isBusy,
  onSelectClaim,
  onSelectSource,
  onChallengeClaim,
  onFindPrimarySources,
  onAskUncertainty,
}: EvidencePanelProps) {
  const [tierFilter, setTierFilter] = useState<'All' | SourceQualityTier>('All');

  const filteredSources = useMemo(() => {
    if (tierFilter === 'All') return investigation.sources;
    return investigation.sources.filter((s) => s.qualityTier === tierFilter);
  }, [investigation.sources, tierFilter]);

  return (
    <section
      aria-label="Evidence and sources"
      className="h-full min-h-0 min-w-0 flex flex-col bg-[var(--background)]"
    >
      {/* Clean sub-navigation bar */}
      <div className="shrink-0 h-11 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Evidence views" className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inspector'}
            onClick={() => onChangeTab('inspector')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Scale className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Inspector</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sources'}
            onClick={() => onChangeTab('sources')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
              activeTab === 'sources'
                ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Sources ({investigation.sources.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-view content */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {activeTab === 'inspector' ? (
          <EvidenceInspector
            investigation={investigation}
            selectedClaimId={selectedClaimId}
            isBusy={isBusy}
            onSelectClaim={onSelectClaim}
            onSelectSource={(sourceId) => {
              onSelectSource(sourceId);
              onChangeTab('sources');
            }}
            onChallengeClaim={onChallengeClaim}
            onFindPrimarySources={onFindPrimarySources}
            onAskUncertainty={onAskUncertainty}
          />
        ) : investigation.sources.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-5 h-5" aria-hidden="true" />}
            title="No sources retrieved yet"
            description="Sources and evidence will appear here as HYPOTHESIS investigates."
          />
        ) : (
          <div className="h-full overflow-y-auto px-4 py-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Quality tier filter */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="group"
                  aria-label="Filter sources by quality tier"
                  className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)]"
                >
                  {(['All', 'Strong', 'Moderate', 'Caution'] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setTierFilter(tier)}
                      className={`px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        tierFilter === tier
                          ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
                <span className="text-[11.5px] font-mono text-[var(--text-muted)] tabular-nums">
                  {filteredSources.length} shown
                </span>
              </div>

              {filteredSources.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-8 text-center">
                  No sources match the “{tierFilter}” quality tier.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
                  {filteredSources.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      isSelected={source.id === selectedSourceId}
                      onSelect={() => onSelectSource(source.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
