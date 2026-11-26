import React from 'react';
import { Loader2 } from 'lucide-react';

interface InvestigationProgressProps {
  stage: string;
}

const ORDERED_STAGES = [
  'Understanding',
  'Investigating',
  'Checking',
  'Comparing',
  'Writing',
];

export function InvestigationProgress({ stage }: InvestigationProgressProps) {
  const lower = stage.toLowerCase();
  let activeStep = 0;
  ORDERED_STAGES.forEach((keyword, idx) => {
    if (lower.includes(keyword.toLowerCase())) {
      activeStep = idx;
    }
  });
  if (lower.includes('search')) activeStep = Math.max(activeStep, 2);
  if (lower.includes('exploring')) activeStep = Math.max(activeStep, 1);

  return (
    <div className="animate-fade-in space-y-3" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
        <span>{stage}</span>
      </div>

      {/* Subtle segmented progress line */}
      <div className="grid grid-cols-5 gap-1.5 max-w-xs" aria-hidden="true">
        {ORDERED_STAGES.map((_, idx) => (
          <div
            key={idx}
            className={`h-1 rounded-full transition-colors duration-200 ${
              idx <= activeStep
                ? 'bg-[var(--accent)]'
                : 'bg-[var(--border)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function ProseSkeleton() {
  return (
    <div className="space-y-2.5 max-w-[60ch] pt-1" aria-hidden="true">
      <div className="h-3.5 w-3/4 rounded bg-[var(--surface-secondary)] animate-pulse" />
      <div className="h-3.5 w-full rounded bg-[var(--surface-secondary)] animate-pulse" />
      <div className="h-3.5 w-5/6 rounded bg-[var(--surface-secondary)] animate-pulse" />
      <div className="h-3.5 w-2/3 rounded bg-[var(--surface-secondary)] animate-pulse" />
    </div>
  );
}
