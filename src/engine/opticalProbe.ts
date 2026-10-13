import type {
  DesignSettings,
  MeterWavelength,
  PonEdge,
  PonNode,
  SimulationResult,
} from '../types';
import {
  computeClosureSpliceLoss,
  computeFiberLoss,
  computeNapLoss,
  computeOdfLoss,
  computeSplitterLoss,
  isClosureNode,
  isFiberNode,
  isNapNode,
  isOdfNode,
  isOltNode,
  isSubscriberEndpointNode,
  isSplitterNode,
  simulateTopology,
} from './opticalSimulator';

/** A hit target on the React Flow canvas. Handles identify the physical port. */
export type OpticalProbeTarget =
  | { kind: 'edge'; id: string }
  | {
      kind: 'node';
      id: string;
      handleId?: string | null;
      handleType?: 'source' | 'target' | null;
    };

/**
 * Re-simulate the same graph with the OPM's selected calibration wavelength.
 * This does not modify the editor graph or its committed 1490 nm budget.
 */
export function simulateAtMeterWavelength(
  nodes: PonNode[],
  edges: PonEdge[],
  settings: DesignSettings,
  wavelength: MeterWavelength,
): SimulationResult {
  const calibratedNodes = nodes.map((node): PonNode => {
    if (isOltNode(node)) {
      return { ...node, data: { ...node.data, wavelength, ponStandard: 'GPON' } };
    }
    if (isFiberNode(node)) {
      return { ...node, data: { ...node.data, wavelength } };
    }
    return node;
  });
  return simulateTopology(calibratedNodes, edges, settings);
}

function strongestPower(edgeIds: string[], simulation: SimulationResult): number | null {
  let strongest: number | null = null;
  for (const edgeId of edgeIds) {
    const value = simulation.edgeTelemetry[edgeId]?.powerDbm ?? null;
    if (value !== null && (strongest === null || value > strongest)) strongest = value;
  }
  return strongest;
}

function outputPowerAtUnpatchedPort(
  node: PonNode,
  handleId: string | null | undefined,
  nodes: PonNode[],
  edges: PonEdge[],
  simulation: SimulationResult,
): number | null {
  if (isOltNode(node)) return node.data.laserOn ? node.data.txPowerDbm : null;
  if (isSubscriberEndpointNode(node)) return null;

  const outputIndex = Number(/^out-(\d+)$/.exec(handleId ?? '')?.[1] ?? -1);
  const inputEdgeIds = edges
    .filter((edge) => edge.target === node.id && (
      !isOdfNode(node) || edge.targetHandle === `in-${outputIndex < 0 ? 0 : outputIndex}`
    ))
    .map((edge) => edge.id);
  const incomingPower = strongestPower(inputEdgeIds, simulation);
  if (incomingPower === null) return null;

  if (isFiberNode(node)) return incomingPower - computeFiberLoss(node.data).totalDb;
  if (isSplitterNode(node)) return incomingPower - computeSplitterLoss(node.data);
  if (isOdfNode(node)) return incomingPower - computeOdfLoss(node.data.throughPortLossDb);
  if (isNapNode(node)) return incomingPower - computeNapLoss(node.data.splitLossDb);
  if (isClosureNode(node)) {
    const match = /^out-(\d+)$/.exec(handleId ?? 'out-0');
    const channelIndex = match ? Number(match[1]) : 0;
    if (!node.data.activeSpliceChannels[channelIndex]) return null;
    return incomingPower - computeClosureSpliceLoss(node.data);
  }

  // Keep the node list in the helper signature to make the lookup path explicit
  // for future multi-input components; the current model uses the node's edges.
  void nodes;
  return null;
}

/** Return the simulator-backed optical power at a port, node body, or patch cord. */
export function readOpticalPowerAtProbe(
  target: OpticalProbeTarget,
  nodes: PonNode[],
  edges: PonEdge[],
  simulation: SimulationResult,
): number | null {
  if (target.kind === 'edge') {
    return simulation.edgeTelemetry[target.id]?.powerDbm ?? null;
  }

  const node = nodes.find((candidate) => candidate.id === target.id);
  if (!node) return null;

  if (target.handleType === 'target') {
    const inputEdges = edges.filter(
      (edge) => edge.target === node.id && (!target.handleId || edge.targetHandle === target.handleId),
    );
    return strongestPower(inputEdges.map((edge) => edge.id), simulation);
  }

  if (target.handleType === 'source') {
    const outputEdges = edges.filter(
      (edge) => edge.source === node.id && (!target.handleId || edge.sourceHandle === target.handleId),
    );
    if (outputEdges.length > 0) return strongestPower(outputEdges.map((edge) => edge.id), simulation);
    return outputPowerAtUnpatchedPort(node, target.handleId, nodes, edges, simulation);
  }

  if (isOltNode(node)) return node.data.laserOn ? node.data.txPowerDbm : null;

  const outputEdges = edges.filter((edge) => edge.source === node.id);
  if (outputEdges.length > 0) return strongestPower(outputEdges.map((edge) => edge.id), simulation);

  const inputEdges = edges.filter((edge) => edge.target === node.id);
  if (inputEdges.length > 0) return strongestPower(inputEdges.map((edge) => edge.id), simulation);

  return outputPowerAtUnpatchedPort(node, null, nodes, edges, simulation);
}

/** Stable identity comparison used by the pointer-move handler to avoid frame-by-frame renders. */
export function sameProbeTarget(
  left: OpticalProbeTarget | null,
  right: OpticalProbeTarget | null,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind || left.id !== right.id) return false;
  if (left.kind === 'edge' || right.kind === 'edge') return left.kind === right.kind;
  return left.handleId === right.handleId && left.handleType === right.handleType;
}
