import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Share2,
  Sun,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { Investigation } from '../../types/investigation';

interface TopBarProps {
  investigation: Investigation;
  onGoHome: () => void;
  onOpenHistory: () => void;
  onToggleSave: () => void;
}

export function TopBar({
  investigation,
  onGoHome,
  onOpenHistory,
  onToggleSave,
}: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const [sharedCopied, setSharedCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [menuOpen]);

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/?investigation=${encodeURIComponent(
        investigation.id
      )}`;
      await navigator.clipboard.writeText(shareUrl);
      setSharedCopied(true);
      setTimeout(() => setSharedCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <header className="h-[52px] sm:h-14 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 lg:px-5 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
      {/* Left: History Drawer + Brand + Truncated Title */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="Open investigation history"
          className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shrink-0"
        >
          <PanelLeft className="w-4 h-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="font-display text-[13.5px] sm:text-sm font-bold tracking-[0.07em] text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          HYPOTHESIS
        </button>

        <span
          className="hidden sm:inline text-[var(--border)] select-none shrink-0"
          aria-hidden="true"
        >
          /
        </span>

        <div className="hidden sm:flex items-center gap-2 min-w-0 flex-1">
          <h1
            title={investigation.title}
            className="text-[13.5px] font-medium text-[var(--text-primary)] truncate min-w-0"
          >
            {investigation.title}
          </h1>
          {investigation.isDemo && (
            <span className="hidden md:inline font-mono text-[10.5px] text-[var(--accent)] whitespace-nowrap shrink-0">
              DEMO / ILLUSTRATIVE
            </span>
          )}
        </div>
      </div>

      {/* Right: Desktop & Tablet Controls (>= md) */}
      <div className="hidden md:flex items-center gap-1.5 lg:gap-2 shrink-0">
        <span className="hidden 2xl:inline text-xs text-[var(--text-muted)] tabular-nums mr-2 whitespace-nowrap">
          {investigation.sources.length} sources · {investigation.hypotheses.length} hypotheses
        </span>

        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={investigation.isSaved}
          aria-label={
            investigation.isSaved
              ? 'Remove from saved investigations'
              : 'Save investigation'
          }
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 h-9 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            investigation.isSaved
              ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <Bookmark
            className={`w-3.5 h-3.5 ${investigation.isSaved ? 'fill-current' : ''}`}
            aria-hidden="true"
          />
          <span>{investigation.isSaved ? 'Saved' : 'Save'}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Copy shareable link to investigation"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 h-9 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors whitespace-nowrap cursor-pointer"
        >
          {sharedCopied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[var(--success)]" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Share</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3 h-9 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>New</span>
        </button>
      </div>

      {/* Right: Mobile Compact Controls (< md, guaranteed fit even at 320px) */}
      <div className="flex md:hidden items-center gap-1 shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={investigation.isSaved}
          aria-label={
            investigation.isSaved
              ? 'Remove from saved investigations'
              : 'Save investigation'
          }
          className={`w-10 h-10 inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
            investigation.isSaved
              ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <Bookmark
            className={`w-4 h-4 ${investigation.isSaved ? 'fill-current' : ''}`}
            aria-hidden="true"
          />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="More investigation actions"
            className="w-10 h-10 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="animate-fade-in absolute right-0 top-11 z-40 w-60 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xl p-1.5 space-y-0.5"
            >
              <div className="px-2.5 py-2 border-b border-[var(--border-subtle)] mb-1">
                <p className="text-xs font-medium text-[var(--text-primary)] line-clamp-2">
                  {investigation.title}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
                  {investigation.sources.length} sources · {investigation.hypotheses.length} hypotheses
                </p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  handleShare();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                {sharedCopied ? (
                  <Check className="w-3.5 h-3.5 text-[var(--success)]" aria-hidden="true" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                )}
                <span>{sharedCopied ? 'Link copied' : 'Share investigation'}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  toggleTheme();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
                )}
                <span>Switch to {theme === 'dark' ? 'light' : 'dark'} mode</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onGoHome();
                }}
                className="w-full flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New investigation</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
