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
  it('shows simulator-backed receive power and routes both calls to action', () => {
    const { onLaunchStudio, onExploreMissions } = renderHero();

    expect(screen.getByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    // The weakest home, not the first ONLINE entry: -24.30 dBm / MARGINAL.
    expect(screen.getByText('-24.30 dBm')).toBeInTheDocument();
    expect(screen.getByText('MARGINAL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Launch Interactive Studio/i }));
    expect(onLaunchStudio).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /Explore Guided Missions/i }));
    expect(onExploreMissions).toHaveBeenCalledOnce();
  });

  it('fuses the splice after a completed hold, without gating the launch button', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio } = renderHero();

    const holdButton = screen.getByRole('button', { name: /Press and hold to fuse the splice/i });
    // The plain launch button must keep working on its own.
    expect(onLaunchStudio).not.toHaveBeenCalled();

    const originalRaf = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now() + 2000), 1),
    });

    try {
      fireEvent.keyDown(holdButton, { key: ' ' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByText('FIBER FUSED')).toBeInTheDocument();
      expect(holdButton).toHaveAttribute('aria-pressed', 'true');
      expect(onLaunchStudio).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(420);
      });
      expect(onLaunchStudio).toHaveBeenCalledOnce();
    } finally {
      if (originalRaf) {
        Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalRaf });
      } else {
        Reflect.deleteProperty(window, 'requestAnimationFrame');
      }
    }
  });

  it('cancels the fusion when the hold is released early', () => {
    const { onLaunchStudio } = renderHero();

    const holdButton = screen.getByRole('button', { name: /Press and hold to fuse the splice/i });
    fireEvent.keyDown(holdButton, { key: ' ' });
    fireEvent.keyUp(holdButton, { key: ' ' });

    expect(onLaunchStudio).not.toHaveBeenCalled();
    expect(screen.getByText('HOLD TO FUSE THE SPLICE')).toBeInTheDocument();
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
