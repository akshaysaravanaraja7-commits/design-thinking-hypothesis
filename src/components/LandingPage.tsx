import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  GitBranch,
  Network,
  Scale,
  Sun,
  Moon,
  History,
  ArrowUpRight,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { Investigation, InvestigationSummary } from '../types/investigation';
import { formatRelativeTime } from '../utils/investigationLogic';

interface LandingPageProps {
  recentInvestigations: InvestigationSummary[];
  demoPreview: Investigation | null;
  onStartInvestigation: (question: string) => void;
  onOpenInvestigation: (id: string) => void;
  onOpenHistory: () => void;
}

const EXAMPLE_QUESTIONS = [
  'Why are EV battery prices falling?',
  'Is intermittent fasting actually effective?',
  'Why did this machine-learning model fail?',
  'What caused the 2008 financial crisis?',
  'Which programming language is better for backend development?',
  'Compare the causes of climate change.',
];

const METHODOLOGY_STEPS = [
  {
    num: '01',
    title: 'Ask',
    description:
      'Start with a complex question. HYPOTHESIS breaks it into targeted sub-questions rather than chasing a single search snippet.',
  },
  {
    num: '02',
    title: 'Investigate',
    description:
      'Generate competing hypotheses first, then search across multiple independent primary, academic, and institutional sources in parallel.',
  },
  {
    num: '03',
    title: 'Compare',
    description:
      'Extract individual claims, classify them as Known, Inferred, or Speculative, and surface where sources directly contradict each other.',
  },
  {
    num: '04',
    title: 'Understand',
    description:
      'Trace every claim back to its source through the Research Tree, Investigation Graph, and transparent Evidence Inspector.',
  },
  {
    num: '05',
    title: 'Decide',
    description:
      'Challenge claims, add your own hypotheses, and reach a grounded conclusion while seeing clearly what still remains uncertain.',
  },
];

