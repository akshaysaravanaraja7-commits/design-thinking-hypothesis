import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Investigation paused',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="animate-fade-in max-w-md rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-secondary)] p-4 space-y-2.5"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle
          className="w-4 h-4 mt-0.5 shrink-0 text-[var(--warning)]"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {message}
          </p>
        </div>
      </div>
      {onRetry && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{retryLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
