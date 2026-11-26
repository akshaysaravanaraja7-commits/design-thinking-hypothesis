import React from 'react';
import {
  MessageSquare,
  GitBranch,
  Scale,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

export type WorkspaceSection = 'chat' | 'research' | 'evidence';

interface WorkspaceTabsProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  tabletSideOpen: boolean;
  tabletSideTab: 'research' | 'evidence';
  onSelectTabletSide: (tab: 'research' | 'evidence') => void;
  onToggleTabletSide: () => void;
  sourceCount: number;
  hypothesisCount: number;
}

/**
 * Adaptive navigation bar:
 * - Mobile & Portrait Tablet (< 1024px): Clean 3-tab switcher (Chat | Research | Evidence)
 * - Landscape Tablet (1024px–1279px): Split-pane control bar (Chat + collapsible Research / Evidence panel)
 * - Desktop (>= 1280px): Hidden because all 3 workspace regions are visible simultaneously
 */
export function WorkspaceTabs({
  activeSection,
  onSelectSection,
  tabletSideOpen,
  tabletSideTab,
  onSelectTabletSide,
  onToggleTabletSide,
  sourceCount,
  hypothesisCount,
}: WorkspaceTabsProps) {
  return (
    <>
      {/* Mobile & Portrait Tablet (< lg): Single-focus 3-tab bar */}
      <nav
        aria-label="Workspace panels"
        className="lg:hidden h-11 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-2 sm:px-4 flex items-center gap-1"
      >
        <div role="tablist" aria-label="Workspace views" className="w-full flex items-center gap-1">
          {(
            [
              { id: 'chat', label: 'Chat', icon: MessageSquare },
              {
                id: 'research',
                label: hypothesisCount > 0 ? `Research (${hypothesisCount})` : 'Research',
                icon: GitBranch,
              },
              {
                id: 'evidence',
                label: sourceCount > 0 ? `Evidence (${sourceCount})` : 'Evidence',
                icon: Scale,
              },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectSection(id)}
                className={`flex-1 min-w-0 h-8 inline-flex items-center justify-center gap-1.5 px-2 rounded-[var(--radius-sm)] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                  active
                    ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0 hidden min-[375px]:inline" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Landscape Tablet (lg to xl, 1024px–1279px): Chat + Collapsible Side Inspector bar */}
      <div className="hidden lg:flex xl:hidden h-11 shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 items-center justify-between gap-4">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Conversation &amp; Analysis Workspace
        </span>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Side panel view"
            className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tabletSideOpen && tabletSideTab === 'research'}
              onClick={() => onSelectTabletSide('research')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                tabletSideOpen && tabletSideTab === 'research'
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Research ({hypothesisCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tabletSideOpen && tabletSideTab === 'evidence'}
              onClick={() => onSelectTabletSide('evidence')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                tabletSideOpen && tabletSideTab === 'evidence'
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Evidence ({sourceCount})
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleTabletSide}
            aria-label={tabletSideOpen ? 'Collapse side panel' : 'Expand side panel'}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer whitespace-nowrap"
          >
            {tabletSideOpen ? (
              <>
                <PanelRightClose className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hide panel</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Show panel</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
