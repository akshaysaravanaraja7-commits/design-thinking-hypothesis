import React, { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Investigation } from '../../types/investigation';
import { RichProse } from '../RichProse';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { InvestigationProgress, ProseSkeleton } from '../common/Skeleton';
import { ErrorState } from '../common/ErrorState';

interface MessageListProps {
  investigation: Investigation;
  progressStage: string | null;
  streamingText: string;
  isStreaming: boolean;
  errorMessage: string | null;
  onRetry?: () => void;
  onSendMessage: (text: string) => void;
  onRegenerateConclusion: () => void;
  onSelectSource: (sourceId: string) => void;
}

export function MessageList({
  investigation,
  progressStage,
  streamingText,
  isStreaming,
  errorMessage,
  onRetry,
  onSendMessage,
  onRegenerateConclusion,
  onSelectSource,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevInvIdRef = useRef<string | null>(null);
  const prevMsgCountRef = useRef<number>(investigation.messages.length);

  // Reset scroll to top when switching investigations; only auto-scroll on live updates
  useEffect(() => {
    if (prevInvIdRef.current !== investigation.id) {
      prevInvIdRef.current = investigation.id;
      prevMsgCountRef.current = investigation.messages.length;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      return;
    }

    const messageAdded = investigation.messages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = investigation.messages.length;

    if (isStreaming || streamingText || progressStage || messageAdded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [
    investigation.id,
    investigation.messages.length,
    streamingText,
    progressStage,
    isStreaming,
  ]);

  const lastAssistantIdx = (() => {
    for (let i = investigation.messages.length - 1; i >= 0; i--) {
      if (investigation.messages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 lg:px-6 py-5"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Transparent notice for demo mode or limited web search */}
        {investigation.searchNotice && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)]">
            {investigation.searchNotice}
          </div>
        )}

        {/* Message thread */}
        {investigation.messages.map((msg, idx) =>
          msg.role === 'user' ? (
            <UserMessage key={msg.id} content={msg.content} />
          ) : (
            <AssistantMessage
              key={msg.id}
              content={msg.content}
              sources={investigation.sources}
              canRegenerate={idx === lastAssistantIdx && !isStreaming}
              onRegenerate={onRegenerateConclusion}
              onSelectSource={onSelectSource}
            />
          )
        )}

        {/* Active research progress + streaming response */}
        {isStreaming && (
          <div className="space-y-4">
            {progressStage && <InvestigationProgress stage={progressStage} />}
            {streamingText ? (
              <div className="max-w-[66ch]">
                <RichProse
                  content={streamingText}
                  sources={investigation.sources}
                  onSelectSource={onSelectSource}
                />
              </div>
            ) : (
              <ProseSkeleton />
            )}
          </div>
        )}

        {/* Restrained contextual error card */}
        {errorMessage && !isStreaming && (
          <ErrorState
            message={errorMessage}
            onRetry={onRetry}
          />
        )}

        {/* Suggested follow-up research directions */}
        {!isStreaming && investigation.followUpSuggestions.length > 0 && (
          <section className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Continue investigating
            </p>
            <div className="flex flex-wrap gap-2">
              {investigation.followUpSuggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSendMessage(suggestion)}
                  className="inline-flex items-center gap-1.5 text-left rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <span>{suggestion}</span>
                  <ArrowRight className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
