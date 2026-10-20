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

afterEach(() => vi.useRealTimers());

describe('SpliceIntroHero', () => {
  it('shows simulator-backed receive power and opens the studio after a completed hold', async () => {
    vi.useFakeTimers();
    const onLaunchStudio = vi.fn();
    render(
      <SpliceIntroHero simulation={standardSimulation()} simulationStale={false} onLaunchStudio={onLaunchStudio} />,
    );

    expect(screen.getByText('-21.57 dBm')).toBeInTheDocument();
    const spliceButton = screen.getByRole('button', { name: /Press and hold to splice/i });
    const originalRaf = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now() + 2000), 1),
    });

    try {
      fireEvent.keyDown(spliceButton, { key: ' ' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByText('FIBER FUSED')).toBeInTheDocument();
      expect(onLaunchStudio).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(520);
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
});
