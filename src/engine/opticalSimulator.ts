import type {
  ClosureNodeData,
  DesignSettings,
  EdgeTelemetry,
  FiberNodeData,
  GatewayTelemetry,
  LossSegment,
  NetworkSummary,
  OltNodeData,
  OntStatus,
  OntTelemetry,
  OpticalPath,
  PonEdge,
  PonNode,
  PonStandard,
  SimulationResult,
  SplitRatio,
  SplitterNodeData,
} from '../types';
import {
  ATTENUATION_DB_PER_KM,
  CLOSURE_OUTPUT_PORTS,
  CLOSURE_SPLICE_LOSS_MAX_DB,
  CLOSURE_SPLICE_LOSS_MIN_DB,
  CONNECTOR_LOSS_DB,
  CABLE_SPECS,
  DEFAULT_ODF_THROUGH_PORT_LOSS_DB,
  DIRTY_CONNECTOR_PENALTY_DB,
  MACRO_BEND_PENALTY_DB,
  NAP_OUTPUT_PORTS,
  NAP_SPLIT_LOSS_DB,
  NAP_SPLIT_RATIO,
  OLT_CLASS_SPECS,
  ONT_THRESHOLDS,
  PON_STANDARD_SPECS,
  SPLITTER_LOSS_DB,
  SPLICE_LOSS_DB,
} from '../types';

/* ========================================================================== *
 * Optical Simulator
 *
 * Performs a directed depth-first walk from every energised OLT transceiver,
 * accumulating loss element by element, and terminates at every ONT or gateway
 * it can reach. The legacy GPON loss terms are preserved; ODF through loss and
 * the fixed NAP split are explicit additions for those node types:
 *
 *   P_rx = P_tx - (L_fiber + L_splitters + L_ODF + L_NAP + L_splices + L_connectors + L_field_faults + L_closure + Margin)
 *
 * Where a subscriber is reachable by more than one OLT the best (highest
 * received power) path is kept as the primary path; all candidates are
 * retained for the inspector / BOM drill-down.
 * ========================================================================== */

const MAX_WALK_DEPTH = 96;

export const round1 = (value: number): number => Math.round(value * 10) / 10;
export const round2 = (value: number): number => Math.round(value * 100) / 100;
export const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/* -------------------------------------------------------------------------- *
 * Type guards
 * -------------------------------------------------------------------------- */

export function isOltNode(node: PonNode): node is Extract<PonNode, { type: 'olt' }> {
  return node.type === 'olt';
}

export function isSplitterNode(node: PonNode): node is Extract<PonNode, { type: 'splitter' }> {
  return node.type === 'splitter';
}

export function isFiberNode(node: PonNode): node is Extract<PonNode, { type: 'fiber' }> {
  return node.type === 'fiber';
}

export function isClosureNode(node: PonNode): node is Extract<PonNode, { type: 'closure' }> {
  return node.type === 'closure';
}

export function isOntNode(node: PonNode): node is Extract<PonNode, { type: 'ont' }> {
  return node.type === 'ont';
}

export function isOdfNode(node: PonNode): node is Extract<PonNode, { type: 'odf' }> {
  return node.type === 'odf';
}

export function isNapNode(node: PonNode): node is Extract<PonNode, { type: 'nap' }> {
  return node.type === 'nap';
}

export function isGatewayNode(node: PonNode): node is Extract<PonNode, { type: 'gateway' }> {
  return node.type === 'gateway';
}

export function isSubscriberEndpointNode(
  node: PonNode,
): node is Extract<PonNode, { type: 'ont' | 'gateway' }> {
  return isOntNode(node) || isGatewayNode(node);
}

/* -------------------------------------------------------------------------- *
 * Elementary loss models
 * -------------------------------------------------------------------------- */

