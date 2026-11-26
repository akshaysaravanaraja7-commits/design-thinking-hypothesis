import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { Source } from '../../types/investigation';
import { sanitizeExternalUrl } from '../../utils/investigationLogic';

interface SourceCardProps {
  source: Source;
  isSelected: boolean;
  onSelect: () => void;
}

function getTierColor(tier: Source['qualityTier']): string {
  switch (tier) {
    case 'Strong':
      return 'text-[var(--success)]';
    case 'Moderate':
      return 'text-[var(--warning)]';
    default:
      return 'text-[var(--danger)]';
  }
}

export function SourceCard({ source, isSelected, onSelect }: SourceCardProps) {
  const [factorsOpen, setFactorsOpen] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const safeHref = sanitizeExternalUrl(source.url);

  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <article
      ref={cardRef}
      onClick={onSelect}
      className={`rounded-[var(--radius-md)] border p-3.5 space-y-2.5 transition-colors cursor-pointer min-w-0 ${
        isSelected
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]/50'
      }`}
    >
      {/* Top metadata line: citation, domain, source type, quality tier */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
        <div className="flex flex-wrap items-center gap-x-1.5 min-w-0">
          <span className="font-semibold text-[var(--accent)]">
            [{source.citationIndex}]
          </span>
          <span className="text-[var(--text-secondary)] truncate max-w-[170px]">
            {source.domain}
          </span>
          <span aria-hidden="true" className="text-[var(--border)]">·</span>
          <span className="text-[var(--text-muted)]">{source.sourceType}</span>
        </div>

        <span className={`font-medium shrink-0 ${getTierColor(source.qualityTier)}`}>
          {source.qualityTier}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display text-[13.5px] font-semibold leading-snug text-[var(--text-primary)]">
        {source.title}
      </h3>

      {/* Excerpt */}
      {source.excerpt && (
        <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)] line-clamp-4">
          “{source.excerpt}”
        </p>
      )}

      {/* Why it matters */}
      {source.whyItMatters && (
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          {source.whyItMatters}
        </p>
      )}

      {/* Relationship summary & actions */}
      <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
        <div className="flex flex-wrap items-center gap-x-2 text-[var(--text-muted)] tabular-nums">
          {source.supportedClaimIds.length > 0 && (
            <span className="text-[var(--success)]">
              Supports {source.supportedClaimIds.length}{' '}
              {source.supportedClaimIds.length === 1 ? 'claim' : 'claims'}
            </span>
          )}
          {source.contradictedClaimIds.length > 0 && (
            <span className="text-[var(--danger)]">
              Contradicts {source.contradictedClaimIds.length}
            </span>
          )}
          {source.supportedClaimIds.length === 0 &&
            source.contradictedClaimIds.length === 0 && (
              <span>Context source</span>
            )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {source.qualityFactors.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFactorsOpen((prev) => !prev);
              }}
              aria-expanded={factorsOpen}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <span>Quality</span>
              {factorsOpen ? (
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              )}
            </button>
          )}

          {safeHref && (
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
            >
              <span>Open source</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {/* Expandable transparent quality factors */}
      {factorsOpen && source.qualityFactors.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="animate-fade-in pt-2.5 border-t border-[var(--border-subtle)] space-y-1.5"
        >
          {source.qualityFactors.map((qf, idx) => (
            <div key={idx} className="text-[11.5px] leading-relaxed">
              <span className="font-medium text-[var(--text-primary)]">
                {qf.factor}:{' '}
              </span>
              <span className="text-[var(--text-secondary)]">{qf.assessment}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
