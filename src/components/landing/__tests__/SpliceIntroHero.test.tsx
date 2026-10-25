import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpliceIntroHero } from '../SpliceIntroHero';

const HOLD_BUTTON = /Press and hold to splice the fiber/i;

/**
 * Drive the hold with synthetic frames: each requestAnimationFrame becomes a
 * timeout whose timestamp jumps by the next offset in `offsets`. A 6000 ms jump
 * is well past the 2500 ms hold, so a single frame completes the splice.
 */
async function holdFor(offsets: number[]) {
  const holdButton = screen.getByRole('button', { name: HOLD_BUTTON });
  const originalRaf = window.requestAnimationFrame;
  let frames = 0;
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now() + (offsets[Math.min(frames++, offsets.length - 1)] ?? 0)), 1),
  });

  try {
    fireEvent.keyDown(holdButton, { key: ' ' });
    for (let frame = 0; frame < offsets.length; frame += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
    }
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
  it('offers only the splice, and holds the studio door back until it lands', () => {
    renderHero();

    expect(screen.getByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    expect(
      screen.getByText('Build a fiber-to-the-home network and simulate its optical performance.'),
    ).toBeInTheDocument();

    const hold = screen.getByRole('button', { name: HOLD_BUTTON });
    expect(hold).toHaveTextContent('HOLD TO SPLICE');
    // The studio is earned, not handed out: no door, no second action.
    expect(screen.queryByRole('button', { name: /Launch Studio/i })).not.toBeInTheDocument();
    expect(screen.queryByText('SPLICE COMPLETE')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('keeps every optical reading out of the hero', () => {
    renderHero();

    expect(screen.queryByText(/Weakest home/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dBm/)).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE SIMULATION')).not.toBeInTheDocument();
    expect(screen.queryByText(/Splitter 1:4/)).not.toBeInTheDocument();
    expect(screen.queryByText('Launch power')).not.toBeInTheDocument();
  });

  it('counts the hold up on the pill, then reveals Launch Studio', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio } = renderHero();

    await holdFor([1200]);

    const percent = screen.getByText(/SPLICING \d+%/);
    const value = Number(percent.textContent?.replace(/\D/g, ''));
    expect(value).toBeGreaterThan(30);
    expect(value).toBeLessThan(70);
    // The fill tracks the same number the label shows.
    const progressFill = document.querySelector('.splice-fuse-progress') as HTMLElement;
    const fill = Number(progressFill.style.transform.replace(/[^0-9.]/g, ''));
    expect(fill).toBeCloseTo(value / 100, 1);
    expect(onLaunchStudio).not.toHaveBeenCalled();
  });

  it('completes the splice on a full hold and only then offers the studio', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio } = renderHero();

    await holdFor([6000]);

    expect(screen.getByText('SPLICE COMPLETE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: HOLD_BUTTON })).not.toBeInTheDocument();

    const launch = screen.getByRole('button', { name: /Launch Studio/i });
    fireEvent.click(launch);
    expect(onLaunchStudio).toHaveBeenCalledOnce();
  });

  it('never opens the studio from the release that completed the splice', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio } = renderHero();

    const pill = screen.getByRole('button', { name: HOLD_BUTTON });
    const originalRaf = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now() + 6000), 1),
    });
    try {
      fireEvent.pointerDown(pill, { button: 0, pointerId: 1 });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
    } finally {
      if (originalRaf)
        Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalRaf });
      else Reflect.deleteProperty(window, 'requestAnimationFrame');
    }

    // The splice landed while the pointer was still down; the button that
    // appears under it must ignore the click the release produces.
    expect(screen.getByText('SPLICE COMPLETE')).toBeInTheDocument();
    const launch = screen.getByRole('button', { name: /Launch Studio/i });
    fireEvent.click(launch);
    expect(onLaunchStudio).not.toHaveBeenCalled();

    // A deliberate second click is the only way in.
    fireEvent.click(launch);
    expect(onLaunchStudio).toHaveBeenCalledOnce();
  });

  it('cancels and resets the hold when it is released early', async () => {
    vi.useFakeTimers();
    const { onLaunchStudio } = renderHero();

    await holdFor([1200]);
    fireEvent.keyUp(screen.getByRole('button', { name: HOLD_BUTTON }), { key: ' ' });

    expect(screen.getByText('HOLD TO SPLICE')).toBeInTheDocument();
    const progressFill = document.querySelector('.splice-fuse-progress') as HTMLElement;
    expect(progressFill.style.transform).toBe('scaleX(0)');
    expect(screen.queryByText('SPLICE COMPLETE')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Launch Studio/i })).not.toBeInTheDocument();
    expect(onLaunchStudio).not.toHaveBeenCalled();
  });

  it('announces the splice to assistive technology', async () => {
    vi.useFakeTimers();
    renderHero();

    const pill = screen.getByRole('button', { name: HOLD_BUTTON });
    fireEvent.keyDown(pill, { key: ' ' });
    expect(screen.getByText(/Splicing started/i)).toBeInTheDocument();
    fireEvent.keyUp(pill, { key: ' ' });
    expect(screen.getByText(/Splice released early/i)).toBeInTheDocument();
  });
});