/** Effective attenuation coefficient for a fiber span, in dB/km. */
export function fiberAttenuationDbPerKm(data: FiberNodeData): number {
  if (data.attenuationOverrideDbPerKm !== null && data.attenuationOverrideDbPerKm > 0) {
    return data.attenuationOverrideDbPerKm;
  }
  return ATTENUATION_DB_PER_KM[data.wavelength];
}

export interface FiberLossBreakdown {
  cableDb: number;
  spliceDb: number;
  connectorDb: number;
  macroBendLossDb: number;
  dirtyConnectorLossDb: number;
  totalDb: number;
  attenuationDbPerKm: number;
}

/** Full loss model of a single cable span, with field faults kept explicit. */
export function computeFiberLoss(data: FiberNodeData): FiberLossBreakdown {
  const attenuationDbPerKm = fiberAttenuationDbPerKm(data);
  const cableDb = Math.max(0, data.lengthKm) * attenuationDbPerKm;
  const spliceDb = Math.max(0, data.splices) * SPLICE_LOSS_DB;
  const connectorDb = Math.max(0, data.connectors) * CONNECTOR_LOSS_DB;
  const macroBendLossDb = data.macroBendActive ? MACRO_BEND_PENALTY_DB : 0;
  const dirtyConnectorLossDb = data.dirtyConnectorActive ? DIRTY_CONNECTOR_PENALTY_DB : 0;
  return {
    cableDb,
    spliceDb,
    connectorDb,
    macroBendLossDb,
    dirtyConnectorLossDb,
    totalDb: cableDb + spliceDb + connectorDb + macroBendLossDb + dirtyConnectorLossDb,
    attenuationDbPerKm,
  };
}

/** Clamp a closure through-splice setting to its simplified learning range. */
export function computeClosureSpliceLoss(data: ClosureNodeData): number {
  const value = Number.isFinite(data.spliceLossDb) ? data.spliceLossDb : CLOSURE_SPLICE_LOSS_MIN_DB;
  return Math.min(CLOSURE_SPLICE_LOSS_MAX_DB, Math.max(CLOSURE_SPLICE_LOSS_MIN_DB, value));
}

/** Catalogue + excess loss of a passive splitter. */
export function computeSplitterLoss(data: SplitterNodeData): number {
  return SPLITTER_LOSS_DB[data.ratio] + Math.max(0, data.excessLossDb);
}

/** Educational ODF through-port allowance; invalid legacy values use 0.5 dB. */
export function computeOdfLoss(throughPortLossDb: number): number {
  return Number.isFinite(throughPortLossDb) && throughPortLossDb >= 0
    ? throughPortLossDb
    : DEFAULT_ODF_THROUGH_PORT_LOSS_DB;
}

/** Fixed 1:8 NAP/FAT insertion allowance; value is not a calibrated SKU measurement. */
export function computeNapLoss(splitLossDb: number): number {
  return Number.isFinite(splitLossDb) && splitLossDb >= 0 ? splitLossDb : NAP_SPLIT_LOSS_DB;
}

/* -------------------------------------------------------------------------- *
 * Status classification — existing GPON-style receive thresholds.
 * Reused for gateway and XGS-PON paths; standard-specific receiver classes
 * are not modeled in this educational simulator.
 * -------------------------------------------------------------------------- */

export function classifyOnt(rxPowerDbm: number | null): OntStatus {
  if (rxPowerDbm === null || Number.isNaN(rxPowerDbm)) return 'DISCONNECTED';
  if (rxPowerDbm > ONT_THRESHOLDS.overloadDbm) return 'OVERLOAD';
  if (rxPowerDbm >= ONT_THRESHOLDS.optimalFloorDbm) return 'ONLINE';
  if (rxPowerDbm >= ONT_THRESHOLDS.warningFloorDbm) return 'WARNING';
  return 'LOS';
}

/* -------------------------------------------------------------------------- *
 * Topology indexing
 * -------------------------------------------------------------------------- */

interface Adjacency {
  outgoing: Map<string, PonEdge[]>;
  incoming: Map<string, PonEdge[]>;
}

