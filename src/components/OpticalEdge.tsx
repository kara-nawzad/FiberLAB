import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import type { PonEdge } from '../types';
import { EDGE_STROKE } from '../engine/edgeDecoration';

/**
 * Optical patch edge. Colour encodes the state of the light travelling it:
 *   green  — live, above receiver sensitivity
 *   red    — light present but below sensitivity (LOS territory)
 *   grey   — idle, no energised OLT path
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
    curvature: 0.28,
  });

  const state = data?.edgeState ?? 'idle';
  const powerDbm = data?.powerDbm ?? null;
  const faultLabels = data?.faultLabels ?? [];

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={`optical-edge is-${state}`}
        style={{
          stroke: EDGE_STROKE[state],
          strokeWidth: selected ? 3.5 : 2.25,
          opacity: selected ? 1 : 0.92,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-none absolute inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700 shadow-sm"
          title={faultLabels.length > 0 ? faultLabels.join(' · ') : undefined}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            opacity: powerDbm === null ? 0.55 : 1,
            borderColor: powerDbm === null ? undefined : `${EDGE_STROKE[state]}66`,
          }}
        >
          {faultLabels.length > 0 ? (
            <AlertTriangle
              size={11}
              className="optical-edge-warning shrink-0"
              aria-label={faultLabels.join(', ')}
            />
          ) : null}
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: EDGE_STROKE[state] }} />
          {powerDbm === null ? 'idle' : `${powerDbm >= 0 ? '+' : ''}${powerDbm.toFixed(1)} dBm`}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default OpticalEdge;
