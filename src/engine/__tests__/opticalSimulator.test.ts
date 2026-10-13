import { describe, expect, it } from 'vitest';
import {
  classifyOnt,
  computeClosureSpliceLoss,
  computeFiberLoss,
  computeSplitterLoss,
  simulateTopology,
} from '../opticalSimulator';
import { decorateEdges } from '../edgeDecoration';
import { buildPreset } from '../presets';
import { createClosureNode, createOltNode, createOntNode } from '../factories';
import {
  ATTENUATION_DB_PER_KM,
  CLOSURE_SPLICE_LOSS_MAX_DB,
  CLOSURE_SPLICE_LOSS_MIN_DB,
  CONNECTOR_LOSS_DB,
  DEFAULT_SETTINGS,
  DIRTY_CONNECTOR_PENALTY_DB,
  MACRO_BEND_PENALTY_DB,
  SPLIT_RATIOS,
  SPLITTER_LOSS_DB,
  SPLICE_LOSS_DB,
  type DesignSettings,
  type FiberNodeData,
  type PonEdge,
  type PonNode,
  type SplitterNodeData,
} from '../../types';

const settings: DesignSettings = { ...DEFAULT_SETTINGS };

describe('loss catalogue', () => {
  it('matches the ITU-T splitter loss table exactly', () => {
    expect(SPLITTER_LOSS_DB[2]).toBe(3.7);
    expect(SPLITTER_LOSS_DB[4]).toBe(7.2);
    expect(SPLITTER_LOSS_DB[8]).toBe(10.5);
    expect(SPLITTER_LOSS_DB[16]).toBe(13.8);
    expect(SPLITTER_LOSS_DB[32]).toBe(17.5);
    expect(SPLITTER_LOSS_DB[64]).toBe(20.8);
    // Catalogue must stay monotonic across every offered ratio.
    const losses = SPLIT_RATIOS.map((ratio) => SPLITTER_LOSS_DB[ratio]);
    expect(losses).toEqual([...losses].sort((a, b) => a - b));
  });

  it('uses nominal single-mode learning coefficients at 1310, 1490, and 1550 nm', () => {
    expect(ATTENUATION_DB_PER_KM[1310]).toBe(0.35);
    expect(ATTENUATION_DB_PER_KM[1490]).toBe(0.25);
    expect(ATTENUATION_DB_PER_KM[1550]).toBe(0.2);
  });

  it('applies 0.1 dB per fusion splice and 0.5 dB per SC/APC connector', () => {
    expect(SPLICE_LOSS_DB).toBe(0.1);
    expect(CONNECTOR_LOSS_DB).toBe(0.5);
  });

  it('computes a 5 km feeder span at 1490 nm with two connectors', () => {
    const data: FiberNodeData = {
      kind: 'fiber',
      cableType: 'feeder',
      lengthKm: 5,
      splices: 0,
      connectors: 2,
      wavelength: 1490,
      attenuationOverrideDbPerKm: null,
    };
    const loss = computeFiberLoss(data);
    expect(loss.cableDb).toBeCloseTo(1.25, 6);
    expect(loss.connectorDb).toBeCloseTo(1.0, 6);
    expect(loss.totalDb).toBeCloseTo(2.25, 6);
  });

  it('honours a manual attenuation override and the 1310 nm window', () => {
    const data: FiberNodeData = {
      kind: 'fiber',
      cableType: 'feeder',
      lengthKm: 10,
      splices: 4,
      connectors: 0,
      wavelength: 1310,
      attenuationOverrideDbPerKm: null,
    };
    expect(computeFiberLoss(data).cableDb).toBeCloseTo(3.5, 6);
    const overridden: FiberNodeData = { ...data, attenuationOverrideDbPerKm: 0.2 };
    expect(computeFiberLoss(overridden).cableDb).toBeCloseTo(2.0, 6);
  });

  it('adds the macro-bend and dirty-ferrule penalties as separate span losses', () => {
    const data: FiberNodeData = {
      kind: 'fiber',
      cableType: 'drop',
      lengthKm: 1,
      splices: 0,
      connectors: 0,
      wavelength: 1490,
      attenuationOverrideDbPerKm: null,
      macroBendActive: true,
      dirtyConnectorActive: true,
    };
    const loss = computeFiberLoss(data);
    expect(loss.macroBendLossDb).toBe(MACRO_BEND_PENALTY_DB);
    expect(loss.dirtyConnectorLossDb).toBe(DIRTY_CONNECTOR_PENALTY_DB);
    expect(loss.totalDb).toBeCloseTo(0.25 + 3.5 + 2.0, 6);
  });

  it('clamps the closure through-splice allowance to 0.05–0.10 dB', () => {
    const closure = createClosureNode({ id: 'closure-loss' });
    if (closure.type !== 'closure') throw new Error('Closure factory returned an invalid node.');
    expect(computeClosureSpliceLoss(closure.data)).toBe(0.08);
    expect(computeClosureSpliceLoss({ ...closure.data, spliceLossDb: -1 })).toBe(CLOSURE_SPLICE_LOSS_MIN_DB);
    expect(computeClosureSpliceLoss({ ...closure.data, spliceLossDb: 9 })).toBe(CLOSURE_SPLICE_LOSS_MAX_DB);
  });

  it('adds excess loss on top of the splitter catalogue value', () => {
    const data: SplitterNodeData = { kind: 'splitter', ratio: 32, excessLossDb: 0.4 };
    expect(computeSplitterLoss(data)).toBeCloseTo(17.9, 6);
  });
});