function buildAdjacency(edges: PonEdge[], nodeIds: Set<string>): Adjacency {
  const outgoing = new Map<string, PonEdge[]>();
  const incoming = new Map<string, PonEdge[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const out = outgoing.get(edge.source) ?? [];
    out.push(edge);
    outgoing.set(edge.source, out);
    const inc = incoming.get(edge.target) ?? [];
    inc.push(edge);
    incoming.set(edge.target, inc);
  }
  return { outgoing, incoming };
}

/* -------------------------------------------------------------------------- *
 * Main simulation
 * -------------------------------------------------------------------------- */

export function simulateTopology(
  nodes: PonNode[],
  edges: PonEdge[],
  settings: DesignSettings,
  runId = 0,
): SimulationResult {
  const nodeById = new Map<string, PonNode>();
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
    nodeIds.add(node.id);
  }

  const { outgoing } = buildAdjacency(edges, nodeIds);
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));

  const candidatesByOnt = new Map<string, OpticalPath[]>();
  const candidatesByGateway = new Map<string, OpticalPath[]>();
  const edgeBest = new Map<string, number>();
  const safetyMarginDb = Math.max(0, settings.safetyMarginDb);

  interface WalkState {
    lossDb: number;
    segments: LossSegment[];
    onStack: Set<string>;
    fiberKm: number;
    splitStages: number;
    cumulativeSplitRatio: number;
    splices: number;
    connectors: number;
  }

  const emptyState = (): WalkState => ({
    lossDb: 0,
    segments: [],
    onStack: new Set<string>(),
    fiberKm: 0,
    splitStages: 0,
    cumulativeSplitRatio: 1,
    splices: 0,
    connectors: 0,
  });

  const recordEdge = (edgeId: string, powerDbm: number): void => {
    const existing = edgeBest.get(edgeId);
    if (existing === undefined || powerDbm > existing) edgeBest.set(edgeId, powerDbm);
  };

  const walk = (
    olt: Extract<PonNode, { type: 'olt' }>,
    oltData: OltNodeData,
    nodeId: string,
    state: WalkState,
    visitedEdges: string[],
  ): void => {
    if (state.onStack.size > MAX_WALK_DEPTH) return;

    const node = nodeById.get(nodeId);
    if (!node) return;

    // Optical power arriving at this element's input port, before its own loss.
    // Recorded first so the final hop into an ONT is metered like every other.
    const incomingEdgeId = visitedEdges[visitedEdges.length - 1];
    if (incomingEdgeId !== undefined) {
      recordEdge(incomingEdgeId, oltData.txPowerDbm - state.lossDb);
    }

    // Terminal: an ONT or integrated Wi-Fi gateway. Emit a completed optical path.
    if (isSubscriberEndpointNode(node)) {
      const rxPowerDbm = oltData.txPowerDbm - state.lossDb - safetyMarginDb;
      const ponStandard = oltData.ponStandard === 'XGS-PON' ? 'XGS-PON' : 'GPON';
      const path: OpticalPath = {
        oltId: olt.id,
        oltPort: oltData.portName,
        nodeIds: [...state.onStack, node.id],
        txPowerDbm: oltData.txPowerDbm,
        totalLossDb: state.lossDb + safetyMarginDb,
        rxPowerDbm,
        segments: [
          ...state.segments,
          {
            nodeId: null,
            component: 'margin',
            label: 'System safety margin',
            lossDb: safetyMarginDb,
          },
        ],
        fiberKm: state.fiberKm,
        splitStages: state.splitStages,
        cumulativeSplitRatio: state.cumulativeSplitRatio,
        splices: state.splices,
        connectors: state.connectors,
        wavelength: ponStandard === 'XGS-PON' ? PON_STANDARD_SPECS['XGS-PON'].downstreamWavelength : oltData.wavelength,
        ponStandard,
      };
      if (isGatewayNode(node)) {
        const bucket = candidatesByGateway.get(node.id) ?? [];
        bucket.push(path);
        candidatesByGateway.set(node.id, bucket);
      } else {
        const bucket = candidatesByOnt.get(node.id) ?? [];
        bucket.push(path);
        candidatesByOnt.set(node.id, bucket);
      }
      return;
    }

    // Terminal: another OLT cannot be traversed through.
    if (isOltNode(node)) return;

    const nextState: WalkState = {
      lossDb: state.lossDb,
      segments: [...state.segments],
      onStack: new Set(state.onStack),
      fiberKm: state.fiberKm,
      splitStages: state.splitStages,
      cumulativeSplitRatio: state.cumulativeSplitRatio,
      splices: state.splices,
      connectors: state.connectors,
    };
    nextState.onStack.add(node.id);

    if (isFiberNode(node)) {
      // The XGS-PON downstream uses 1577 nm throughout this route. Legacy GPON
      // still uses each span's own selected wavelength, preserving its equation.
      const effectiveFiberData = oltData.ponStandard === 'XGS-PON'
        ? { ...node.data, wavelength: PON_STANDARD_SPECS['XGS-PON'].downstreamWavelength }
        : node.data;
      const loss = computeFiberLoss(effectiveFiberData);
      nextState.lossDb += loss.totalDb;
      nextState.fiberKm += Math.max(0, node.data.lengthKm);
      nextState.splices += Math.max(0, node.data.splices);
      nextState.connectors += Math.max(0, node.data.connectors);
      nextState.segments.push({
        nodeId: node.id,
        component: 'fiber',
        label: `${CABLE_SPECS[node.data.cableType].label} — ${round3(node.data.lengthKm)} km @ ${round2(
          loss.attenuationDbPerKm,
        )} dB/km @ ${effectiveFiberData.wavelength} nm`,
        lossDb: loss.cableDb,
      });
      if (loss.spliceDb > 0) {
        nextState.segments.push({
          nodeId: node.id,
          component: 'splice',
          label: `${node.data.splices} fusion splice${node.data.splices === 1 ? '' : 's'} @ ${SPLICE_LOSS_DB} dB`,
          lossDb: loss.spliceDb,
        });
      }
      if (loss.connectorDb > 0) {
        nextState.segments.push({
          nodeId: node.id,
          component: 'connector',
          label: `${node.data.connectors} SC/APC connector${node.data.connectors === 1 ? '' : 's'} @ ${CONNECTOR_LOSS_DB} dB`,
          lossDb: loss.connectorDb,
        });
      }
      if (loss.macroBendLossDb > 0) {
        nextState.segments.push({
          nodeId: node.id,
          component: 'fault',
          label: `Fault Penalty: Macro-Bend (-${loss.macroBendLossDb.toFixed(2)} dB)`,
          lossDb: loss.macroBendLossDb,
        });
      }
      if (loss.dirtyConnectorLossDb > 0) {
        nextState.segments.push({
          nodeId: node.id,
          component: 'fault',
          label: `Fault Penalty: Dust Contamination (-${loss.dirtyConnectorLossDb.toFixed(2)} dB)`,
          lossDb: loss.dirtyConnectorLossDb,
        });
      }
    } else if (isSplitterNode(node)) {
      const splitterLoss = computeSplitterLoss(node.data);
      nextState.lossDb += splitterLoss;
      nextState.splitStages += 1;
      nextState.cumulativeSplitRatio *= node.data.ratio;
      nextState.segments.push({
        nodeId: node.id,
        component: 'splitter',
        label: `1:${node.data.ratio} splitter${
          node.data.excessLossDb > 0 ? ` (+${round2(node.data.excessLossDb)} dB excess)` : ''
        }`,
        lossDb: splitterLoss,
      });
    } else if (isOdfNode(node)) {
      const odfLossDb = computeOdfLoss(node.data.throughPortLossDb);
      nextState.lossDb += odfLossDb;
      nextState.segments.push({
        nodeId: node.id,
        component: 'odf',
        label: `ODF adapter through-port · ${odfLossDb.toFixed(2)} dB`,
        lossDb: odfLossDb,
      });
    } else if (isNapNode(node)) {
      const napLossDb = computeNapLoss(node.data.splitLossDb);
      nextState.lossDb += napLossDb;
      nextState.splitStages += 1;
      nextState.cumulativeSplitRatio *= NAP_SPLIT_RATIO;
      nextState.segments.push({
        nodeId: node.id,
        component: 'nap',
        label: `Outdoor NAP/FAT internal 1:${NAP_SPLIT_RATIO} · ${napLossDb.toFixed(2)} dB reference split loss`,
        lossDb: napLossDb,
      });
    }

    let nextEdges = outgoing.get(node.id) ?? [];
    if (isOdfNode(node)) {
      const inputEdge = edgeById.get(incomingEdgeId ?? '');
      const inputIndex = Number(/^in-(\d+)$/.exec(inputEdge?.targetHandle ?? 'in-0')?.[1] ?? 0);
      nextEdges = nextEdges.filter((edge) => edge.sourceHandle === `out-${inputIndex}`);
    } else if (isNapNode(node)) {
      nextEdges = nextEdges.filter((edge) => {
        const outputIndex = Number(/^out-(\d+)$/.exec(edge.sourceHandle ?? '')?.[1] ?? -1);
        return Number.isInteger(outputIndex) && outputIndex >= 0 && outputIndex < NAP_OUTPUT_PORTS;
      });
    }

    for (const edge of nextEdges) {
      if (nextState.onStack.has(edge.target)) continue; // loop guard

      if (isClosureNode(node)) {
        const handleIndex = Number((edge.sourceHandle ?? 'out-0').replace(/^out-/, ''));
        if (!Number.isInteger(handleIndex) || handleIndex < 0 || handleIndex >= CLOSURE_OUTPUT_PORTS) continue;
        if (!node.data.activeSpliceChannels[handleIndex]) continue;

        const spliceLossDb = computeClosureSpliceLoss(node.data);
        const branchState: WalkState = {
          ...nextState,
          lossDb: nextState.lossDb + spliceLossDb,
          segments: [
            ...nextState.segments,
            {
              nodeId: node.id,
              component: 'splice',
              label: `FOSC closure · channel ${handleIndex + 1} through-splice @ ${spliceLossDb.toFixed(2)} dB`,
              lossDb: spliceLossDb,
            },
          ],
          onStack: new Set(nextState.onStack),
          splices: nextState.splices + 1,
        };
        walk(olt, oltData, edge.target, branchState, [...visitedEdges, edge.id]);
        continue;
      }

      walk(olt, oltData, edge.target, nextState, [...visitedEdges, edge.id]);
    }
  };

  // Energise every OLT with its laser enabled.
  for (const node of nodes) {
    if (!isOltNode(node)) continue;
    const data = node.data;
    if (!data.laserOn) continue;

    for (const edge of outgoing.get(node.id) ?? []) {
      const state = emptyState();
      state.onStack.add(node.id);
      walk(node, data, edge.target, state, [edge.id]);
    }
  }

  /* ---------------------- Assemble endpoint telemetry -------------------- */

  const ontTelemetry: Record<string, OntTelemetry> = {};
  const gatewayTelemetry: Record<string, GatewayTelemetry> = {};
  const bestPaths: Record<string, OpticalPath> = {};

  const opticalReading = (candidates: OpticalPath[]) => {
    const best = candidates[0];
    const rxPowerDbm = best ? round2(best.rxPowerDbm) : null;
    return {
      best,
      rxPowerDbm,
      status: classifyOnt(rxPowerDbm),
      totalLossDb: best ? round2(best.totalLossDb) : 0,
      marginDb: rxPowerDbm === null ? 0 : round2(rxPowerDbm - ONT_THRESHOLDS.losFloorDbm),
      headroomDb: rxPowerDbm === null ? 0 : round2(ONT_THRESHOLDS.overloadDbm - rxPowerDbm),
      sourceOltId: best ? best.oltId : null,
      fiberKm: best ? round3(best.fiberKm) : 0,
      splitStages: best ? best.splitStages : 0,
      cumulativeSplitRatio: best ? best.cumulativeSplitRatio : 1,
      splices: best ? best.splices : 0,
      connectors: best ? best.connectors : 0,
      segments: best ? best.segments : [],
      candidatePaths: candidates,
    };
  };

  for (const node of nodes) {
    if (isOntNode(node)) {
      const candidates = [...(candidatesByOnt.get(node.id) ?? [])].sort(
        (a, b) => b.rxPowerDbm - a.rxPowerDbm,
      );
      const reading = opticalReading(candidates);
      const { best, ...telemetry } = reading;
      ontTelemetry[node.id] = { ontId: node.id, ...telemetry };
      if (best) bestPaths[node.id] = best;
    } else if (isGatewayNode(node)) {
      const candidates = [...(candidatesByGateway.get(node.id) ?? [])].sort(
        (a, b) => b.rxPowerDbm - a.rxPowerDbm,
      );
      const reading = opticalReading(candidates);
      const standard = reading.best?.ponStandard ?? null;
      const standardSpec = standard ? PON_STANDARD_SPECS[standard] : null;
      const splitRatio = reading.best ? Math.max(1, reading.best.cumulativeSplitRatio) : null;
      gatewayTelemetry[node.id] = {
        gatewayId: node.id,
        ssid: node.data.ssid,
        serviceIpAddress: node.data.serviceIpAddress,
        status: reading.status,
        rxPowerDbm: reading.rxPowerDbm,
        totalLossDb: reading.totalLossDb,
        marginDb: reading.marginDb,
        headroomDb: reading.headroomDb,
        sourceOltId: reading.sourceOltId,
        fiberKm: reading.fiberKm,
        splitStages: reading.splitStages,
        cumulativeSplitRatio: reading.cumulativeSplitRatio,
        splices: reading.splices,
        connectors: reading.connectors,
        segments: reading.segments,
        candidatePaths: candidates,
        ponStandard: standard,
        downstreamLineRateGbps: standardSpec?.downstreamGbps ?? null,
        upstreamLineRateGbps: standardSpec?.upstreamGbps ?? null,
        estimatedDownMbps: standardSpec && splitRatio
          ? round2((standardSpec.downstreamGbps * 1000) / splitRatio)
          : null,
        estimatedUpMbps: standardSpec && splitRatio
          ? round2((standardSpec.upstreamGbps * 1000) / splitRatio)
          : null,
      };
      if (reading.best) bestPaths[node.id] = reading.best;
    }
  }

  /* --------------------------- Edge telemetry ---------------------------- */

  const edgeTelemetry: Record<string, EdgeTelemetry> = {};
  for (const edge of edges) {
    const powerDbm = edgeBest.get(edge.id);
    const value = powerDbm === undefined ? null : round2(powerDbm);
    let edgeState: EdgeTelemetry['edgeState'] = 'idle';
    if (value !== null) {
      edgeState = value < ONT_THRESHOLDS.losFloorDbm ? 'degraded' : 'live';
    }
    edgeTelemetry[edge.id] = { powerDbm: value, edgeState };
  }

  /* ------------------------------ Summary -------------------------------- */

  const summary = summarise(nodes, ontTelemetry, gatewayTelemetry);

  return {
    ontTelemetry,
    gatewayTelemetry,
    bestPaths,
    edgeTelemetry,
    summary,
    runId,
    safetyMarginDb,
    computedAt: Date.now(),
  };
}

