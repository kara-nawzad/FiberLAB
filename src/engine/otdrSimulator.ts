import type { PonEdge, PonNode, SubscriberEndpointNode, Wavelength } from '../types';
import {
  ATTENUATION_DB_PER_KM,
  CLOSURE_SPLICE_LOSS_MAX_DB,
  CLOSURE_SPLICE_LOSS_MIN_DB,
  CONNECTOR_LOSS_DB,
  DEFAULT_CLOSURE_SPLICE_LOSS_DB,
  DEFAULT_ODF_THROUGH_PORT_LOSS_DB,
  DIRTY_CONNECTOR_PENALTY_DB,
  NAP_SPLIT_LOSS_DB,
  NAP_SPLIT_RATIO,
  MACRO_BEND_PENALTY_DB,
  SPLICE_LOSS_DB,
  SPLITTER_LOSS_DB,
} from '../types';

/** A discrete reflection or loss transition detected on the OTDR trace. */
export interface OtdrEvent {
  id: string;
  type: 'launch' | 'fiber_span' | 'splice' | 'splitter' | 'odf' | 'nap' | 'connector' | 'fault_bend' | 'end_of_fiber';
  distanceKm: number;
  /** Signed trace step: losses are negative, reflective peaks are positive. */
  relativeLossDb: number;
  /** Apparent reflective peak above local Rayleigh backscatter, when present. */
  reflectionPeakDb?: number;
  /** Cumulative one-way plant loss at this event; OTDR safety margin is not included. */
  cumulativeLossDb: number;
  description: string;
  passFail: 'PASS' | 'WARNING' | 'FAIL';
}

export interface OtdrTracePoint {
  distanceKm: number;
  /** Relative Rayleigh backscatter power in dB, referenced to the launch trace. */
  powerDb: number;
}

export interface OtdrAnalysisResult {
  wavelengthNm: number;
  pulseWidthNs: number;
  totalDistanceKm: number;
  totalLossDb: number;
  events: OtdrEvent[];
  tracePoints: OtdrTracePoint[];
}

export const OTDR_PULSE_WIDTHS_NS = [10, 100, 1000] as const;
export type OtdrPulseWidthNs = (typeof OTDR_PULSE_WIDTHS_NS)[number];

const TRACE_SAMPLE_COUNT = 240;
const TRACE_NOISE_FLOOR_DB = -45;
const MAX_PATH_DEPTH = 96;

interface TraceRoute {
  nodes: PonNode[];
  edges: PonEdge[];
}

interface FiberRange {
  startKm: number;
  endKm: number;
  attenuationDbPerKm: number;
}

type PointEventType = Extract<OtdrEvent['type'], 'splice' | 'splitter' | 'odf' | 'nap' | 'connector' | 'fault_bend'>;

interface PointLoss {
  id: string;
  type: PointEventType;
  distanceKm: number;
  lossDb: number;
  reflectionPeakDb?: number;
  description: string;
  passFail: OtdrEvent['passFail'];
  order: number;
}

function isSupportedWavelength(value: number): value is Wavelength {
  return value === 1270 || value === 1310 || value === 1490 || value === 1550 || value === 1577;
}

function attenuationAt(wavelengthNm: number): number {
  return isSupportedWavelength(wavelengthNm) ? ATTENUATION_DB_PER_KM[wavelengthNm] : ATTENUATION_DB_PER_KM[1490];
}

function stableOutgoingEdges(edges: PonEdge[], nodeId: string): PonEdge[] {
  return edges
    .filter((edge) => edge.source === nodeId)
    .sort((left, right) => (
      (left.sourceHandle ?? '').localeCompare(right.sourceHandle ?? '', undefined, { numeric: true }) ||
      left.target.localeCompare(right.target) ||
      left.id.localeCompare(right.id)
    ));
}

