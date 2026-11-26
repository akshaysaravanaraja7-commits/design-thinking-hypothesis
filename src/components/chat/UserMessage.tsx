import React from 'react';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="animate-fade-in flex justify-end">
      <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-br-sm bg-[var(--surface-secondary)] border border-[var(--border-subtle)] px-4 py-2.5 text-[14.5px] leading-relaxed text-[var(--text-primary)] break-words">
        {content}
      </div>
    </div>
  );
}
