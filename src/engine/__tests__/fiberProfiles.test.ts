import { describe, expect, it } from 'vitest';
import {
  computeAttenuatorLoss,
  computeFiberLoss,
  fiberAttenuationDbPerKm,
  findModalDispersionWarnings,
  resolveFiberWavelength,
  simulateTopology,
  wavelengthsForProfile,
} from '../opticalSimulator';
import { generateOtdrTrace } from '../otdrSimulator';
import { readOpticalPowerAtProbe } from '../opticalProbe';
import { calculateNetworkCost } from '../../data/pricingCatalogue';
import { createAttenuatorNode, createFiberNode, createOltNode, createOntNode } from '../factories';
import {
  ATTENUATION_DB_PER_KM,
  DEFAULT_ATTENUATOR_DB,
  DEFAULT_SETTINGS,
  FIBER_PROFILE_SPECS,
  MODAL_DISPERSION_LIMIT_KM,
  MODAL_DISPERSION_WARNING,
  normaliseAttenuatorDb,
  type FiberNodeData,
  type PonEdge,
  type PonNode,
} from '../../types';

const settings = { ...DEFAULT_SETTINGS };

function fiberData(patch: Partial<FiberNodeData> = {}): FiberNodeData {
  return {
    kind: 'fiber',
    cableType: 'drop',
    fiberProfile: 'om3',
    lengthKm: 0.3,
    splices: 0,
    connectors: 0,
    wavelength: 850,
    attenuationOverrideDbPerKm: null,
    ...patch,
  };
}