describe('ONT status classification (ITU-T G.984)', () => {
  it('classifies every boundary of the receive window', () => {
    expect(classifyOnt(null)).toBe('DISCONNECTED');
    expect(classifyOnt(-7.99)).toBe('OVERLOAD');
    expect(classifyOnt(-8.0)).toBe('ONLINE');
    expect(classifyOnt(-16)).toBe('ONLINE');
    expect(classifyOnt(-24.0)).toBe('ONLINE');
    expect(classifyOnt(-24.01)).toBe('WARNING');
    expect(classifyOnt(-27.99)).toBe('WARNING');
    expect(classifyOnt(-28.0)).toBe('WARNING');
    expect(classifyOnt(-28.01)).toBe('LOS');
    expect(classifyOnt(-45)).toBe('LOS');
  });
});

describe('Preset A — standard 1:32 GPON tree', () => {
  const { nodes, edges } = buildPreset('standard-1x32') as { nodes: PonNode[]; edges: PonEdge[] };
  const result = simulateTopology(nodes, edges, settings, 1);

  it('delivers roughly −21.58 dBm to the 300 m drop subscriber', () => {
    const telemetry = result.ontTelemetry['ont-a1'];
    expect(telemetry).toBeDefined();
    // 2.25 + 7.2 + 1.45 + 10.5 + 1.175 + 2.0 = 24.575 dB of loss from a +3.0 dBm B+ port
    expect(telemetry.totalLossDb).toBeCloseTo(24.575, 1);
    expect(telemetry.rxPowerDbm).toBeCloseTo(-21.575, 1);
    expect(telemetry.status).toBe('ONLINE');
  });

  it('keeps the mid-length drop online and pushes the 6 km drop to WARNING', () => {
    expect(result.ontTelemetry['ont-a2'].rxPowerDbm).toBeCloseTo(-22.0, 2);
    expect(result.ontTelemetry['ont-a2'].status).toBe('ONLINE');
    expect(result.ontTelemetry['ont-a3'].rxPowerDbm).toBeCloseTo(-24.3, 2);
    expect(result.ontTelemetry['ont-a3'].status).toBe('WARNING');
  });

  it('tracks the aggregate split ratio through two cascaded stages', () => {
    const telemetry = result.ontTelemetry['ont-a1'];
    expect(telemetry.splitStages).toBe(2);
    expect(telemetry.cumulativeSplitRatio).toBe(32);
    expect(telemetry.fiberKm).toBeCloseTo(6.3, 3);
    expect(telemetry.splices).toBe(3);
    expect(telemetry.connectors).toBe(6);
    expect(telemetry.sourceOltId).toBe('olt-a');
  });

  it('counts the deployed plant in the summary', () => {
    expect(result.summary.ontCount).toBe(3);
    expect(result.summary.totalFiberKm).toBeCloseTo(13.5, 3);
    expect(result.summary.splitterTotal).toBe(2);
    expect(result.summary.splitterCountByRatio[4]).toBe(1);
    expect(result.summary.splitterCountByRatio[8]).toBe(1);
    expect(result.summary.oltCount).toBe(1);
    expect(result.summary.oltActive).toBe(1);
    expect(result.summary.byStatus.ONLINE).toBe(2);
    expect(result.summary.byStatus.WARNING).toBe(1);
    expect(result.summary.allOptimal).toBe(false);
  });

  it('marks every energised patch cord live with its carried power', () => {
    expect(result.edgeTelemetry['e-a1'].powerDbm).toBeCloseTo(3.0, 2);
    expect(result.edgeTelemetry['e-a1'].edgeState).toBe('live');
    // After the 5 km feeder span the arriving power is 3.0 − 2.25 = +0.75 dBm.
    expect(result.edgeTelemetry['e-a2'].powerDbm).toBeCloseTo(0.75, 2);
    expect(result.edgeTelemetry['e-a5'].edgeState).toBe('live');
    expect(Object.values(result.edgeTelemetry).every((entry) => entry.powerDbm !== null)).toBe(true);
  });

  it('breaks down the budget into labelled segments', () => {
    const segments = result.ontTelemetry['ont-a1'].segments;
    const kinds = segments.map((segment) => segment.component);
    expect(kinds).toEqual([
      'fiber',
      'connector',
      'splitter',
      'fiber',
      'splice',
      'connector',
      'splitter',
      'fiber',
      'splice',
      'connector',
      'margin',
    ]);
    const total = segments.reduce((sum, segment) => sum + segment.lossDb, 0);
    // The itemised breakdown must reconcile exactly with the physical budget…
    expect(total).toBeCloseTo(24.575, 3);
    // …and with the rounded figure the ONT reports.
    expect(total).toBeCloseTo(result.ontTelemetry['ont-a1'].totalLossDb, 1);
  });
});

