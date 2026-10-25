import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpliceIntroHero } from '../SpliceIntroHero';

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
  render(<SpliceIntroHero onLaunchStudio={onLaunchStudio} {...overrides} />);
  return { onLaunchStudio };
};

afterEach(() => vi.useRealTimers());

describe('SpliceIntroHero', () => {
  it('says one thing and offers one door into the studio', () => {
    const { onLaunchStudio } = renderHero();

    expect(screen.getByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    expect(
      screen.getByText('Build a fiber-to-the-home network and simulate its optical performance.'),
    ).toBeInTheDocument();

    const launch = screen.getByRole('button', { name: /Launch Studio/i });
    fireEvent.click(launch);
    expect(onLaunchStudio).toHaveBeenCalledOnce();

    // Exactly one primary action: no second studio door, no mission door.
    expect(screen.queryByRole('button', { name: /Launch Interactive Studio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Explore Guided Missions/i })).not.toBeInTheDocument();
  });

  it('keeps every optical reading out of the hero', () => {
    renderHero();

    expect(screen.queryByText(/Weakest home/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dBm/)).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE SIMULATION')).not.toBeInTheDocument();
    expect(screen.queryByText(/Splitter 1:4/)).not.toBeInTheDocument();
    expect(screen.queryByText('Launch power')).not.toBeInTheDocument();
  });

  it('fuses on a completed hold and never navigates on its own', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio } = renderHero();

    await holdToFuse();

    expect(screen.getByText('SPLICE FUSED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Splice fused/i })).toHaveAttribute('aria-pressed', 'true');
    // The primary door never moves: it is there before and after the flourish.
    expect(screen.getByRole('button', { name: /Launch Studio/i })).toBeInTheDocument();

    // Fusion alone must not steal the choice.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(onLaunchStudio).not.toHaveBeenCalled();
  });

  it('cancels the fusion when the hold is released early', () => {
    const { onLaunchStudio } = renderHero();

    const pill = screen.getByRole('button', { name: /Press and hold to fuse the splice/i });
    fireEvent.keyDown(pill, { key: ' ' });
    fireEvent.keyUp(pill, { key: ' ' });

    expect(screen.getByText('HOLD TO FUSE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Press and hold to fuse the splice/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.queryByText('SPLICE FUSED')).not.toBeInTheDocument();
    expect(onLaunchStudio).not.toHaveBeenCalled();
  });

  it('announces the fusion to assistive technology', async () => {
    vi.useFakeTimers();
    renderHero();

    const pill = screen.getByRole('button', { name: /Press and hold to fuse the splice/i });
    fireEvent.keyDown(pill, { key: ' ' });
    expect(screen.getByText('Fusion started. Keep holding.')).toBeInTheDocument();
    fireEvent.keyUp(pill, { key: ' ' });
    expect(screen.getByText('Splice held briefly. Press and hold again to complete the fusion.')).toBeInTheDocument();
  });
});
