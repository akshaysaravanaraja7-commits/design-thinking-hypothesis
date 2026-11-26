import React from 'react';
import type { Investigation } from '../../types/investigation';
import { MessageList } from './MessageList';
import { ChatComposer } from './ChatComposer';

interface ChatPanelProps {
  investigation: Investigation;
  progressStage: string | null;
  streamingText: string;
  isStreaming: boolean;
  errorMessage: string | null;
  onRetry?: () => void;
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
  onRegenerateConclusion: () => void;
  onSelectSource: (sourceId: string) => void;
}

export function ChatPanel({
  investigation,
  progressStage,
  streamingText,
  isStreaming,
  errorMessage,
  onRetry,
  onSendMessage,
  onStopGeneration,
  onRegenerateConclusion,
  onSelectSource,
}: ChatPanelProps) {
  return (
    <section
      aria-label="Investigation conversation"
      className="h-full min-h-0 min-w-0 flex flex-col bg-[var(--background)]"
    >
      <MessageList
        investigation={investigation}
        progressStage={progressStage}
        streamingText={streamingText}
        isStreaming={isStreaming}
        errorMessage={errorMessage}
        onRetry={onRetry}
        onSendMessage={onSendMessage}
        onRegenerateConclusion={onRegenerateConclusion}
        onSelectSource={onSelectSource}
      />
      <ChatComposer
        isStreaming={isStreaming}
        onSendMessage={onSendMessage}
        onStopGeneration={onStopGeneration}
      />
    </section>
  );
}
