import React from 'react';
import type { Source } from '../types/investigation';

interface RichProseProps {
  content: string;
  sources: Source[];
  onSelectSource: (sourceId: string) => void;
}

/**
 * Safe React renderer for conversational Markdown prose, fenced code blocks,
 * inline code, lists, and interactive [1] citations. Never uses dangerouslySetInnerHTML.
 */
export function RichProse({ content, sources, onSelectSource }: RichProseProps) {
  const sourceByIndex = new Map<number, Source>();
  sources.forEach((s) => sourceByIndex.set(s.citationIndex, s));

  const renderInline = (line: string, keyPrefix: string): React.ReactNode[] => {
    const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[\d+\])/g;
    const parts = line.split(tokenRegex);

    return parts.map((part, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code
            key={key}
            className="rounded px-1.5 py-0.5 font-mono text-[12.5px] bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-subtle)] break-words"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={key} className="font-semibold text-[var(--text-primary)]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return (
          <em key={key} className="italic text-[var(--text-secondary)]">
            {part.slice(1, -1)}
          </em>
        );
      }
      const citMatch = /^\[(\d+)\]$/.exec(part);
      if (citMatch) {
        const num = Number(citMatch[1]);
        const matchedSource = sourceByIndex.get(num);
        if (matchedSource) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectSource(matchedSource.id)}
              title={`${matchedSource.title} (${matchedSource.domain})`}
              aria-label={`Inspect source ${num}: ${matchedSource.title}`}
              className="mx-0.5 inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-soft)] hover:opacity-85 transition-opacity cursor-pointer align-baseline tabular-nums"
            >
              [{num}]
            </button>
          );
        }
        return (
          <span
            key={key}
            className="mx-0.5 font-mono text-[11px] text-[var(--text-muted)] tabular-nums"
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
  };

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  const flushList = (keyIdx: number) => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${keyIdx}`}
        className="my-3 space-y-1.5 pl-4 list-disc marker:text-[var(--text-muted)]"
      >
        {listBuffer.map((item, i) => (
          <li
            key={`li-${keyIdx}-${i}`}
            className="text-[14.5px] sm:text-[15px] leading-[1.68] text-[var(--text-secondary)] break-words"
          >
            {renderInline(item, `li-${keyIdx}-${i}`)}
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  const flushCode = (keyIdx: number) => {
    if (codeLines.length === 0 && !inCodeBlock) return;
    blocks.push(
      <div
        key={`code-${keyIdx}`}
        className="my-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-secondary)] overflow-hidden"
      >
        {codeLang && (
          <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-muted)]">
            {codeLang}
          </div>
        )}
        <pre className="p-3 overflow-x-auto text-[12.5px] leading-relaxed font-mono text-[var(--text-primary)]">
          <code>{codeLines.join('\n')}</code>
        </pre>
      </div>
    );
    codeLines = [];
    codeLang = '';
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      flushList(idx);
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
      } else {
        inCodeBlock = false;
        flushCode(idx);
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!trimmed) {
      flushList(idx);
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList(idx);
      blocks.push(
        <h3
          key={`h3-${idx}`}
          className="mt-5 mb-1.5 font-display text-[15px] font-semibold tracking-tight text-[var(--text-primary)]"
        >
          {renderInline(trimmed.slice(4), `h3-${idx}`)}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList(idx);
      blocks.push(
        <h2
          key={`h2-${idx}`}
          className="mt-5 mb-2 font-display text-[16px] font-semibold tracking-tight text-[var(--text-primary)]"
        >
          {renderInline(trimmed.slice(3), `h2-${idx}`)}
        </h2>
      );
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      listBuffer.push(trimmed.slice(2).trim());
      return;
    }

    flushList(idx);
    blocks.push(
      <p
        key={`p-${idx}`}
        className="my-2.5 text-[14.5px] sm:text-[15px] leading-[1.68] text-[var(--text-secondary)] break-words"
      >
        {renderInline(trimmed, `p-${idx}`)}
      </p>
    );
  });

  if (inCodeBlock) {
    flushCode(lines.length);
  }
  flushList(lines.length);

  return <div className="min-w-0 break-words">{blocks}</div>;
}
