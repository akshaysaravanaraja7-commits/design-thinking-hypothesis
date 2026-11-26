import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import type { Claim, Investigation, InvestigationSummary } from './types/investigation';
import {
  addHypothesis,
  createInvestigation,
  deleteInvestigation,
  getInvestigation,
  listInvestigations,
  removeHypothesis,
  streamChallengeClaim,
  streamInvestigateDeeper,
  streamMessage,
  streamResearch,
  updateInvestigationMeta,
  type SseEvent,
} from './services/api';
import { LandingPage } from './components/LandingPage';
import { Workspace } from './components/Workspace';
import { HistorySidebar } from './components/HistorySidebar';

function HypothesisApp() {
  const [summaries, setSummaries] = useState<InvestigationSummary[]>([]);
  const [demoPreview, setDemoPreview] = useState<Investigation | null>(null);
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastTaskRef = useRef<((signal: AbortSignal) => Promise<void>) | null>(null);

  const refreshSummaries = useCallback(async () => {
    try {
      const list = await listInvestigations();
      setSummaries(list);
    } catch {
      // Keep existing summaries on transient failure
    }
  }, []);

  const openInvestigation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setProgressStage(null);
    setStreamingText('');
    setErrorMessage(null);

    try {
      const loaded = await getInvestigation(id);
      setActiveInvestigation(loaded);
      const url = new URL(window.location.href);
      url.searchParams.set('investigation', loaded.id);
      window.history.replaceState({}, '', url.toString());
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to open that investigation.'
      );
    }
  }, []);

  // Initial load: fetch summaries + demo preview + honor ?investigation= or ?autostart=1
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await listInvestigations();
        if (!mounted) return;
        setSummaries(list);

        const demoItem = list.find((i) => i.isDemo);
        if (demoItem) {
          const demo = await getInvestigation(demoItem.id);
          if (mounted) setDemoPreview(demo);
        }

        const params = new URLSearchParams(window.location.search);
        const requestedId = params.get('investigation');
        const autostart = params.get('autostart') === '1';

        if (requestedId) {
          await openInvestigation(requestedId);
        } else if (autostart && demoItem) {
          await openInvestigation(demoItem.id);
        }
      } catch {
        // Ignore initial load errors cleanly
      }
    })();

    return () => {
      mounted = false;
    };
  }, [openInvestigation]);

  const handleStreamEvent = useCallback(
    (event: SseEvent) => {
      if (event.type === 'progress') {
        setProgressStage(event.stage);
      } else if (event.type === 'investigation') {
        setActiveInvestigation(event.investigation);
      } else if (event.type === 'token') {
        setStreamingText((prev) => prev + event.text);
      } else if (event.type === 'done') {
        setActiveInvestigation(event.investigation);
        setIsStreaming(false);
        setProgressStage(null);
        setStreamingText('');
        refreshSummaries();
      } else if (event.type === 'error') {
        setErrorMessage(event.message);
        setIsStreaming(false);
        setProgressStage(null);
      }
    },
    [refreshSummaries]
  );

  const runStreamTask = useCallback(
    async (task: (signal: AbortSignal) => Promise<void>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      lastTaskRef.current = task;

      setIsStreaming(true);
      setStreamingText('');
      setErrorMessage(null);
      setProgressStage('Understanding question...');

      try {
        await task(controller.signal);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          // User deliberately stopped generation
          setIsStreaming(false);
          setProgressStage(null);
          return;
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to complete the investigation right now. Please try again.'
        );
        setIsStreaming(false);
        setProgressStage(null);
      }
    },
    []
  );

  const handleRetryLastTask = useCallback(() => {
    if (lastTaskRef.current) {
      runStreamTask(lastTaskRef.current);
    }
  }, [runStreamTask]);

  const handleStartInvestigation = useCallback(
    async (question: string) => {
      try {
        setErrorMessage(null);
        const created = await createInvestigation(question);
        setActiveInvestigation(created);
        refreshSummaries();

        const url = new URL(window.location.href);
        url.searchParams.set('investigation', created.id);
        window.history.replaceState({}, '', url.toString());

        await runStreamTask((signal) =>
          streamResearch(created.id, {}, handleStreamEvent, signal)
        );
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to start a new investigation.'
        );
      }
    },
    [handleStreamEvent, refreshSummaries, runStreamTask]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeInvestigation) return;
      const targetId = activeInvestigation.id;
      await runStreamTask((signal) =>
        streamMessage(targetId, text, undefined, handleStreamEvent, signal)
      );
    },
    [activeInvestigation, handleStreamEvent, runStreamTask]
  );

  const handleStopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setProgressStage(null);
    if (streamingText.trim() && activeInvestigation) {
      setActiveInvestigation((prev) =>
        prev
          ? {
              ...prev,
              messages: [
                ...prev.messages,
                {
                  id: `stopped-${Date.now()}`,
                  role: 'assistant',
                  content: `${streamingText}\n\n*(Generation stopped by user.)*`,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : prev
      );
      setStreamingText('');
    }
  }, [activeInvestigation, streamingText]);

  const handleRegenerateConclusion = useCallback(async () => {
    if (!activeInvestigation) return;
    const targetId = activeInvestigation.id;
    await runStreamTask((signal) =>
      streamResearch(targetId, { regenerateOnly: true }, handleStreamEvent, signal)
    );
  }, [activeInvestigation, handleStreamEvent, runStreamTask]);

  const handleChallengeClaim = useCallback(
    async (claim: Claim) => {
      if (!activeInvestigation) return;
      const targetId = activeInvestigation.id;
      await runStreamTask((signal) =>
        streamChallengeClaim(targetId, claim.id, claim.text, handleStreamEvent, signal)
      );
    },
    [activeInvestigation, handleStreamEvent, runStreamTask]
  );

  const handleInvestigateDeeper = useCallback(
    async (target: string, mode: 'deeper' | 'opposing' | 'primary') => {
      if (!activeInvestigation) return;
      const targetId = activeInvestigation.id;
      await runStreamTask((signal) =>
        streamInvestigateDeeper(targetId, target, mode, handleStreamEvent, signal)
      );
    },
    [activeInvestigation, handleStreamEvent, runStreamTask]
  );

  const handleAddHypothesis = useCallback(
    async (title: string, summary: string) => {
      if (!activeInvestigation) return;
      const updated = await addHypothesis(activeInvestigation.id, title, summary);
      setActiveInvestigation(updated);
      refreshSummaries();
    },
    [activeInvestigation, refreshSummaries]
  );

  const handleRemoveHypothesis = useCallback(
    async (hypothesisId: string) => {
      if (!activeInvestigation) return;
      const updated = await removeHypothesis(activeInvestigation.id, hypothesisId);
      setActiveInvestigation(updated);
      refreshSummaries();
    },
    [activeInvestigation, refreshSummaries]
  );

  const handleToggleSave = useCallback(async () => {
    if (!activeInvestigation) return;
    const updated = await updateInvestigationMeta(activeInvestigation.id, {
      isSaved: !activeInvestigation.isSaved,
    });
    setActiveInvestigation(updated);
    refreshSummaries();
  }, [activeInvestigation, refreshSummaries]);

  const handleDeleteInvestigation = useCallback(
    async (id: string) => {
      await deleteInvestigation(id);
      if (activeInvestigation?.id === id) {
        setActiveInvestigation(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('investigation');
        window.history.replaceState({}, '', url.toString());
      }
      refreshSummaries();
    },
    [activeInvestigation, refreshSummaries]
  );

  const handleGoHome = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setProgressStage(null);
    setStreamingText('');
    setErrorMessage(null);
    setActiveInvestigation(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('investigation');
    url.searchParams.delete('autostart');
    window.history.replaceState({}, '', url.toString());
  }, []);

  return (
    <>
      {activeInvestigation ? (
        <Workspace
          investigation={activeInvestigation}
          progressStage={progressStage}
          streamingText={streamingText}
          isStreaming={isStreaming}
          errorMessage={errorMessage}
          onRetry={handleRetryLastTask}
          onGoHome={handleGoHome}
          onOpenHistory={() => setHistoryOpen(true)}
          onToggleSave={handleToggleSave}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          onRegenerateConclusion={handleRegenerateConclusion}
          onChallengeClaim={handleChallengeClaim}
          onInvestigateDeeper={handleInvestigateDeeper}
          onAddHypothesis={handleAddHypothesis}
          onRemoveHypothesis={handleRemoveHypothesis}
        />
      ) : (
        <LandingPage
          recentInvestigations={summaries}
          demoPreview={demoPreview}
          onStartInvestigation={handleStartInvestigation}
          onOpenInvestigation={openInvestigation}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      )}

      <HistorySidebar
        isOpen={historyOpen}
        investigations={summaries}
        activeId={activeInvestigation?.id || null}
        onClose={() => setHistoryOpen(false)}
        onSelect={openInvestigation}
        onDelete={handleDeleteInvestigation}
        onNewInvestigation={handleGoHome}
      />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HypothesisApp />
    </ThemeProvider>
  );
}