function findRoute(
  nodes: PonNode[],
  edges: PonEdge[],
  startNodeId: string,
  targetOntId: string,
): TraceRoute | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const startNode = nodeById.get(startNodeId);
  const targetNode = nodeById.get(targetOntId);
  if (
    !startNode ||
    (targetNode?.type !== 'ont' && targetNode?.type !== 'gateway') ||
    startNode.type === 'ont' || startNode.type === 'gateway'
  ) return null;

  const pathNodes: PonNode[] = [startNode];
  const pathEdges: PonEdge[] = [];
  const onPath = new Set<string>([startNode.id]);

  const walk = (node: PonNode, depth: number): boolean => {
    if (node.id === targetOntId) return true;
    if (depth >= MAX_PATH_DEPTH) return false;

    for (const edge of stableOutgoingEdges(edges, node.id)) {
      const next = nodeById.get(edge.target);
      if (!next || onPath.has(next.id)) continue;
      // The simulator graph is directed, and an OLT is a source-only element.
      if (next.type === 'olt') continue;
      if (node.type === 'odf') {
        const incomingEdge = pathEdges[pathEdges.length - 1];
        const inputIndex = Number(/^in-(\d+)$/.exec(incomingEdge?.targetHandle ?? 'in-0')?.[1] ?? 0);
        if (edge.sourceHandle !== `out-${inputIndex}`) continue;
      }
      if (node.type === 'nap') {
        const outputIndex = Number(/^out-(\d+)$/.exec(edge.sourceHandle ?? '')?.[1] ?? -1);
        if (!Number.isInteger(outputIndex) || outputIndex < 0 || outputIndex >= 8) continue;
      }
      if (node.type === 'closure') {
        const branchIndex = Number(/^out-(\d+)$/.exec(edge.sourceHandle ?? '')?.[1] ?? -1);
        if (!Number.isInteger(branchIndex) || !node.data.activeSpliceChannels[branchIndex]) continue;
      }
      pathEdges.push(edge);
      pathNodes.push(next);
      onPath.add(next.id);
      if (walk(next, depth + 1)) return true;
      onPath.delete(next.id);
      pathNodes.pop();
      pathEdges.pop();
    }
    return false;
  };

  return walk(startNode, 0) ? { nodes: [...pathNodes], edges: [...pathEdges] } : null;
}

/** Returns the ONTs and integrated gateways reachable from an instrument launch node. */
export function getReachableOtdrTargets(
  nodes: PonNode[],
  edges: PonEdge[],
  startNodeId: string,
): SubscriberEndpointNode[] {
  return nodes
    .filter((node): node is SubscriberEndpointNode => node.type === 'ont' || node.type === 'gateway')
    .filter((node) => findRoute(nodes, edges, startNodeId, node.id) !== null);
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function positiveCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(64, Math.floor(value))) : 0;
}

function spliceStatus(lossDb: number): OtdrEvent['passFail'] {
  if (lossDb <= 0.3) return 'PASS';
  if (lossDb <= 0.8) return 'WARNING';
  return 'FAIL';
}

function splitterStatus(excessLossDb: number): OtdrEvent['passFail'] {
  if (excessLossDb <= 1) return 'PASS';
  if (excessLossDb <= 3) return 'WARNING';
  return 'FAIL';
}

function makeEmptyTrace(wavelengthNm: number, pulseWidthNs: number): OtdrAnalysisResult {
  return {
    wavelengthNm,
    pulseWidthNs,
    totalDistanceKm: 0,
    totalLossDb: 0,
    events: [],
    tracePoints: Array.from({ length: TRACE_SAMPLE_COUNT }, (_, index) => ({
      distanceKm: (35 * index) / (TRACE_SAMPLE_COUNT - 1),
      powerDb: TRACE_NOISE_FLOOR_DB,
    })),
  };
}

/**
 * Finds one deterministic directed route and synthesizes a teaching OTDR trace.
 * When no target is supplied, the longest reachable subscriber branch is used
 * (subscriber ID is the stable tie-breaker). Component locations inside a fiber
 * are not stored in the topology, so its splice/connector/fault events are
 * evenly placed along that span. The OTDR is a diagnostic learning model, not
 * an instrument calibration or an extra optical-simulator pass/fail equation.
 */
