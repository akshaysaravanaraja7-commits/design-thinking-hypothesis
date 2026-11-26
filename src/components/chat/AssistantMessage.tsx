import React, { useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import type { Source } from '../../types/investigation';
import { RichProse } from '../RichProse';

interface AssistantMessageProps {
  content: string;
  sources: Source[];
  canRegenerate: boolean;
  onRegenerate: () => void;
  onSelectSource: (sourceId: string) => void;
}

export function AssistantMessage({
  content,
  sources,
  canRegenerate,
  onRegenerate,
  onSelectSource,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <article className="animate-fade-in max-w-[66ch] space-y-2 min-w-0">
      <RichProse
        content={content}
        sources={sources}
        onSelectSource={onSelectSource}
      />

      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[var(--text-muted)]">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 py-1 hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[var(--success)]" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>

        {canRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1.5 py-1 hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Regenerate conclusion</span>
          </button>
        )}
      </div>
    </article>
  );
}
