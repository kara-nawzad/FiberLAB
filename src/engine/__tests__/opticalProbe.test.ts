import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type PonEdge, type PonNode } from '../../types';
import { buildPreset } from '../presets';
import { readOpticalPowerAtProbe, sameProbeTarget, simulateAtMeterWavelength } from '../opticalProbe';

const settings = { ...DEFAULT_SETTINGS };

function standardTopology(): { nodes: PonNode[]; edges: PonEdge[] } {
  const topology = buildPreset('standard-1x32');
  if (!topology) throw new Error('The standard learning topology is missing.');
  return topology;
}

describe('simulator-backed field OPM', () => {
  it('reports power at patch cords and individual source/target ports', () => {
    const { nodes, edges } = standardTopology();
    const simulation = simulateAtMeterWavelength(nodes, edges, settings, 1490);

    expect(readOpticalPowerAtProbe({ kind: 'edge', id: 'e-a1' }, nodes, edges, simulation)).toBe(3);
    expect(readOpticalPowerAtProbe(
      { kind: 'node', id: 'fiber-feeder-a', handleId: 'in', handleType: 'target' },
      nodes,
      edges,
      simulation,
    )).toBe(3);
    expect(readOpticalPowerAtProbe(
      { kind: 'node', id: 'fiber-feeder-a', handleId: 'out', handleType: 'source' },
      nodes,
      edges,
      simulation,
    )).toBeCloseTo(0.75, 6);
    expect(readOpticalPowerAtProbe({ kind: 'edge', id: 'e-a2' }, nodes, edges, simulation)).toBeCloseTo(0.75, 6);
  });

  it('re-calibrates the same topology at 1310, 1490, and 1550 nm without editing it', () => {
    const { nodes, edges } = standardTopology();
    const baselineWavelengths = nodes
      .filter((node) => node.type === 'fiber')
      .map((node) => node.data.wavelength);
    const readings = [1310, 1490, 1550].map((wavelength) => {
      const simulation = simulateAtMeterWavelength(nodes, edges, settings, wavelength as 1310 | 1490 | 1550);
      return simulation.edgeTelemetry['e-a2'].powerDbm;
    });

    expect(readings[0]).toBeCloseTo(0.25, 6);
    expect(readings[1]).toBeCloseTo(0.75, 6);
    expect(readings[2]).toBeCloseTo(1.0, 6);
    expect(nodes.filter((node) => node.type === 'fiber').map((node) => node.data.wavelength)).toEqual(baselineWavelengths);
  });

  it('shows LO for disabled transmitters and disconnected ports', () => {
    const { nodes, edges } = standardTopology();
    const darkNodes = nodes.map((node) => node.type === 'olt'
      ? { ...node, data: { ...node.data, laserOn: false } }
      : node) as PonNode[];
    const simulation = simulateAtMeterWavelength(darkNodes, edges, settings, 1490);

    expect(readOpticalPowerAtProbe({ kind: 'edge', id: 'e-a1' }, darkNodes, edges, simulation)).toBeNull();
    expect(readOpticalPowerAtProbe(
      { kind: 'node', id: 'ont-a3', handleId: 'in', handleType: 'target' },
      darkNodes,
      edges,
      simulation,
    )).toBeNull();
  });

  it('meters ODF matched-pair and unpatched NAP outputs, including gateway-side probes', () => {
    const topology = buildPreset('modern-10g-xgs-pon-suburb');
    if (!topology) throw new Error('The modern XGS-PON suburb preset is missing.');
    const { nodes, edges } = topology;
    const simulation = simulateAtMeterWavelength(nodes, edges, settings, 1490);

    expect(readOpticalPowerAtProbe(
      { kind: 'node', id: 'odf-xgs-suburb', handleId: 'in-0', handleType: 'target' },
      nodes,
      edges,
      simulation,
    )).toBe(5);
    expect(readOpticalPowerAtProbe(
      { kind: 'node', id: 'odf-xgs-suburb', handleId: 'out-0', handleType: 'source' },
      nodes,
      edges,
      simulation,
    )).toBe(4.5);
    expect(readOpticalPowerAtProbe(
      { kind: 'node', id: 'nap-xgs-suburb', handleId: 'out-7', handleType: 'source' },
      nodes,
      edges,
      simulation,
    )).toBeCloseTo(-9.45, 2);
    expect(readOpticalPowerAtProbe(
      { kind: 'node', id: 'gateway-xgs-1', handleId: 'in', handleType: 'target' },
      nodes,
      edges,
      simulation,
    )).not.toBeNull();
  });

  it('compares probe targets without changing identity during repeated pointer frames', () => {
    expect(sameProbeTarget(
      { kind: 'node', id: 'fiber-a', handleId: 'out', handleType: 'source' },
      { kind: 'node', id: 'fiber-a', handleId: 'out', handleType: 'source' },
    )).toBe(true);
    expect(sameProbeTarget(
      { kind: 'node', id: 'fiber-a', handleId: 'out', handleType: 'source' },
      { kind: 'node', id: 'fiber-a', handleId: 'in', handleType: 'target' },
    )).toBe(false);
  });
});
