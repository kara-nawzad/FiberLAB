import { MarkerType } from '@xyflow/react';
import type { EdgeTelemetry, FiberEdgeData, PonEdge, PonNode } from '../types';

/* ========================================================================== *
 * Edge presentation — turns simulator telemetry into React Flow edge props.
 * Kept out of the physics engine so the engine stays environment-free and
 * directly unit-testable.
 * ========================================================================== */

/** Stroke colour per optical edge state — royal blue for active optical paths. */
export const EDGE_STROKE: Record<EdgeTelemetry['edgeState'], string> = {
  live: '#2563EB',
  degraded: '#DC2626',
  idle: '#94A3B8',
};

export interface DecorateEdgesOptions {
  hideFaults?: boolean;
  highlightedEdgeIds?: ReadonlySet<string>;
}

/** Applies the simulator's edge telemetry onto React Flow edges. */
export function decorateEdges(
  edges: PonEdge[],
  telemetry: Record<string, EdgeTelemetry>,
  nodes: PonNode[] = [],
  options: DecorateEdgesOptions = {},
): PonEdge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => {
    const reading: EdgeTelemetry = telemetry[edge.id] ?? { powerDbm: null, edgeState: 'idle' };
    const sourceNode = nodeById.get(edge.source);
    const faultLabels =
      !options.hideFaults && sourceNode?.type === 'fiber'
        ? [
            sourceNode.data.macroBendActive ? 'Macro-bend loss on this span' : null,
            sourceNode.data.dirtyConnectorActive ? 'Dust contamination loss on this span' : null,
          ].filter((label): label is string => label !== null)
        : [];
    const isHighlightedPath = Boolean(options.highlightedEdgeIds?.has(edge.id));
    const data: FiberEdgeData = {
      powerDbm: reading.powerDbm,
      edgeState: reading.edgeState,
      faultLabels,
      isHighlightedPath,
    };
    return {
      ...edge,
      data,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 13,
        height: 13,
        color: isHighlightedPath ? '#7C3AED' : EDGE_STROKE[reading.edgeState],
      },
    };
  });
}