/** OLT → fiber → [attenuator] → ONT, with no splices or connectors. */
function oltFiberOnt(attenuationDb?: number): { nodes: PonNode[]; edges: PonEdge[] } {
  const olt = createOltNode({ id: 'olt-1', position: { x: 0, y: 0 } });
  const fiber = createFiberNode('drop', { id: 'fiber-1', position: { x: 200, y: 0 } });
  const ont = createOntNode({ id: 'ont-1', position: { x: 600, y: 0 } }, 'HWTC00000001', 'Unit 1');
  if (fiber.type !== 'fiber') throw new Error('factory returned a non-fiber node');
  const stripped: PonNode = {
    ...fiber,
    data: { ...fiber.data, lengthKm: 1, splices: 0, connectors: 0, wavelength: 1490 },
  };

  if (attenuationDb === undefined) {
    return {
      nodes: [olt, stripped, ont],
      edges: [
        { id: 'e1', source: 'olt-1', target: 'fiber-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'fiber-1', target: 'ont-1', sourceHandle: 'out', targetHandle: 'in' },
      ],
    };
  }

  const pad = createAttenuatorNode(attenuationDb, { id: 'pad-1', position: { x: 400, y: 0 } });
  return {
    nodes: [olt, stripped, pad, ont],
    edges: [
      { id: 'e1', source: 'olt-1', target: 'fiber-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'fiber-1', target: 'pad-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e3', source: 'pad-1', target: 'ont-1', sourceHandle: 'out', targetHandle: 'in' },
    ],
  };
}

describe('multi-mode fibre profile', () => {
  it('owns its own 850/1300 nm coefficients and leaves the single-mode table alone', () => {
    expect(FIBER_PROFILE_SPECS.om3.coreCladding).toBe('50/125 µm');
    expect(FIBER_PROFILE_SPECS.om4.jacketHex).toBe('#06b6d4');
    expect(ATTENUATION_DB_PER_KM[850]).toBe(3.0);
    expect(ATTENUATION_DB_PER_KM[1300]).toBe(1.0);
    // The single-mode windows are untouched.
    expect(ATTENUATION_DB_PER_KM[1310]).toBe(0.35);
    expect(ATTENUATION_DB_PER_KM[1490]).toBe(0.25);
    expect(ATTENUATION_DB_PER_KM[1550]).toBe(0.2);

    expect(fiberAttenuationDbPerKm(fiberData({ wavelength: 850 }))).toBeCloseTo(3.0, 6);
    expect(fiberAttenuationDbPerKm(fiberData({ lengthKm: 0.3, wavelength: 1300 }))).toBeCloseTo(1.0, 6);
    expect(fiberAttenuationDbPerKm(fiberData({ fiberProfile: 'om4', wavelength: 850 }))).toBeCloseTo(3.0, 6);
  });

  it('constrains the wavelength choices to the profile', () => {
    expect(wavelengthsForProfile('singlemode')).toEqual([1270, 1310, 1490, 1550, 1577]);
    expect(wavelengthsForProfile('om3')).toEqual([850, 1300]);
    expect(wavelengthsForProfile(undefined)).toEqual([1270, 1310, 1490, 1550, 1577]);

    // A stale single-mode wavelength on a multi-mode span falls back to 850 nm
    // instead of silently using the 0.20 dB/km single-mode coefficient.
    expect(resolveFiberWavelength(fiberData({ wavelength: 1550 }))).toBe(850);
    expect(fiberAttenuationDbPerKm(fiberData({ wavelength: 1550 }))).toBeCloseTo(3.0, 6);
    // Legacy documents without a profile keep their stored wavelength.
    expect(resolveFiberWavelength(fiberData({ fiberProfile: undefined, wavelength: 1490 }))).toBe(1490);
  });

  it('flags a span past 550 m without adding any artificial loss', () => {
    const atLimit = fiberData({ lengthKm: MODAL_DISPERSION_LIMIT_KM });
    const overLimit = fiberData({ lengthKm: 1 });

    expect(
      findModalDispersionWarnings([{ id: 'f1', type: 'fiber', position: { x: 0, y: 0 }, data: atLimit } as PonNode]),
    ).toHaveLength(0);
    const warnings = findModalDispersionWarnings([
      { id: 'f1', type: 'fiber', position: { x: 0, y: 0 }, data: overLimit } as PonNode,
    ]);
    expect(warnings).toEqual([{ nodeId: 'f1', fiberProfile: 'om3', lengthKm: 1, message: MODAL_DISPERSION_WARNING }]);

    // Reach is a flag, not a penalty: the loss is exactly length × coefficient.
    expect(computeFiberLoss(overLimit).totalDb).toBeCloseTo(3.0, 6);
    expect(computeFiberLoss(overLimit).cableDb).toBeCloseTo(3.0, 6);
  });

  it('reports the flag on the simulation summary and keeps single-mode spans clear', () => {
    const { nodes, edges } = oltFiberOnt();
    const mmNodes = nodes.map((node) =>
      node.type === 'fiber'
        ? { ...node, data: { ...node.data, fiberProfile: 'om4' as const, wavelength: 850 as const } }
        : node,
    );
    const mm = simulateTopology(mmNodes, edges, settings);
    expect(mm.summary.modalDispersionWarnings).toHaveLength(1);
    expect(mm.summary.modalDispersionWarnings[0].message).toBe(MODAL_DISPERSION_WARNING);
    // 1 km of OM4 at 850 nm costs 3.0 dB. At −2.00 dBm the receiver is inside
    // its overload window, which is exactly the case a pad exists to fix.
    expect(mm.ontTelemetry['ont-1'].rxPowerDbm).toBeCloseTo(3 - 3.0 - 2.0, 6);
    expect(mm.ontTelemetry['ont-1'].status).toBe('OVERLOAD');

    const sm = simulateTopology(nodes, edges, settings);
    expect(sm.summary.modalDispersionWarnings).toHaveLength(0);
    expect(sm.ontTelemetry['ont-1'].rxPowerDbm).toBeCloseTo(3 - 0.25 - 2.0, 6);
  });
});

describe('inline attenuator pad', () => {
  it('clamps the pad value to the catalogue', () => {
    expect(DEFAULT_ATTENUATOR_DB).toBe(5);
    expect(normaliseAttenuatorDb(undefined)).toBe(5);
    expect(normaliseAttenuatorDb(4.4)).toBe(5);
    expect(normaliseAttenuatorDb(9)).toBe(10);
    expect(normaliseAttenuatorDb(15)).toBe(15);
    expect(computeAttenuatorLoss({ kind: 'attenuator', attenuationDb: 15, polish: 'SC/APC' })).toBe(15);
  });

  it('subtracts the pad from the path budget and labels the segment', () => {
    const { nodes, edges } = oltFiberOnt(10);
    const simulation = simulateTopology(nodes, edges, settings);
    const path = simulation.bestPaths['ont-1'];
    expect(path).toBeDefined();

    const segment = path?.segments.find((entry) => entry.component === 'attenuator');
    expect(segment).toMatchObject({ nodeId: 'pad-1', lossDb: 10, label: 'Inline attenuator pad · 10 dB (SC/APC)' });
    // +3 dBm launch − 0.25 dB fibre − 10 dB pad − 2 dB margin
    expect(simulation.ontTelemetry['ont-1'].rxPowerDbm).toBeCloseTo(3 - 0.25 - 10 - 2.0, 6);
    expect(simulation.ontTelemetry['ont-1'].status).toBe('ONLINE');

    // The same plant without the pad overloads the receiver, which is the
    // engineering reason the component exists.
    const bare = simulateTopology(
      nodes.filter((node) => node.type !== 'attenuator'),
      [
        { id: 'e1', source: 'olt-1', target: 'fiber-1', sourceHandle: 'out', targetHandle: 'in' },
        { id: 'e2', source: 'fiber-1', target: 'ont-1', sourceHandle: 'out', targetHandle: 'in' },
      ],
      settings,
    );
    expect(bare.ontTelemetry['ont-1'].rxPowerDbm).toBeCloseTo(0.75, 6);
    expect(bare.ontTelemetry['ont-1'].status).toBe('OVERLOAD');
  });

  it('reads through the pad on the field power meter', () => {
    const { nodes, edges } = oltFiberOnt(5);
    const simulation = simulateTopology(nodes, edges, settings);
    expect(
      readOpticalPowerAtProbe(
        { kind: 'node', id: 'pad-1', handleId: 'in', handleType: 'target' },
        nodes,
        edges,
        simulation,
      ),
    ).toBeCloseTo(2.75, 6);
    expect(
      readOpticalPowerAtProbe(
        { kind: 'node', id: 'pad-1', handleId: 'out', handleType: 'source' },
        nodes,
        edges,
        simulation,
      ),
    ).toBeCloseTo(-2.25, 6);
  });

  it('draws one reflection-free OTDR event at the pad', () => {
    const { nodes, edges } = oltFiberOnt(5);
    const trace = generateOtdrTrace(nodes, edges, 'olt-1', 'ont-1', 1550, 100);
    const padEvent = trace.events.find((event) => event.type === 'attenuator');
    expect(padEvent).toBeDefined();
    expect(padEvent?.description).toBe('Inline attenuator pad · 5 dB fixed loss (SC/APC)');
    expect(padEvent?.relativeLossDb).toBe(-5);
    expect(padEvent?.reflectionPeakDb).toBeUndefined();
    expect(padEvent?.passFail).toBe('PASS');
  });

  it('prices the pad as a passive line item', () => {
    const { nodes, edges } = oltFiberOnt(5);
    const withoutPad = nodes.filter((node) => node.type !== 'attenuator');
    const edgesWithoutPad: PonEdge[] = [
      { id: 'e1', source: 'olt-1', target: 'fiber-1', sourceHandle: 'out', targetHandle: 'in' },
      { id: 'e2', source: 'fiber-1', target: 'ont-1', sourceHandle: 'out', targetHandle: 'in' },
    ];
    const bare = calculateNetworkCost(withoutPad, edgesWithoutPad);
    const withPad = calculateNetworkCost(nodes, edges);
    const line = withPad.lineItems.find((item) => item.item === 'Inline fixed attenuator pad (reference)');

    expect(line).toMatchObject({ category: 'Passives', quantity: 1, unit: 'each', unitPrice: 15, totalPrice: 15 });
    expect(withPad.materialsCost).toBeCloseTo(bare.materialsCost + 15, 2);
    // The pad is passive hardware: it never touches labour.
    expect(withPad.laborCost).toBeCloseTo(bare.laborCost, 2);
  });
});
