import { describe, expect, it } from 'vitest';
import { buildPreset } from '../presets';
import { simulateTopology } from '../opticalSimulator';
import { DEFAULT_SETTINGS } from '../../types';

/**
 * Golden values for the Standard 1:32 GPON Tree.
 *
 * The layout/navigation redesigns (Tasks 2–16 and the responsive polish) only
 * moved markup and CSS: `src/engine`, `src/data`, `src/types.ts` and the node
 * art are byte-identical to the last reviewed build. This test pins the numbers
 * an engineer would quote for that preset, so any future edit that changes a
 * loss, a margin or a status fails here instead of drifting silently.
 *
 * Reference values (unchanged): worst Rx −24.30 dBm, mean −22.62 dBm,
 * 13.5 km of plant, 3 subscribers (2 ONLINE + 1 WARNING).
 */
describe('Standard 1:32 GPON Tree — golden budget', () => {
  const preset = buildPreset('standard-1x32');
  if (!preset) throw new Error('standard-1x32 preset is missing');
  const simulation = simulateTopology(preset.nodes, preset.edges, DEFAULT_SETTINGS, 0);

  it('keeps the plant summary', () => {
    expect(preset.nodes).toHaveLength(11);
    expect(preset.edges).toHaveLength(10);
    expect(simulation.summary.totalFiberKm).toBe(13.5);
    expect(simulation.summary.subscriberCount).toBe(3);
    expect(simulation.summary.meanRxDbm).toBe(-22.62);
    expect(simulation.summary.worstRxDbm).toBe(-24.3);
    expect(simulation.summary.splitterTotal).toBe(2);
    expect(simulation.summary.totalSplices).toBe(10);
    expect(simulation.summary.totalConnectors).toBe(12);
    expect(simulation.summary.byStatus).toEqual({
      OVERLOAD: 0,
      ONLINE: 2,
      WARNING: 1,
      LOS: 0,
      DISCONNECTED: 0,
    });
  });

  it('keeps every subscriber reading', () => {
    const rows = Object.entries(simulation.ontTelemetry)
      .map(([id, telemetry]) => ({
        id,
        rxPowerDbm: telemetry.rxPowerDbm,
        totalLossDb: telemetry.totalLossDb,
        marginDb: telemetry.marginDb,
        status: telemetry.status,
        fiberKm: telemetry.fiberKm,
        cumulativeSplitRatio: telemetry.cumulativeSplitRatio,
        splices: telemetry.splices,
        connectors: telemetry.connectors,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(rows).toEqual([
      {
        id: 'ont-a1',
        rxPowerDbm: -21.57,
        totalLossDb: 24.58,
        marginDb: 6.43,
        status: 'ONLINE',
        fiberKm: 6.3,
        cumulativeSplitRatio: 32,
        splices: 3,
        connectors: 6,
      },
      {
        id: 'ont-a2',
        rxPowerDbm: -22,
        totalLossDb: 25,
        marginDb: 6,
        status: 'ONLINE',
        fiberKm: 7.2,
        cumulativeSplitRatio: 32,
        splices: 5,
        connectors: 6,
      },
      {
        id: 'ont-a3',
        rxPowerDbm: -24.3,
        totalLossDb: 27.3,
        marginDb: 3.7,
        status: 'WARNING',
        fiberKm: 12,
        cumulativeSplitRatio: 32,
        splices: 6,
        connectors: 8,
      },
    ]);
  });

  it('keeps the OLT launch and the worst-case margin identical', () => {
    const olt = preset.nodes.find((node) => node.type === 'olt');
    expect(olt).toBeDefined();
    const paths = Object.values(simulation.bestPaths);
    expect(paths).toHaveLength(3);
    expect(new Set(paths.map((path) => path.oltPort))).toEqual(new Set(['PON 0/1/0']));
    expect(Math.min(...paths.map((path) => path.txPowerDbm))).toBe(3);
  });
});
