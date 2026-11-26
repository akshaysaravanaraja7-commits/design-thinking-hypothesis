import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Network, Plus } from 'lucide-react';
import type { GraphNodePosition, Investigation } from '../../types/investigation';
import { computeGraphLayout } from '../../utils/investigationLogic';
import { EmptyState } from '../common/EmptyState';

interface InvestigationGraphProps {
  investigation: Investigation;
  selectedClaimId: string | null;
  selectedSourceId: string | null;
  onSelectClaim: (claimId: string) => void;
  onSelectSource: (sourceId: string) => void;
}

const MIN_SCALE = 0.34;
const MAX_SCALE = 1.6;

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function getTouchDistance(touches: React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function InvestigationGraph({
  investigation,
  selectedClaimId,
  selectedSourceId,
  onSelectClaim,
  onSelectSource,
}: InvestigationGraphProps) {
  const [edgeFilter, setEdgeFilter] = useState<'ALL' | 'SUPPORTS' | 'CONTRADICTS'>('ALL');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef<string | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const pinchRef = useRef<{ distance: number; startScale: number } | null>(null);

  const layout = useMemo(
    () => computeGraphLayout(investigation, edgeFilter),
    [investigation, edgeFilter]
  );

  // Fit entire graph edge-to-edge on desktop/tablet; keep readable pan scale on narrow mobile
  const fitToViewport = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;

    const padding = 20;
    const fitX = (rect.width - padding * 2) / layout.width;
    const fitY = (rect.height - padding * 2) / layout.height;
    const floor = rect.width < 460 ? 0.48 : MIN_SCALE;
    const nextScale = clamp(Math.min(fitX, fitY, 1.0), floor, 1.0);

    const renderedW = layout.width * nextScale;
    const renderedH = layout.height * nextScale;
    const nextX = (rect.width - renderedW) / 2;
    const nextY = Math.max(16, (rect.height - renderedH) / 2);

    setScale(nextScale);
    setPan({ x: nextX, y: nextY });
  }, [layout.width, layout.height]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const syncFit = () => {
      if (hasInitializedRef.current !== investigation.id) {
        hasInitializedRef.current = investigation.id;
        fitToViewport();
      }
    };

    syncFit();
    const observer = new ResizeObserver(() => {
      fitToViewport();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [investigation.id, fitToViewport]);

  const handleZoomBy = (delta: number) => {
    const el = viewportRef.current;
    if (!el) {
      setScale((prev) => clamp(prev + delta, MIN_SCALE, MAX_SCALE));
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    setScale((prevScale) => {
      const nextScale = clamp(Number((prevScale + delta).toFixed(2)), MIN_SCALE, MAX_SCALE);
      const ratio = nextScale / prevScale;
      setPan((prevPan) => ({
        x: cx - (cx - prevPan.x) * ratio,
        y: cy - (cy - prevPan.y) * ratio,
      }));
      return nextScale;
    });
  };

  // Pointer drag-to-pan (works for mouse and single-finger touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button')) return;

    dragStateRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active || pinchRef.current) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragStateRef.current.moved = true;
    }
    setPan({
      x: dragStateRef.current.originX + dx,
      y: dragStateRef.current.originY + dy,
    });
  };

  const handlePointerUp = () => {
    dragStateRef.current.active = false;
    setIsDragging(false);
  };

  // Two-finger pinch-zoom on mobile / tablet
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      dragStateRef.current.active = false;
      setIsDragging(false);
      pinchRef.current = {
        distance: getTouchDistance(e.touches),
        startScale: scale,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const currentDist = getTouchDistance(e.touches);
      if (pinchRef.current.distance > 0) {
        const nextScale = clamp(
          pinchRef.current.startScale * (currentDist / pinchRef.current.distance),
          MIN_SCALE,
          MAX_SCALE
        );
        setScale(nextScale);
      }
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  const handleNodeClick = (node: GraphNodePosition) => {
    if (dragStateRef.current.moved) return;
    if (node.kind === 'claim') {
      onSelectClaim(node.id);
    } else if (node.kind === 'source') {
      onSelectSource(node.id);
    }
  };

  if (investigation.hypotheses.length === 0 && investigation.claims.length === 0) {
    return (
      <EmptyState
        icon={<Network className="w-5 h-5" aria-hidden="true" />}
        title="Investigation graph pending"
        description="Once hypotheses, claims, and sources are structured, their supporting and contradicting links will render here."
      />
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-[var(--background)] overflow-hidden">
      {/* Compact responsive graph toolbar */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Filter graph relationships"
          className="flex items-center gap-1 p-0.5 rounded-[var(--radius-sm)] bg-[var(--surface-secondary)]"
        >
          {(
            [
              { id: 'ALL', label: 'All links' },
              { id: 'SUPPORTS', label: 'Supports' },
              { id: 'CONTRADICTS', label: 'Contradicts' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setEdgeFilter(id)}
              className={`px-2.5 py-1 text-[11.5px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                edgeFilter === id
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleZoomBy(-0.15)}
            aria-label="Zoom out graph"
            className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <span className="min-w-[42px] text-center font-mono text-[11px] text-[var(--text-secondary)] tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => handleZoomBy(0.15)}
            aria-label="Zoom in graph"
            className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={fitToViewport}
            aria-label="Fit graph to view"
            className="h-7 px-2 inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Maximize2 className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:inline">Fit</span>
          </button>
        </div>
      </div>

      {/* Bounded interactive pan/zoom canvas */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`flex-1 min-h-0 relative overflow-hidden touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        aria-label="Interactive investigation evidence graph. Drag to pan, tap claims or sources to inspect."
      >
        <svg
          width="100%"
          height="100%"
          className="block w-full h-full"
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Relationship Edges */}
            {layout.edges.map((edge) => {
              const x1 = edge.from.x + edge.from.width / 2;
              const y1 = edge.from.y;
              const x2 = edge.to.x + edge.to.width / 2;
              const y2 = edge.to.y + edge.to.height;
              const midY = (y1 + y2) / 2;

              const isConnectedToHover =
                hoveredNodeId === edge.from.id || hoveredNodeId === edge.to.id;
              const isConnectedToSelection =
                selectedClaimId === edge.from.id ||
                selectedClaimId === edge.to.id ||
                selectedSourceId === edge.from.id ||
                selectedSourceId === edge.to.id;

              const strokeColor =
                edge.type === 'CONTRADICTS'
                  ? 'var(--danger)'
                  : edge.type === 'SUPPORTS'
                    ? 'var(--success)'
                    : 'var(--border)';

              const opacity =
                hoveredNodeId || selectedClaimId || selectedSourceId
                  ? isConnectedToHover || isConnectedToSelection
                    ? 0.9
                    : 0.22
                  : 0.6;

              return (
                <path
                  key={edge.id}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isConnectedToHover || isConnectedToSelection ? 2.2 : 1.4}
                  strokeDasharray={edge.type === 'CONTRADICTS' ? '5 4' : undefined}
                  opacity={opacity}
                />
              );
            })}

            {/* Tier Nodes */}
            {layout.nodes.map((node) => {
              const isSelected =
                (node.kind === 'claim' && node.id === selectedClaimId) ||
                (node.kind === 'source' && node.id === selectedSourceId);
              const isInteractive = node.kind === 'claim' || node.kind === 'source';

              const strokeColor = isSelected
                ? 'var(--accent)'
                : node.kind === 'question'
                  ? 'var(--accent)'
                  : node.kind === 'hypothesis'
                    ? 'var(--border)'
                    : node.kind === 'claim'
                      ? node.classification === 'Known'
                        ? 'var(--success)'
                        : node.classification === 'Inferred'
                          ? 'var(--warning)'
                          : 'var(--border)'
                      : 'var(--border)';

              const sublabelColor =
                node.kind === 'question'
                  ? 'var(--accent)'
                  : node.kind === 'claim' && node.classification === 'Known'
                    ? 'var(--success)'
                    : node.kind === 'claim' && node.classification === 'Inferred'
                      ? 'var(--warning)'
                      : 'var(--text-muted)';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onKeyDown={(e) => {
                    if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleNodeClick(node);
                    }
                  }}
                  role={isInteractive ? 'button' : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  aria-label={isInteractive ? `${node.kind} ${node.id}: ${node.label}` : undefined}
                  style={{ cursor: isInteractive ? 'pointer' : 'default' }}
                >
                  <rect
                    width={node.width}
                    height={node.height}
                    rx={10}
                    fill={isSelected ? 'var(--surface-secondary)' : 'var(--surface)'}
                    stroke={strokeColor}
                    strokeWidth={isSelected || node.kind === 'question' ? 1.8 : 1.1}
                  />
                  <foreignObject
                    x={10}
                    y={8}
                    width={node.width - 20}
                    height={node.height - 16}
                  >
                    <div className="h-full flex flex-col justify-between overflow-hidden pointer-events-none">
                      <span
                        className="font-mono text-[10px] truncate leading-none"
                        style={{ color: sublabelColor }}
                      >
                        {node.sublabel}
                      </span>
                      <p className="text-[11.5px] font-medium leading-snug text-[var(--text-primary)] line-clamp-2">
                        {node.label}
                      </p>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Subtle bottom-left legend + pan hint */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <div className="inline-flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/92 backdrop-blur-xs px-2.5 py-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[var(--success)]" aria-hidden="true" />
              Supports
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 border-t border-dashed border-[var(--danger)]" aria-hidden="true" />
              Contradicts
            </span>
          </div>
          <span className="hidden sm:inline rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/92 backdrop-blur-xs px-2.5 py-1">
            Drag to pan · Click claim or source to inspect
          </span>
        </div>
      </div>
    </div>
  );
}