describe('Preset B — failing long-distance link', () => {
  const { nodes, edges } = buildPreset('failing-long-haul') as {
    nodes: PonNode[];
    edges: PonEdge[];
  };
  const result = simulateTopology(nodes, edges, settings, 2);

  it('puts both wired subscribers into LOS', () => {
    // 6.2 + 17.5 + 3.4 + 13.8 + 1.575 + 2.0 = 44.475 dB of loss from a +5.0 dBm C+ port.
    expect(result.ontTelemetry['ont-b1'].totalLossDb).toBeCloseTo(44.475, 1);
    expect(result.ontTelemetry['ont-b1'].rxPowerDbm).toBeCloseTo(-39.475, 1);
    expect(result.ontTelemetry['ont-b1'].status).toBe('LOS');
    expect(result.ontTelemetry['ont-b2'].rxPowerDbm).toBeCloseTo(-39.1, 2);
    expect(result.ontTelemetry['ont-b2'].status).toBe('LOS');
    expect(result.ontTelemetry['ont-b2'].cumulativeSplitRatio).toBe(512);
  });

  it('reports the unwired subscriber as DISCONNECTED', () => {
    const telemetry = result.ontTelemetry['ont-b3'];
    expect(telemetry.rxPowerDbm).toBeNull();
    expect(telemetry.status).toBe('DISCONNECTED');
    expect(telemetry.sourceOltId).toBeNull();
    expect(telemetry.candidatePaths).toHaveLength(0);
  });

  it('flags the network as faulty but still energises the trunk', () => {
    expect(result.summary.hasFault).toBe(true);
    expect(result.summary.byStatus.LOS).toBe(2);
    expect(result.summary.byStatus.DISCONNECTED).toBe(1);
    // The C+ port launches +5.0 dBm, so the trunk is live even though the ONTs are not.
    expect(result.edgeTelemetry['e-b1'].edgeState).toBe('live');
    expect(result.edgeTelemetry['e-b6'].edgeState).toBe('degraded');
  });
});

