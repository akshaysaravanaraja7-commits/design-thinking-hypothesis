import React, { useEffect, useState } from 'react';
import type { Claim, Investigation } from '../types/investigation';
import { AppShell } from './layout/AppShell';
import { TopBar } from './layout/TopBar';
import { WorkspaceTabs, type WorkspaceSection } from './layout/WorkspaceTabs';
import { ChatPanel } from './chat/ChatPanel';
import { ResearchPanel, type ResearchSubTab } from './research/ResearchPanel';
import { EvidencePanel, type EvidenceSubTab } from './evidence/EvidencePanel';

interface WorkspaceProps {
  investigation: Investigation;
  progressStage: string | null;
  streamingText: string;
  isStreaming: boolean;
  errorMessage: string | null;
  onRetry?: () => void;
  onGoHome: () => void;
  onOpenHistory: () => void;
  onToggleSave: () => void;
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  onRegenerateConclusion: () => void;
  onChallengeClaim: (claim: Claim) => void;
  onInvestigateDeeper: (target: string, mode: 'deeper' | 'opposing' | 'primary') => void;
  onAddHypothesis: (title: string, summary: string) => Promise<void>;
  onRemoveHypothesis: (hypothesisId: string) => Promise<void>;
}

export function Workspace({
  investigation,
  progressStage,
  streamingText,
  isStreaming,
  errorMessage,
  onRetry,
  onGoHome,
  onOpenHistory,
  onToggleSave,
  onSendMessage,
  onStopGeneration,
  onRegenerateConclusion,
  onChallengeClaim,
  onInvestigateDeeper,
  onAddHypothesis,
  onRemoveHypothesis,
}: WorkspaceProps) {
  // Responsive navigation states
  const [mobileSection, setMobileSection] = useState<WorkspaceSection>('chat');
  const [tabletSideOpen, setTabletSideOpen] = useState(true);
  const [tabletSideTab, setTabletSideTab] = useState<'research' | 'evidence'>('research');

  // Panel sub-views & selections
  const [researchTab, setResearchTab] = useState<ResearchSubTab>('tree');
  const [evidenceTab, setEvidenceTab] = useState<EvidenceSubTab>('inspector');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    investigation.claims[0]?.id || null
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  // Sync default selected claim when switching investigations or when new claims arrive
  useEffect(() => {
    setSelectedClaimId((prev) => {
      if (prev && investigation.claims.some((c) => c.id === prev)) return prev;
      return investigation.claims[0]?.id || null;
    });
  }, [investigation.id, investigation.claims]);

  // Cross-panel focus helpers
  const handleSelectClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
    setEvidenceTab('inspector');
    setTabletSideTab('evidence');
    setTabletSideOpen(true);
    if (window.innerWidth < 1024) {
      setMobileSection('evidence');
    }
  };

  const handleSelectSource = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setEvidenceTab('sources');
    setTabletSideTab('evidence');
    setTabletSideOpen(true);
    if (window.innerWidth < 1024) {
      setMobileSection('evidence');
    }
  };

  const handleSelectTabletSide = (tab: 'research' | 'evidence') => {
    setTabletSideTab(tab);
    setTabletSideOpen(true);
  };

  const focusChatOnMobile = () => {
    if (window.innerWidth < 1024) {
      setMobileSection('chat');
    }
  };

  const handleChallengeClaim = (claim: Claim) => {
    focusChatOnMobile();
    onChallengeClaim(claim);
  };

  const handleInvestigateDeeper = (
    target: string,
    mode: 'deeper' | 'opposing' | 'primary'
  ) => {
    focusChatOnMobile();
    onInvestigateDeeper(target, mode);
  };

  const handleAskUncertainty = (claim: Claim) => {
    focusChatOnMobile();
    onSendMessage(
      `Explain the main uncertainty and missing evidence behind this claim: "${claim.text}"`
    );
  };

  const chatNode = (
    <ChatPanel
      investigation={investigation}
      progressStage={progressStage}
      streamingText={streamingText}
      isStreaming={isStreaming}
      errorMessage={errorMessage}
      onRetry={onRetry}
      onSendMessage={onSendMessage}
      onStopGeneration={onStopGeneration}
      onRegenerateConclusion={onRegenerateConclusion}
      onSelectSource={handleSelectSource}
    />
  );

  const researchNode = (
    <ResearchPanel
      investigation={investigation}
      activeTab={researchTab}
      onChangeTab={setResearchTab}
      selectedClaimId={selectedClaimId}
      selectedSourceId={selectedSourceId}
      isBusy={isStreaming}
      onSelectClaim={handleSelectClaim}
      onSelectSource={handleSelectSource}
      onInvestigateDeeper={handleInvestigateDeeper}
      onAddHypothesis={onAddHypothesis}
      onRemoveHypothesis={onRemoveHypothesis}
    />
  );

  const evidenceNode = (
    <EvidencePanel
      investigation={investigation}
      activeTab={evidenceTab}
      onChangeTab={setEvidenceTab}
      selectedClaimId={selectedClaimId}
      selectedSourceId={selectedSourceId}
      isBusy={isStreaming}
      onSelectClaim={handleSelectClaim}
      onSelectSource={handleSelectSource}
      onChallengeClaim={handleChallengeClaim}
      onFindPrimarySources={(claim) =>
        handleInvestigateDeeper(claim.text, 'primary')
      }
      onAskUncertainty={handleAskUncertainty}
    />
  );

  return (
    <AppShell
      topBar={
        <TopBar
          investigation={investigation}
          onGoHome={onGoHome}
          onOpenHistory={onOpenHistory}
          onToggleSave={onToggleSave}
        />
      }
      subBar={
        <WorkspaceTabs
          activeSection={mobileSection}
          onSelectSection={setMobileSection}
          tabletSideOpen={tabletSideOpen}
          tabletSideTab={tabletSideTab}
          onSelectTabletSide={handleSelectTabletSide}
          onToggleTabletSide={() => setTabletSideOpen((prev) => !prev)}
          sourceCount={investigation.sources.length}
          hypothesisCount={investigation.hypotheses.length}
        />
      }
    >
      {/* Single-mount responsive workspace grid:
          - < 1024px: 1 column (active mobileSection tab)
          - 1024px–1279px: 2 columns (Chat + collapsible Research/Evidence side panel)
          - >= 1280px: 3 flexible columns (Chat | Research | Evidence) */}
      <div
        className={`flex-1 min-h-0 min-w-0 overflow-hidden grid grid-cols-1 divide-[var(--border)] ${
          tabletSideOpen
            ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:divide-x'
            : 'lg:grid-cols-1'
        } xl:grid-cols-[minmax(360px,1.05fr)_minmax(440px,1.35fr)_minmax(300px,0.9fr)] xl:divide-x`}
      >
        {/* Chat Panel */}
        <div
          className={`min-w-0 min-h-0 h-full overflow-hidden ${
            mobileSection === 'chat' ? 'block' : 'hidden lg:block'
          }`}
        >
          {chatNode}
        </div>

        {/* Research Panel */}
        <div
          className={`min-w-0 min-h-0 h-full overflow-hidden ${
            mobileSection === 'research' ? 'block' : 'hidden'
          } ${
            tabletSideOpen && tabletSideTab === 'research' ? 'lg:block' : 'lg:hidden'
          } xl:block`}
        >
          {researchNode}
        </div>

        {/* Evidence Panel */}
        <div
          className={`min-w-0 min-h-0 h-full overflow-hidden ${
            mobileSection === 'evidence' ? 'block' : 'hidden'
          } ${
            tabletSideOpen && tabletSideTab === 'evidence' ? 'lg:block' : 'lg:hidden'
          } xl:block`}
        >
          {evidenceNode}
        </div>
      </div>
    </AppShell>
  );
}
