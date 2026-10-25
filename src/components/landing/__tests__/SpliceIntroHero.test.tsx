import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../types';
import { simulateTopology } from '../../../engine/opticalSimulator';
import { buildPreset } from '../../../engine/presets';
import { SpliceIntroHero } from '../SpliceIntroHero';

const standardSimulation = () => {
  const topology = buildPreset('standard-1x32');
  if (!topology) throw new Error('The standard reference topology is missing.');
  return simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
};

/**
 * A completed hold. requestAnimationFrame is swapped for a timeout that reports
 * a timestamp well past HOLD_DURATION_MS, so one frame is enough to finish the
 * fusion without waiting out the real animation.
 */
async function holdToFuse() {
  const holdButton = screen.getByRole('button', { name: /Press and hold to fuse the splice/i });
  const originalRaf = window.requestAnimationFrame;
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now() + 4000), 1),
  });

  try {
    fireEvent.keyDown(holdButton, { key: ' ' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
  } finally {
    if (originalRaf) {
      Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalRaf });
    } else {
      Reflect.deleteProperty(window, 'requestAnimationFrame');
    }
  }
}

const renderHero = (overrides: Partial<Parameters<typeof SpliceIntroHero>[0]> = {}) => {
  const onLaunchStudio = vi.fn();
  const onExploreMissions = vi.fn();
  render(
    <SpliceIntroHero
      simulation={standardSimulation()}
      simulationStale={false}
      onLaunchStudio={onLaunchStudio}
      onExploreMissions={onExploreMissions}
      {...overrides}
    />,
  );
  return { onLaunchStudio, onExploreMissions };
};

afterEach(() => vi.useRealTimers());

describe('SpliceIntroHero', () => {
  it('shows simulator-backed receive power and holds the two doors back until the splice lands', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio, onExploreMissions } = renderHero();

    expect(screen.getByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    // The weakest home, not the first ONLINE entry: -24.30 dBm / MARGINAL.
    expect(screen.getByText('-24.30 dBm')).toBeInTheDocument();
    expect(screen.getByText('MARGINAL')).toBeInTheDocument();

    // Only the hold control is offered at first, with an instruction in the
    // action row's slot instead of the two studio doors.
    expect(screen.queryByRole('button', { name: /Launch Interactive Studio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Explore Guided Missions/i })).not.toBeInTheDocument();
    // The compact readout strip still names its source and what it measures.
    expect(screen.getByText('LIVE SIMULATION')).toBeInTheDocument();
    expect(screen.getByText('Weakest home')).toBeInTheDocument();

    await holdToFuse();

    fireEvent.click(screen.getByRole('button', { name: /Launch Interactive Studio/i }));
    expect(onLaunchStudio).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /Explore Guided Missions/i }));
    expect(onExploreMissions).toHaveBeenCalledOnce();
  });

  it('fuses on a completed hold, reveals both doors, and never navigates on its own', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio, onExploreMissions } = renderHero();

    await holdToFuse();

    // The hold control is gone, its confirmation moved to the readout card,
    // and both doors are on offer.
    expect(screen.queryByRole('button', { name: /Press and hold to fuse the splice/i })).not.toBeInTheDocument();
    expect(screen.getByText('FUSED!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Interactive Studio/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore Guided Missions/i })).toBeInTheDocument();

    // Fusion alone must not steal the choice.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onLaunchStudio).not.toHaveBeenCalled();
    expect(onExploreMissions).not.toHaveBeenCalled();
  });

  it('cancels the fusion when the hold is released early', () => {
    const { onLaunchStudio } = renderHero();

    const holdButton = screen.getByRole('button', { name: /Press and hold to fuse the splice/i });
    fireEvent.keyDown(holdButton, { key: ' ' });
    fireEvent.keyUp(holdButton, { key: ' ' });

    expect(onLaunchStudio).not.toHaveBeenCalled();
    expect(screen.getByText('HOLD TO FUSE THE SPLICE')).toBeInTheDocument();
    // A cancelled hold keeps the doors away.
    expect(screen.queryByRole('button', { name: /Launch Interactive Studio/i })).not.toBeInTheDocument();
    expect(screen.queryByText('FUSED!')).not.toBeInTheDocument();
  });

  it('reads gateway-only networks instead of falling back to an empty state', () => {
    const topology = buildPreset('modern-10g-xgs-pon-suburb');
    if (!topology) throw new Error('The XGS-PON reference topology is missing.');
    const simulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);

    renderHero({ simulation });

    expect(screen.getByText('-12.45 dBm')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
    expect(screen.queryByText('NO SIMULATED PATH')).not.toBeInTheDocument();
  });

  it('labels a reference-tree reading as a sample', () => {
    renderHero({ simulationIsReference: true });

    expect(screen.getByText('REFERENCE 1:32 TREE')).toBeInTheDocument();
    expect(screen.getByText(/Sample reading from the reference tree/i)).toBeInTheDocument();
  });
});
