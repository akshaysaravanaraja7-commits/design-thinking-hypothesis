import React from 'react';

interface AppShellProps {
  topBar: React.ReactNode;
  subBar?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Centered responsive shell using 100dvh for mobile keyboard safety and a balanced
 * max-width (1720px) on ultra-wide monitors so content scales cleanly without sprawling.
 */
export function AppShell({ topBar, subBar, children }: AppShellProps) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[var(--background)] text-[var(--text-primary)] flex justify-center">
      <div className="w-full max-w-[1720px] h-full flex flex-col min-w-0 2xl:border-x border-[var(--border)] bg-[var(--background)]">
        {topBar}
        {subBar}
        <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
