import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import type { PonEdge } from '../types';
import { EDGE_STROKE } from '../engine/edgeDecoration';

/**
 * Physical optical fiber connection between hardware ports.
 *   live     — royal blue (#2563EB) with soft optical glow
 *   degraded — red (#DC2626) when light arrives below receiver sensitivity
 *   idle     — slate (#94A3B8) when unlit
 */
export function OpticalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<PonEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const state = data?.edgeState ?? 'idle';
  const powerDbm = data?.powerDbm ?? null;
  const faultLabels = data?.faultLabels ?? [];
  const isHighlighted = Boolean(selected || data?.isHighlightedPath);
  const strokeColor = isHighlighted ? '#7C3AED' : EDGE_STROKE[state];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={`optical-edge is-${state} ${isHighlighted ? 'is-selected' : ''}`}
        style={{
          stroke: strokeColor,
          strokeWidth: isHighlighted ? 3.4 : state === 'live' ? 2.5 : 2.1,
          opacity: isHighlighted ? 1 : state === 'idle' ? 0.72 : 0.94,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="optical-edge-pill pointer-events-none absolute inline-flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold text-slate-700 shadow-xs"
          title={faultLabels.length > 0 ? faultLabels.join(' · ') : undefined}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: powerDbm === null ? 0.6 : 0.95,
            borderColor: isHighlighted ? '#7C3AED' : powerDbm === null ? '#CBD5E1' : `${EDGE_STROKE[state]}44`,
          }}
        >
          {faultLabels.length > 0 ? (
            <AlertTriangle
              size={10}
              className="optical-edge-warning shrink-0 text-amber-600"
              aria-label={faultLabels.join(', ')}
            />
          ) : null}
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: isHighlighted ? '#7C3AED' : EDGE_STROKE[state] }}
          />
          <span className={state === 'degraded' ? 'text-red-600' : 'text-slate-700'}>
            {powerDbm === null ? 'idle' : `${powerDbm >= 0 ? '+' : ''}${powerDbm.toFixed(1)} dBm`}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default OpticalEdge;
