import { describe, expect, it } from 'vitest';
import { computeFiberLoss, isFiberNode, simulateTopology } from '../opticalSimulator';
import { buildPreset } from '../presets';
import { DEFAULT_SETTINGS, type DesignSettings, type PonEdge, type PonNode } from '../../types';

const settings: DesignSettings = { ...DEFAULT_SETTINGS };

const load = (preset: string) => {
  const { nodes, edges } = buildPreset(preset) as { nodes: PonNode[]; edges: PonEdge[] };
  return { nodes, edges, result: simulateTopology(nodes, edges, settings, 9001) };
};

describe('span telemetry (what the simulator actually metered)', () => {
  it('reports the wavelength and dB/km used for every fiber span on a live route', () => {
    const { nodes, result } = load('standard-1x32');
    const fibers = nodes.filter(isFiberNode);

    expect(fibers.length).toBeGreaterThan(0);
    for (const fiber of fibers) {
      const span = result.spanTelemetry[fiber.id];
      expect(span).toBeDefined();
      expect(span.wavelengthNm).toBe(fiber.data.wavelength);
      expect(span.attenuationDbPerKm).toBeCloseTo(computeFiberLoss(fiber.data).attenuationDbPerKm, 6);
      expect(span.xgsLocked).toBe(false);
    }
  });

  it('matches the meter the canvas pill prints, span by span', () => {
    const { nodes, result } = load('standard-1x32');

    for (const fiber of nodes.filter(isFiberNode)) {
      const span = result.spanTelemetry[fiber.id];
      if (!span) continue;
      const loss = computeFiberLoss(fiber.data);
      // The pill builds its dB from the metered attenuation, never the authored one.
      const pillDb =
        Math.max(0, fiber.data.lengthKm) * span.attenuationDbPerKm +
        loss.spliceDb +
        loss.connectorDb +
        loss.macroBendLossDb +
        loss.dirtyConnectorLossDb;

      expect(pillDb).toBeCloseTo(loss.totalDb, 6);
    }
  });

  it('flags an XGS-PON span that is metered away from its authored wavelength', () => {
    const { nodes, edges } = buildPreset('modern-10g-xgs-pon-suburb') as { nodes: PonNode[]; edges: PonEdge[] };
    const result = simulateTopology(nodes, edges, settings, 9002);
    const fibers = nodes.filter(isFiberNode);
    const locked = fibers.filter((fiber) => result.spanTelemetry[fiber.id]?.xgsLocked);
    const caught = fibers.filter((fiber) => result.spanTelemetry[fiber.id]);

    expect(caught.length).toBeGreaterThan(0);
    for (const fiber of caught) {
      const span = result.spanTelemetry[fiber.id];
      expect(span.wavelengthNm).toBe(1577);
      // Authored 1490 nm GPON glass on an XGS-PON route is exactly the case to surface.
      expect(span.xgsLocked).toBe(fiber.data.wavelength !== 1577);
    }
    expect(locked.length).toBe(
      caught.length - fibers.filter((f) => result.spanTelemetry[f.id] && f.data.wavelength === 1577).length,
    );
  });
});