function summarise(
  nodes: PonNode[],
  ontTelemetry: Record<string, OntTelemetry>,
  gatewayTelemetry: Record<string, GatewayTelemetry>,
): NetworkSummary {
  const byStatus: Record<OntStatus, number> = {
    OVERLOAD: 0,
    ONLINE: 0,
    WARNING: 0,
    LOS: 0,
    DISCONNECTED: 0,
  };

  const ontCount = Object.keys(ontTelemetry).length;
  const gatewayCount = Object.keys(gatewayTelemetry).length;
  const subscriberCount = ontCount + gatewayCount;
  const endpointReadings = [
    ...Object.values(ontTelemetry),
    ...Object.values(gatewayTelemetry),
  ];
  let rxSum = 0;
  let rxCount = 0;
  let worstRxDbm: number | null = null;

  for (const telemetry of endpointReadings) {
    byStatus[telemetry.status] += 1;
    if (telemetry.rxPowerDbm !== null) {
      rxSum += telemetry.rxPowerDbm;
      rxCount += 1;
      if (worstRxDbm === null || telemetry.rxPowerDbm < worstRxDbm) {
        worstRxDbm = telemetry.rxPowerDbm;
      }
    }
  }

  let totalFiberKm = 0;
  let totalSplices = 0;
  let totalConnectors = 0;
  let splitterTotal = 0;
  let oltCount = 0;
  let oltActive = 0;
  const splitterCountByRatio: Partial<Record<SplitRatio, number>> = {};

  for (const node of nodes) {
    if (isFiberNode(node)) {
      totalFiberKm += Math.max(0, node.data.lengthKm);
      totalSplices += Math.max(0, node.data.splices);
      totalConnectors += Math.max(0, node.data.connectors);
    } else if (isClosureNode(node)) {
      totalSplices += node.data.activeSpliceChannels.filter(Boolean).length;
    } else if (isSplitterNode(node)) {
      splitterTotal += 1;
      splitterCountByRatio[node.data.ratio] = (splitterCountByRatio[node.data.ratio] ?? 0) + 1;
    } else if (isOltNode(node)) {
      oltCount += 1;
      if (node.data.laserOn) oltActive += 1;
    }
  }

  const liveCount = byStatus.ONLINE + byStatus.WARNING + byStatus.OVERLOAD + byStatus.LOS;

  return {
    ontCount,
    gatewayCount,
    subscriberCount,
    byStatus,
    totalFiberKm: round3(totalFiberKm),
    totalSplices,
    totalConnectors,
    splitterCountByRatio,
    splitterTotal,
    oltCount,
    oltActive,
    meanRxDbm: rxCount > 0 ? round2(rxSum / rxCount) : null,
    worstRxDbm,
    allOptimal: subscriberCount > 0 && byStatus.ONLINE === subscriberCount,
    hasFault: byStatus.LOS > 0 || byStatus.DISCONNECTED > 0 || (subscriberCount > 0 && liveCount < subscriberCount),
  };
}

/* -------------------------------------------------------------------------- *
 * Presentation helpers
 * -------------------------------------------------------------------------- */

export const formatDbm = (value: number | null): string =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)} dBm`;

export const formatDb = (value: number): string => `${value.toFixed(2)} dB`;

export function describeStatus(status: OntStatus, ponStandard?: PonStandard): string {
  switch (status) {
    case 'OVERLOAD':
      return 'Optical saturation / burn risk';
    case 'ONLINE':
      return ponStandard === 'XGS-PON'
        ? 'Within modeled XGS-PON receive-power window'
        : 'Within GPON optimal window';
    case 'WARNING':
      return 'Marginal — high BER risk';
    case 'LOS':
      return 'Loss of signal';
    case 'DISCONNECTED':
      return 'No active OLT path';
    default:
      return 'Unknown';
  }
}

/** Nominal link budget of an OLT class, for the inspector's headroom gauge. */
export function classLinkBudget(oltClass: keyof typeof OLT_CLASS_SPECS): number {
  return OLT_CLASS_SPECS[oltClass].linkBudgetDb;
}