export function generateOtdrTrace(
  nodes: PonNode[],
  edges: PonEdge[],
  startNodeId: string,
  targetOntId?: string,
  wavelengthNm = 1490,
  pulseWidthNs: number = 100,
): OtdrAnalysisResult {
  const measuredWavelengthNm = isSupportedWavelength(wavelengthNm) ? wavelengthNm : 1490;
  const measuredPulseWidthNs = OTDR_PULSE_WIDTHS_NS.includes(pulseWidthNs as OtdrPulseWidthNs)
    ? pulseWidthNs
    : 100;
  const startNode = nodes.find((node) => node.id === startNodeId);
  if (!startNode || startNode.type === 'ont' || startNode.type === 'gateway') return makeEmptyTrace(measuredWavelengthNm, measuredPulseWidthNs);

  let route: TraceRoute | null = null;
  if (targetOntId) {
    route = findRoute(nodes, edges, startNodeId, targetOntId);
  } else {
    const candidates = getReachableOtdrTargets(nodes, edges, startNodeId)
      .map((ont) => findRoute(nodes, edges, startNodeId, ont.id))
      .filter((candidate): candidate is TraceRoute => candidate !== null)
      .map((candidate) => ({
        route: candidate,
        distance: candidate.nodes.reduce((sum, node) => (
          node.type === 'fiber' ? sum + Math.max(0, node.data.lengthKm) : sum
        ), 0),
        targetId: candidate.nodes[candidate.nodes.length - 1]?.id ?? '',
      }))
      .sort((left, right) => right.distance - left.distance || left.targetId.localeCompare(right.targetId));
    route = candidates[0]?.route ?? null;
  }
  if (!route) return makeEmptyTrace(measuredWavelengthNm, measuredPulseWidthNs);

  const events: OtdrEvent[] = [];
  const fiberRanges: FiberRange[] = [];
  const pointLosses: PointLoss[] = [];
  let distanceKm = 0;
  let cumulativeLossDb = 0;
  let pointOrder = 0;

  const addEvent = (
    type: OtdrEvent['type'],
    id: string,
    atKm: number,
    relativeLossDb: number,
    description: string,
    passFail: OtdrEvent['passFail'],
    reflectionPeakDb?: number,
  ) => {
    events.push({
      id,
      type,
      distanceKm: rounded(atKm),
      relativeLossDb: rounded(relativeLossDb),
      ...(reflectionPeakDb === undefined ? {} : { reflectionPeakDb: rounded(reflectionPeakDb) }),
      cumulativeLossDb: rounded(cumulativeLossDb),
      description,
      passFail,
    });
  };

  addEvent('launch', `${startNodeId}:launch`, 0, 0, 'OTDR launch pulse at the selected source', 'PASS', 2.5);

  for (let nodeIndex = 0; nodeIndex < route.nodes.length; nodeIndex += 1) {
    const node = route.nodes[nodeIndex];
    const outgoingEdge = route.edges[nodeIndex];

    if (node.type === 'fiber') {
      const lengthKm = Number.isFinite(node.data.lengthKm) ? Math.max(0, node.data.lengthKm) : 0;
      const configuredAttenuation = node.data.attenuationOverrideDbPerKm;
      const alpha = typeof configuredAttenuation === 'number' && Number.isFinite(configuredAttenuation) && configuredAttenuation > 0
        ? configuredAttenuation
        : attenuationAt(measuredWavelengthNm);
      const spanStartKm = distanceKm;
      const spanEndKm = spanStartKm + lengthKm;
      fiberRanges.push({ startKm: spanStartKm, endKm: spanEndKm, attenuationDbPerKm: alpha });
      const spanLossDb = lengthKm * alpha;
      const withinSpan: PointLoss[] = [];
      const connectorCount = positiveCount(node.data.connectors);
      const spliceCount = positiveCount(node.data.splices);

      for (let index = 0; index < connectorCount; index += 1) {
        const fraction = (index + 1) / (connectorCount + 1);
        withinSpan.push({
          id: `${node.id}:connector-${index + 1}`,
          type: 'connector',
          distanceKm: spanStartKm + lengthKm * fraction,
          lossDb: CONNECTOR_LOSS_DB,
          reflectionPeakDb: 1.8,
          description: `SC/APC connector ${index + 1} · ${CONNECTOR_LOSS_DB.toFixed(1)} dB insertion loss`,
          passFail: 'PASS',
          order: pointOrder++,
        });
      }
      for (let index = 0; index < spliceCount; index += 1) {
        const fraction = (index + 1) / (spliceCount + 1);
        withinSpan.push({
          id: `${node.id}:splice-${index + 1}`,
          type: 'splice',
          distanceKm: spanStartKm + lengthKm * fraction,
          lossDb: SPLICE_LOSS_DB,
          description: `Fusion splice ${index + 1} · ${SPLICE_LOSS_DB.toFixed(2)} dB expected loss`,
          passFail: spliceStatus(SPLICE_LOSS_DB),
          order: pointOrder++,
        });
      }
      if (node.data.macroBendActive) {
        withinSpan.push({
          id: `${node.id}:macro-bend`,
          type: 'fault_bend',
          distanceKm: spanStartKm + lengthKm * 0.5,
          lossDb: MACRO_BEND_PENALTY_DB,
          description: `Macro-bend fault · ${MACRO_BEND_PENALTY_DB.toFixed(1)} dB teaching penalty`,
          passFail: 'FAIL',
          order: pointOrder++,
        });
      }
      if (node.data.dirtyConnectorActive) {
        withinSpan.push({
          id: `${node.id}:dirty-connector`,
          type: 'fault_bend',
          distanceKm: spanStartKm + lengthKm * 0.5,
          lossDb: DIRTY_CONNECTOR_PENALTY_DB,
          description: `Dirty SC/APC connector / ferrule fault · ${DIRTY_CONNECTOR_PENALTY_DB.toFixed(1)} dB teaching penalty`,
          passFail: 'FAIL',
          order: pointOrder++,
        });
      }

      withinSpan.sort((left, right) => left.distanceKm - right.distanceKm || left.order - right.order);
      let integratedDistanceKm = spanStartKm;
      for (const point of withinSpan) {
        const pointDistanceKm = Math.min(spanEndKm, Math.max(integratedDistanceKm, point.distanceKm));
        cumulativeLossDb += (pointDistanceKm - integratedDistanceKm) * alpha;
        integratedDistanceKm = pointDistanceKm;
        cumulativeLossDb += point.lossDb;
        pointLosses.push({ ...point, distanceKm: pointDistanceKm });
        addEvent(
          point.type,
          point.id,
          pointDistanceKm,
          -point.lossDb,
          point.description,
          point.passFail,
          point.reflectionPeakDb,
        );
      }
      cumulativeLossDb += (spanEndKm - integratedDistanceKm) * alpha;
      distanceKm = spanEndKm;
      addEvent(
        'fiber_span',
        `${node.id}:span`,
        spanEndKm,
        -spanLossDb,
        `${node.data.cableType} fiber · ${lengthKm.toFixed(3)} km at ${alpha.toFixed(3)} dB/km`,
        'PASS',
      );
      continue;
    }

    if (node.type === 'splitter') {
      const catalogueLossDb = SPLITTER_LOSS_DB[node.data.ratio];
      const excessLossDb = Number.isFinite(node.data.excessLossDb) ? Math.max(0, node.data.excessLossDb) : 0;
      const lossDb = catalogueLossDb + excessLossDb;
      cumulativeLossDb += lossDb;
      pointLosses.push({
        id: `${node.id}:splitter`,
        type: 'splitter',
        distanceKm,
        lossDb,
        description: `PLC splitter 1:${node.data.ratio} · ${lossDb.toFixed(2)} dB insertion loss`,
        passFail: splitterStatus(excessLossDb),
        order: pointOrder++,
      });
      addEvent(
        'splitter',
        `${node.id}:splitter`,
        distanceKm,
        -lossDb,
        `PLC splitter 1:${node.data.ratio} · ${lossDb.toFixed(2)} dB insertion loss`,
        splitterStatus(excessLossDb),
      );
      continue;
    }

    if (node.type === 'odf') {
      const lossDb = Number.isFinite(node.data.throughPortLossDb) && node.data.throughPortLossDb >= 0
        ? node.data.throughPortLossDb
        : DEFAULT_ODF_THROUGH_PORT_LOSS_DB;
      cumulativeLossDb += lossDb;
      const description = `ODF adapter through-port · ${lossDb.toFixed(2)} dB reference loss`;
      pointLosses.push({
        id: `${node.id}:odf`,
        type: 'odf',
        distanceKm,
        lossDb,
        description,
        passFail: 'PASS',
        order: pointOrder++,
      });
      addEvent('odf', `${node.id}:odf`, distanceKm, -lossDb, description, 'PASS');
      continue;
    }

    if (node.type === 'nap') {
      const lossDb = Number.isFinite(node.data.splitLossDb) && node.data.splitLossDb >= 0
        ? node.data.splitLossDb
        : NAP_SPLIT_LOSS_DB;
      cumulativeLossDb += lossDb;
      const description = `Outdoor NAP/FAT internal 1:${NAP_SPLIT_RATIO} · ${lossDb.toFixed(2)} dB reference split loss`;
      pointLosses.push({
        id: `${node.id}:nap`,
        type: 'nap',
        distanceKm,
        lossDb,
        description,
        passFail: 'PASS',
        order: pointOrder++,
      });
      addEvent('nap', `${node.id}:nap`, distanceKm, -lossDb, description, 'PASS');
      continue;
    }

    if (node.type === 'closure') {
      const match = /^out-(\d+)$/.exec(outgoingEdge?.sourceHandle ?? '');
      const channelIndex = match ? Number(match[1]) : -1;
      if (channelIndex >= 0 && channelIndex < 4 && node.data.activeSpliceChannels[channelIndex]) {
        const rawSpliceLossDb = Number.isFinite(node.data.spliceLossDb)
          ? node.data.spliceLossDb
          : DEFAULT_CLOSURE_SPLICE_LOSS_DB;
        const spliceLossDb = Math.min(
          CLOSURE_SPLICE_LOSS_MAX_DB,
          Math.max(CLOSURE_SPLICE_LOSS_MIN_DB, rawSpliceLossDb),
        );
        cumulativeLossDb += spliceLossDb;
        pointLosses.push({
          id: `${node.id}:branch-${channelIndex + 1}`,
          type: 'splice',
          distanceKm,
          lossDb: spliceLossDb,
          description: `OSP closure branch ${String.fromCharCode(65 + channelIndex)} through-splice · ${spliceLossDb.toFixed(2)} dB`,
          passFail: spliceStatus(spliceLossDb),
          order: pointOrder++,
        });
        addEvent(
          'splice',
          `${node.id}:branch-${channelIndex + 1}`,
          distanceKm,
          -spliceLossDb,
          `OSP closure branch ${String.fromCharCode(65 + channelIndex)} through-splice · ${spliceLossDb.toFixed(2)} dB`,
          spliceStatus(spliceLossDb),
        );
      }
      continue;
    }

    if (node.type === 'ont' || node.type === 'gateway') {
      addEvent('end_of_fiber', `${node.id}:end`, distanceKm, 0, `End of fiber · ${node.data.subscriber}`, 'PASS', 4);
    }
  }

  const totalDistanceKm = distanceKm;
  const totalLossDb = cumulativeLossDb;
  const sampledEvents = [...pointLosses]
    .sort((left, right) => left.distanceKm - right.distanceKm || left.order - right.order)
    .slice(0, 100);
  const uniformSampleCount = Math.max(100, Math.min(200, 300 - sampledEvents.length * 2));
  const traceSamples: Array<{ distanceKm: number; powerDb: number; order: number }> = [];

  const distributedLossAt = (sampleDistanceKm: number): number => fiberRanges.reduce((sum, range) => {
    const coveredDistance = Math.max(0, Math.min(sampleDistanceKm, range.endKm) - range.startKm);
    return sum + coveredDistance * range.attenuationDbPerKm;
  }, 0);
  const powerBeforePointLoss = (point: PointLoss): number => {
    const priorPointLossDb = pointLosses.reduce((sum, candidate) => (
      candidate.distanceKm < point.distanceKm ||
      (candidate.distanceKm === point.distanceKm && candidate.order < point.order)
        ? sum + candidate.lossDb
        : sum
    ), 0);
    return Math.max(TRACE_NOISE_FLOOR_DB, -(distributedLossAt(point.distanceKm) + priorPointLossDb));
  };

  for (let index = 0; index < uniformSampleCount - 1; index += 1) {
    const sampleDistanceKm = totalDistanceKm > 0
      ? (totalDistanceKm * index) / (uniformSampleCount - 1)
      : 0;
    if (sampledEvents.some((point) => Math.abs(point.distanceKm - sampleDistanceKm) < 1e-9)) continue;
    const discreteLossDb = pointLosses.reduce((sum, point) => (
      point.distanceKm <= sampleDistanceKm ? sum + point.lossDb : sum
    ), 0);
    traceSamples.push({
      distanceKm: sampleDistanceKm,
      powerDb: Math.max(TRACE_NOISE_FLOOR_DB, -(distributedLossAt(sampleDistanceKm) + discreteLossDb)),
      order: 0,
    });
  }

  sampledEvents.forEach((point, index) => {
    const beforePowerDb = powerBeforePointLoss(point);
    traceSamples.push({ distanceKm: point.distanceKm, powerDb: beforePowerDb, order: index * 2 + 1 });
    traceSamples.push({
      distanceKm: point.distanceKm,
      powerDb: Math.max(TRACE_NOISE_FLOOR_DB, beforePowerDb - point.lossDb),
      order: index * 2 + 2,
    });
  });
  traceSamples.sort((left, right) => left.distanceKm - right.distanceKm || left.order - right.order);
  traceSamples.push({ distanceKm: totalDistanceKm, powerDb: TRACE_NOISE_FLOOR_DB, order: Number.MAX_SAFE_INTEGER });
  const tracePoints = traceSamples
    .slice(0, 300)
    .map((point) => ({ distanceKm: rounded(point.distanceKm), powerDb: rounded(point.powerDb) }));

  return {
    wavelengthNm: measuredWavelengthNm,
    pulseWidthNs: measuredPulseWidthNs,
    totalDistanceKm: rounded(totalDistanceKm),
    totalLossDb: rounded(totalLossDb),
    events,
    tracePoints,
  };
}
