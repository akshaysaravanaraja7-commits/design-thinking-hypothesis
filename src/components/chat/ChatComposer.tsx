import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';

interface ChatComposerProps {
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onStopGeneration: () => void;
}

export function ChatComposer({
  isStreaming,
  onSendMessage,
  onStopGeneration,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Dynamically expand textarea height cleanly up to 160px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 36), 160);
    el.style.height = `${nextHeight}px`;
  }, [draft]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || isStreaming) return;
    setDraft('');
    onSendMessage(cleaned);
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
    }
  };

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto flex items-end gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 focus-within:border-[var(--accent)] transition-colors"
      >
        <label htmlFor="workspace-chat-input" className="sr-only">
          Ask a follow-up question or challenge a claim
        </label>
        <textarea
          ref={textareaRef}
          id="workspace-chat-input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask a follow-up or challenge a claim..."
          className="flex-1 min-w-0 max-h-40 resize-none bg-transparent py-1.5 text-[14px] leading-snug text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none overflow-y-auto"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStopGeneration}
            aria-label="Stop generation"
            className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message"
            className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  );
}