export function LandingPage({
  recentInvestigations,
  demoPreview,
  onStartInvestigation,
  onOpenInvestigation,
  onOpenHistory,
}: LandingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [question, setQuestion] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<'tree' | 'graph' | 'inspector'>('tree');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = question.trim();
    if (cleaned.length < 3) {
      setValidationError('Enter a question to investigate (at least 3 characters).');
      inputRef.current?.focus();
      return;
    }
    setValidationError(null);
    onStartInvestigation(cleaned);
  };

  const handleDemoClick = () => {
    const demoId = demoPreview?.id || 'demo-model-x-dataset-y';
    onOpenInvestigation(demoId);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[var(--background)] text-[var(--text-primary)]">
      {/* Strict 3-Zone Responsive Top Bar (clean down to 320px) */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/92 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Zone 1: Single-line brand wordmark */}
          <a
            href="#top"
            className="font-display text-[15px] sm:text-[17px] font-bold tracking-[0.07em] text-[var(--text-primary)] whitespace-nowrap shrink-0"
          >
            HYPOTHESIS
          </a>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--text-secondary)]"
          >
            <a
              href="#how-it-works"
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              How it works
            </a>
            <a
              href="#workspace-preview"
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Workspace
            </a>
            <button
              type="button"
              onClick={handleDemoClick}
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Demo case
            </button>
            <button
              type="button"
              onClick={onOpenHistory}
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              History
            </button>
          </nav>

          {/* Zone 3: Theme switcher + Single Primary CTA */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
              onClick={() => inputRef.current?.focus()}
              className="rounded-[var(--radius-sm)] bg-[var(--text-primary)] text-[var(--background)] px-3 sm:px-4 h-9 text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="hidden min-[380px]:inline">Start investigating</span>
              <span className="min-[380px]:hidden">Investigate</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 min-w-0">
        {/* Hero & Central Investigation Input */}
        <section className="relative overflow-hidden border-b border-[var(--border)]">
          {/* Subtle architectural optical glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 0%, rgba(79,124,255,0.16), transparent 58%)',
            }}
          />

          <div className="relative max-w-[920px] mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-18 sm:pb-20 md:pt-24 md:pb-24 text-center">
            <p className="text-xs font-medium tracking-[0.04em] text-[var(--accent)] mb-3.5 sm:mb-4">
              Better questions. Clearer evidence. Smarter reasoning.
            </p>

            <h1 className="font-display font-bold tracking-[-0.03em] leading-[1.08] text-[clamp(2rem,5vw,3.75rem)] text-[var(--text-primary)] text-balance max-w-3xl mx-auto">
              Don’t just ask AI.
              <br />
              Investigate with it.
            </h1>

            <p className="mt-4 sm:mt-5 text-[15px] sm:text-[16.5px] leading-relaxed text-[var(--text-secondary)] max-w-2xl mx-auto">
              Turn complex questions into structured investigations backed by real evidence, competing hypotheses, contradiction detection, and transparent reasoning.
            </p>

            {/* Central Investigation Prompt Box */}
            <form
              onSubmit={handleSubmit}
              className="mt-8 sm:mt-10 max-w-2xl mx-auto text-left"
            >
              <label
                htmlFor="hero-investigation-input"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-2 pl-1"
              >
                What do you want to investigate?
              </label>

              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-sm focus-within:border-[var(--accent)] transition-colors p-3 sm:p-3.5">
                <textarea
                  ref={inputRef}
                  id="hero-investigation-input"
                  rows={2}
                  value={question}
                  onChange={(e) => {
                    setQuestion(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask anything. HYPOTHESIS will investigate it."
                  className="w-full resize-none bg-transparent text-[15px] sm:text-[15.5px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />

                <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11.5px] sm:text-xs text-[var(--text-muted)]">
                    Multi-source search · Competing hypotheses · Evidence audit
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-3.5 sm:px-4 h-9 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-auto"
                  >
                    <span>Start investigating</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {validationError && (
                <p role="alert" className="mt-2 text-xs text-[var(--danger)] pl-1">
                  {validationError}
                </p>
              )}
            </form>

            {/* Secondary actions */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs font-medium">
              <button
                type="button"
                onClick={handleDemoClick}
                className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline cursor-pointer"
              >
                <span>Explore Demo Investigation (Model X vs Dataset Y)</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
              <a
                href="#how-it-works"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                See how it works
              </a>
              <button
                type="button"
                onClick={onOpenHistory}
                className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                History
              </button>
            </div>

            {/* Example Investigation Prompts */}
            <div className="mt-10 max-w-3xl mx-auto">
              <p className="text-xs text-[var(--text-muted)] mb-3">
                Try an investigation
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-left">
                {EXAMPLE_QUESTIONS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => onStartInvestigation(example)}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-[13px] leading-snug text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works: 01 — 05 Editorial Process */}
        <section
          id="how-it-works"
          className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-20 border-b border-[var(--border)]"
        >
          <div className="max-w-xl">
            <p className="text-xs font-medium text-[var(--accent)]">
              Investigation methodology
            </p>
            <h2 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] text-balance">
              Why an answer appears credible matters more than a fast reply.
            </h2>
          </div>

          <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {METHODOLOGY_STEPS.map((step) => (
              <div
                key={step.num}
                className="pt-4 border-t border-[var(--border)] space-y-2.5"
              >
                <p className="font-mono text-xs text-[var(--accent)] tabular-nums">
                  {step.num} — {step.title}
                </p>
                <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Live Workspace Demonstration */}
        <section
          id="workspace-preview"
          className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-20 border-b border-[var(--border)]"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-medium text-[var(--accent)]">
                Interactive reasoning workspace
              </p>
              <h2 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] text-balance">
                Every claim traced. Every disagreement exposed.
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                Previewing illustrative demo data from “Why does Model X fail on Dataset Y?” (DEMO / ILLUSTRATIVE).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)] w-fit max-w-full">
              {(
                [
                  { id: 'tree', label: 'Research Tree', icon: GitBranch },
                  { id: 'graph', label: 'Graph', icon: Network },
                  { id: 'inspector', label: 'Evidence Inspector', icon: Scale },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreviewTab(id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    previewTab === id
                      ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[var(--border-subtle)]">
              <div className="text-xs text-[var(--text-secondary)]">
                <span className="font-mono text-[var(--accent)]">DEMO / ILLUSTRATIVE</span>
                <span aria-hidden="true"> · </span>
                <span>Why does Model X fail on Dataset Y?</span>
              </div>
              <button
                type="button"
                onClick={handleDemoClick}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer whitespace-nowrap"
              >
                <span>Open full workspace</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {previewTab === 'tree' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(demoPreview?.hypotheses || []).slice(0, 3).map((h, i) => (
                  <div
                    key={h.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-4 space-y-2"
                  >
                    <p className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                      H{i + 1} · {h.status} · {h.confidence} confidence
                    </p>
                    <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                      {h.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                      {h.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {previewTab === 'graph' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                <div className="rounded-[var(--radius-md)] border border-[var(--accent)]/50 bg-[var(--background)] p-4">
                  <p className="font-mono text-[11px] text-[var(--accent)]">SOURCE A · [4]</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">
                    Confident Learning Audit
                  </p>
                  <p className="mt-1 text-[11.5px] text-[var(--success)]">
                    SUPPORTS → Claim C3 (9–13% label noise)
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--warning)]/50 bg-[var(--background)] p-4">
                  <p className="font-mono text-[11px] text-[var(--warning)]">CLAIM C3 · INFERRED</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">
                    Edge-case labels show 9–13% annotator disagreement
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--danger)]/50 bg-[var(--background)] p-4">
                  <p className="font-mono text-[11px] text-[var(--danger)]">SOURCE B · [2]</p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">
                    Manifold Drift Benchmark
                  </p>
                  <p className="mt-1 text-[11.5px] text-[var(--danger)]">
                    CONTRADICTS → Clean slices show &lt;2% error
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-4">
                  <p className="font-mono text-[11px] text-[var(--text-muted)]">SYNTHESIS</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    Sampling difference explains the conflict: high-loss blur vs. clean slices.
                  </p>
                </div>
              </div>
            )}

            {previewTab === 'inspector' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="font-mono text-xs text-[var(--text-muted)]">
                    C1 · Known · High confidence
                  </p>
                  <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                    Evaluation samples in Dataset Y exhibit a 3.4x higher proportion of low-light, motion-blurred inputs than Model X’s training distribution.
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    Every claim separates verified facts (Known) from reasoned extrapolations (Inferred) and weak hypotheses (Speculative), with explicit uncertainty notes and one-click “Challenge this claim” verification.
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-4 space-y-2 text-xs">
                  <p className="font-medium text-[var(--text-primary)]">
                    Transparent source quality factors
                  </p>
                  <p className="text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">Primary vs Secondary:</span> Prioritizes official data, peer-reviewed papers, and primary audits over unverified blogs.
                  </p>
                  <p className="text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--text-primary)]">Uncertainty:</span> Flags missing metadata, sample bias, or outdated snapshots openly instead of hiding weak evidence.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Recent Persisted Investigations */}
        {recentInvestigations.length > 0 && (
          <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 sm:py-16">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                  Recent investigations
                </h2>
              </div>
              <button
                type="button"
                onClick={onOpenHistory}
                className="text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
              >
                View all history
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentInvestigations.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenInvestigation(item.id)}
                  className="text-left rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)] transition-colors cursor-pointer"
                >
                  <p className="font-display text-sm font-semibold text-[var(--text-primary)] line-clamp-2">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)] tabular-nums">
                    {item.sourceCount} sources · {item.hypothesisCount} hypotheses · Updated {formatRelativeTime(item.updatedAt)}
                  </p>
                  {item.isDemo && (
                    <p className="mt-1 font-mono text-[11px] text-[var(--accent)]">
                      DEMO / ILLUSTRATIVE
                    </p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)] text-center sm:text-left">
          <span className="font-display font-semibold tracking-[0.06em] text-[var(--text-primary)]">
            HYPOTHESIS
          </span>
          <span>Evidence visible · Reasoning traceable · Human in control</span>
        </div>
      </footer>
    </div>
  );
}