describe('field faults and OSP splice closures', () => {
  it('keeps fault penalties explicit and moves a marginal subscriber to WARNING', () => {
    const { nodes, edges } = buildPreset('standard-1x32') as { nodes: PonNode[]; edges: PonEdge[] };
    const faultNodes = nodes.map((node) => node.type === 'fiber' && node.id === 'fiber-drop-a1'
      ? { ...node, data: { ...node.data, macroBendActive: true, dirtyConnectorActive: true } }
      : node) as PonNode[];
    const result = simulateTopology(faultNodes, edges, settings, 21);
    const telemetry = result.ontTelemetry['ont-a1'];

    expect(telemetry.rxPowerDbm).toBeCloseTo(-27.075, 2);
    expect(telemetry.status).toBe('WARNING');
    expect(telemetry.segments.map((segment) => segment.label)).toContain('Fault Penalty: Macro-Bend (-3.50 dB)');
    expect(telemetry.segments.map((segment) => segment.label)).toContain('Fault Penalty: Dust Contamination (-2.00 dB)');

    const decorated = decorateEdges(edges, result.edgeTelemetry, faultNodes);
    expect(decorated.find((edge) => edge.id === 'e-a6')?.data?.faultLabels).toEqual([
      'Macro-bend loss on this span',
      'Dust contamination loss on this span',
    ]);
  });

  it('routes through an active closure channel with one splice allowance and blocks an open one', () => {
    const olt = createOltNode({ id: 'olt-closure' });
    const closureCreated = createClosureNode({ id: 'closure-1' });
    if (closureCreated.type !== 'closure') throw new Error('Closure factory returned an invalid node.');
    const closure = closureCreated;
    const fiber: PonNode = {
      id: 'fiber-closure-drop',
      type: 'fiber',
      position: { x: 600, y: 0 },
      data: {
        kind: 'fiber',
        cableType: 'drop',
        lengthKm: 0,
        splices: 0,
        connectors: 0,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    };
    const ont = createOntNode({ id: 'ont-closure' });
    const edges: PonEdge[] = [
      { id: 'closure-in', source: olt.id, target: closure.id, sourceHandle: 'out', targetHandle: 'in-0', type: 'optical' },
      { id: 'closure-out-a', source: closure.id, target: fiber.id, sourceHandle: 'out-0', targetHandle: 'in', type: 'optical' },
      { id: 'closure-to-ont', source: fiber.id, target: ont.id, sourceHandle: 'out', targetHandle: 'in', type: 'optical' },
    ];
    const nodes: PonNode[] = [olt, closure, fiber, ont];
    const connected = simulateTopology(nodes, edges, { ...settings, safetyMarginDb: 0 }, 22);

    expect(connected.edgeTelemetry['closure-in'].powerDbm).toBe(3);
    expect(connected.edgeTelemetry['closure-out-a'].powerDbm).toBeCloseTo(2.92, 6);
    expect(connected.ontTelemetry[ont.id].rxPowerDbm).toBeCloseTo(2.92, 6);
    expect(connected.ontTelemetry[ont.id].splices).toBe(1);
    expect(connected.ontTelemetry[ont.id].segments.some((segment) => segment.label.includes('channel 1 through-splice'))).toBe(true);
    expect(connected.summary.totalSplices).toBe(4);

    const openClosure: PonNode = {
      ...closure,
      data: { ...closure.data, activeSpliceChannels: closure.data.activeSpliceChannels.map(() => false) },
    };
    const open = simulateTopology([olt, openClosure, fiber, ont], edges, { ...settings, safetyMarginDb: 0 }, 23);
    expect(open.ontTelemetry[ont.id].status).toBe('DISCONNECTED');
    expect(open.edgeTelemetry['closure-in'].powerDbm).toBe(3);
    expect(open.edgeTelemetry['closure-out-a'].powerDbm).toBeNull();
  });
});

describe('graph behaviour', () => {
  it('turns every ONT dark when the OLT laser is disabled', () => {
    const { nodes, edges } = buildPreset('standard-1x32') as {
      nodes: PonNode[];
      edges: PonEdge[];
    };
    const darkNodes = nodes.map((node) =>
      node.type === 'olt' ? { ...node, data: { ...node.data, laserOn: false } } : node,
    ) as PonNode[];
    const result = simulateTopology(darkNodes, edges, settings, 3);
    expect(Object.values(result.ontTelemetry).every((entry) => entry.status === 'DISCONNECTED')).toBe(
      true,
    );
    expect(Object.values(result.edgeTelemetry).every((entry) => entry.edgeState === 'idle')).toBe(true);
    expect(result.summary.oltActive).toBe(0);
  });

  it('detects optical overload on an unattenuated patch', () => {
    const nodes: PonNode[] = [
      {
        id: 'olt-hot',
        type: 'olt',
        position: { x: 0, y: 0 },
        data: {
          kind: 'olt',
          portName: 'PON 0/1/1',
          oltClass: 'C+',
          txPowerDbm: 7,
          laserOn: true,
          wavelength: 1490,
        },
      },
      {
        id: 'ont-hot',
        type: 'ont',
        position: { x: 400, y: 0 },
        data: { kind: 'ont', serial: 'X', subscriber: 'Y', sensitivityDbm: -28 },
      },
    ];
    const edges: PonEdge[] = [
      {
        id: 'e-hot',
        source: 'olt-hot',
        target: 'ont-hot',
        sourceHandle: 'out',
        targetHandle: 'in',
        type: 'optical',
      },
    ];
    const result = simulateTopology(nodes, edges, settings, 4);
    // +7.0 dBm − 2.0 dB margin = +5.0 dBm, far above the −8.0 dBm ceiling.
    expect(result.ontTelemetry['ont-hot'].rxPowerDbm).toBeCloseTo(5.0, 2);
    expect(result.ontTelemetry['ont-hot'].status).toBe('OVERLOAD');
  });

  it('terminates instead of looping when the topology contains a cycle', () => {
    const fiber = (id: string): PonNode => ({
      id,
      type: 'fiber',
      position: { x: 0, y: 0 },
      data: {
        kind: 'fiber',
        cableType: 'distribution',
        lengthKm: 1,
        splices: 0,
        connectors: 0,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    });

    const nodes: PonNode[] = [
      {
        id: 'olt-loop',
        type: 'olt',
        position: { x: 0, y: 0 },
        data: {
          kind: 'olt',
          portName: 'PON 0/1/2',
          oltClass: 'B+',
          txPowerDbm: 3,
          laserOn: true,
          wavelength: 1490,
        },
      },
      fiber('fiber-loop-a'),
      fiber('fiber-loop-b'),
      {
        id: 'ont-loop',
        type: 'ont',
        position: { x: 600, y: 0 },
        data: { kind: 'ont', serial: 'Z', subscriber: 'Loop', sensitivityDbm: -28 },
      },
    ];
    const edges: PonEdge[] = [
      { id: 'l1', source: 'olt-loop', target: 'fiber-loop-a', sourceHandle: 'out', targetHandle: 'in', type: 'optical' },
      { id: 'l2', source: 'fiber-loop-a', target: 'fiber-loop-b', sourceHandle: 'out', targetHandle: 'in', type: 'optical' },
      { id: 'l3', source: 'fiber-loop-b', target: 'fiber-loop-a', sourceHandle: 'out', targetHandle: 'in', type: 'optical' },
      { id: 'l4', source: 'fiber-loop-b', target: 'ont-loop', sourceHandle: 'out', targetHandle: 'in', type: 'optical' },
    ];

    const result = simulateTopology(nodes, edges, settings, 5);
    // The loop is traversed once only: 2 km of fiber (0.5 dB) + 2.0 dB margin from a +3.0 dBm port.
    expect(result.ontTelemetry['ont-loop'].rxPowerDbm).toBeCloseTo(0.5, 2);
    expect(result.ontTelemetry['ont-loop'].status).toBe('OVERLOAD');
    expect(result.ontTelemetry['ont-loop'].candidatePaths).toHaveLength(1);
  });

  it('keeps the best path when two OLTs feed the same subscriber', () => {
    const olt = (id: string, txPowerDbm: number): PonNode => ({
      id,
      type: 'olt',
      position: { x: 0, y: 0 },
      data: {
        kind: 'olt',
        portName: id.toUpperCase(),
        oltClass: 'B+',
        txPowerDbm,
        laserOn: true,
        wavelength: 1490,
      },
    });

    const nodes: PonNode[] = [
      olt('olt-weak', 1),
      olt('olt-strong', 5),
      {
        id: 'ont-dual',
        type: 'ont',
        position: { x: 400, y: 0 },
        data: { kind: 'ont', serial: 'D', subscriber: 'Dual homed', sensitivityDbm: -28 },
      },
    ];
    const edges: PonEdge[] = [
      { id: 'd1', source: 'olt-weak', target: 'ont-dual', sourceHandle: 'out', targetHandle: 'in', type: 'optical' },
      { id: 'd2', source: 'olt-strong', target: 'ont-dual', sourceHandle: 'out', targetHandle: 'in', type: 'optical' },
    ];

    const result = simulateTopology(nodes, edges, settings, 6);
    expect(result.ontTelemetry['ont-dual'].candidatePaths).toHaveLength(2);
    expect(result.ontTelemetry['ont-dual'].sourceOltId).toBe('olt-strong');
    expect(result.ontTelemetry['ont-dual'].rxPowerDbm).toBeCloseTo(3.0, 2);
  });

  it('decorates edges with per-state colours and arrow markers', () => {
    const { nodes, edges } = buildPreset('failing-long-haul') as {
      nodes: PonNode[];
      edges: PonEdge[];
    };
    const result = simulateTopology(nodes, edges, settings, 7);
    const decorated = decorateEdges(edges, result.edgeTelemetry);
    expect(decorated).toHaveLength(edges.length);
    const trunk = decorated.find((edge) => edge.id === 'e-b1');
    const drop = decorated.find((edge) => edge.id === 'e-b6');
    expect(trunk?.data?.edgeState).toBe('live');
    expect(drop?.data?.edgeState).toBe('degraded');
    expect(decorated.every((edge) => edge.markerEnd !== undefined)).toBe(true);
  });
});
