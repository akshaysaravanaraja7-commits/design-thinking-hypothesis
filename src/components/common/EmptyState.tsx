import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-10 h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--text-muted)] mb-3.5">
        {icon}
      </div>
      <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)] max-w-xs">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
