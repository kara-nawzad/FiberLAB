import { describe, expect, it } from 'vitest';
import type { PonEdge, PonNode } from '../../types';
import { buildPreset } from '../presets';
import { generateOtdrTrace, getReachableOtdrTargets } from '../otdrSimulator';

describe('pure OTDR trace analyzer', () => {
  it('walks the Standard 1:32 branch in order and samples a deterministic backscatter trace', () => {
    const topology = buildPreset('standard-1x32');
    if (!topology) throw new Error('The standard reference topology is missing.');
    const nodesBefore = JSON.stringify(topology.nodes);
    const first = generateOtdrTrace(topology.nodes, topology.edges, 'olt-a', 'ont-a1', 1490, 100);
    const second = generateOtdrTrace(topology.nodes, topology.edges, 'olt-a', 'ont-a1', 1490, 100);

    expect(first).toEqual(second);
    expect(JSON.stringify(topology.nodes)).toBe(nodesBefore);
    expect(first.wavelengthNm).toBe(1490);
    expect(first.pulseWidthNs).toBe(100);
    expect(first.totalDistanceKm).toBeCloseTo(6.3, 5);
    expect(first.tracePoints.length).toBeGreaterThanOrEqual(100);
    expect(first.tracePoints.length).toBeLessThanOrEqual(300);
    expect(first.tracePoints[0].distanceKm).toBe(0);
    expect(first.tracePoints.at(-1)).toEqual({ distanceKm: 6.3, powerDb: -45 });

    const events = first.events;
    expect(events[0].type).toBe('launch');
    expect(events.at(-1)?.type).toBe('end_of_fiber');
    expect(events.some((event) => event.type === 'fiber_span')).toBe(true);
    expect(events.some((event) => event.type === 'splice')).toBe(true);
    expect(events.filter((event) => event.type === 'splitter').map((event) => event.relativeLossDb))
      .toEqual([-7.2, -10.5]);
    expect(events.findIndex((event) => event.type === 'fiber_span'))
      .toBeLessThan(events.findIndex((event) => event.type === 'splitter'));
    expect(first.totalLossDb).toBeCloseTo(22.575, 3);
  });

  it('detects a macro-bend as a failing non-reflective step and retains splitter cliffs', () => {
    const topology = buildPreset('standard-1x32');
    if (!topology) throw new Error('The standard reference topology is missing.');
    const nodes = topology.nodes.map((node) => (
      node.type === 'fiber' && node.id === 'fiber-feeder-a'
        ? { ...node, data: { ...node.data, macroBendActive: true } }
        : node
    ));
    const trace = generateOtdrTrace(nodes, topology.edges, 'olt-a', 'ont-a1', 1490);
    const bend = trace.events.find((event) => event.type === 'fault_bend');

    expect(bend).toMatchObject({
      id: 'fiber-feeder-a:macro-bend',
      relativeLossDb: -3.5,
      passFail: 'FAIL',
    });
    expect(bend?.reflectionPeakDb).toBeUndefined();
    expect(trace.events.filter((event) => event.type === 'splitter').map((event) => event.relativeLossDb))
      .toEqual([-7.2, -10.5]);
    expect(trace.totalLossDb).toBeCloseTo(26.075, 3);
  });

  it('shows a four-decibel Fresnel return at the terminal ONT before the noise-floor drop', () => {
    const topology = buildPreset('standard-1x32');
    if (!topology) throw new Error('The standard reference topology is missing.');
    const trace = generateOtdrTrace(topology.nodes, topology.edges, 'olt-a', 'ont-a1');
    const end = trace.events.at(-1);

    expect(end).toMatchObject({
      type: 'end_of_fiber',
      distanceKm: 6.3,
      relativeLossDb: 0,
      reflectionPeakDb: 4,
      passFail: 'PASS',
    });
    expect(trace.tracePoints.at(-1)?.powerDb).toBe(-45);
  });

  it('uses the selected wavelength attenuation and can start from a feeder span', () => {
    const nodes: PonNode[] = [
      {
        id: 'olt-test', type: 'olt', position: { x: 0, y: 0 },
        data: { kind: 'olt', portName: 'PON 0/1/0', oltClass: 'B+', txPowerDbm: 3, laserOn: true, wavelength: 1490 },
      },
      {
        id: 'fiber-test', type: 'fiber', position: { x: 100, y: 0 },
        data: {
          kind: 'fiber', cableType: 'feeder', lengthKm: 10, splices: 0, connectors: 0,
          wavelength: 1490, attenuationOverrideDbPerKm: null,
        },
      },
      {
        id: 'ont-test', type: 'ont', position: { x: 200, y: 0 },
        data: { kind: 'ont', serial: 'OTDR-001', subscriber: 'Test home', sensitivityDbm: -28 },
      },
    ];
    const edges: PonEdge[] = [
      { id: 'e1', source: 'olt-test', sourceHandle: 'out', target: 'fiber-test', targetHandle: 'in', type: 'optical' },
      { id: 'e2', source: 'fiber-test', sourceHandle: 'out', target: 'ont-test', targetHandle: 'in', type: 'optical' },
    ];
    const at1490 = generateOtdrTrace(nodes, edges, 'fiber-test', 'ont-test', 1490);
    const at1310 = generateOtdrTrace(nodes, edges, 'fiber-test', 'ont-test', 1310);
    const at1550 = generateOtdrTrace(nodes, edges, 'fiber-test', 'ont-test', 1550);
    const at1270 = generateOtdrTrace(nodes, edges, 'fiber-test', 'ont-test', 1270);
    const at1577 = generateOtdrTrace(nodes, edges, 'fiber-test', 'ont-test', 1577);

    expect(at1490.totalDistanceKm).toBe(10);
    expect(at1490.totalLossDb).toBeCloseTo(2.5, 5);
    expect(at1310.totalLossDb).toBeCloseTo(3.5, 5);
    expect(at1550.totalLossDb).toBeCloseTo(2.0, 5);
    expect(at1270.totalLossDb).toBeCloseTo(3.5, 5);
    expect(at1577.totalLossDb).toBeCloseTo(2.2, 5);
    expect(at1490.events[0].type).toBe('launch');
    expect(at1490.events[1].type).toBe('fiber_span');
  });

  it('traces the XGS-PON NAP branch and reports ODF/NAP events at 1577 nm', () => {
    const topology = buildPreset('modern-10g-xgs-pon-suburb');
    if (!topology) throw new Error('The modern XGS-PON suburb preset is missing.');
    const targets = getReachableOtdrTargets(topology.nodes, topology.edges, 'olt-xgs-suburb');
    expect(targets.map((node) => node.id)).toEqual([
      'gateway-xgs-1',
      'gateway-xgs-2',
      'gateway-xgs-3',
    ]);

    const trace = generateOtdrTrace(
      topology.nodes,
      topology.edges,
      'olt-xgs-suburb',
      'gateway-xgs-1',
      1577,
    );
    expect(trace.wavelengthNm).toBe(1577);
    expect(trace.totalDistanceKm).toBeCloseTo(4.85, 5);
    expect(trace.totalLossDb).toBeCloseTo(15.447, 3);
    expect(trace.events.some((event) => event.type === 'odf' && event.relativeLossDb === -0.5)).toBe(true);
    expect(trace.events.some((event) => event.type === 'nap' && event.relativeLossDb === -10.5)).toBe(true);
    expect(trace.events.at(-1)?.description).toContain('Modern Suburb — Home 1');
  });
});
