import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Radio } from 'lucide-react';
import spliceHeroScene from '../../assets/splice-hero-scene.svg?raw';

interface SpliceIntroHeroProps {
  onLaunchStudio: () => void;
}

/*
 * The hero is deliberately thin: brand eyebrow, headline, one sentence, one
 * primary door, and the scene itself. Everything an engineer needs to read —
 * budgets, tables, missions, quotations — lives in the sections below.
 *
 * The splice scene keeps its small hold-to-fuse flourish: it is a picture you
 * can light up, not a gate. "Launch Studio" is always one click away.
 */
const HOLD_DURATION_MS = 1100;

type ScheduledFrame = { id: number; kind: 'raf' | 'timeout' };

function scheduleFrame(callback: FrameRequestCallback): ScheduledFrame {
  if (typeof window.requestAnimationFrame === 'function') {
    return { id: window.requestAnimationFrame(callback), kind: 'raf' };
  }
  return { id: window.setTimeout(() => callback(performance.now()), 16), kind: 'timeout' };
}

export function SpliceIntroHero({ onLaunchStudio }: SpliceIntroHeroProps) {
  const [progress, setProgress] = useState(0);
  const [fused, setFused] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const frameRef = useRef<ScheduledFrame | null>(null);
  const openedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  const cancelFrame = useCallback(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    if (frame.kind === 'raf') window.cancelAnimationFrame(frame.id);
    else window.clearTimeout(frame.id);
    frameRef.current = null;
  }, []);

  const release = useCallback(() => {
    cancelFrame();
    startedAtRef.current = null;
    if (!openedRef.current) {
      setProgress(0);
      setAnnouncement('Splice held briefly. Press and hold again to complete the fusion.');
    }
  }, [cancelFrame]);

  const begin = useCallback(() => {
    if (openedRef.current || startedAtRef.current !== null) return;
    startedAtRef.current = performance.now();
    setAnnouncement('Fusion started. Keep holding.');

    const advance = (now: number) => {
      if (startedAtRef.current === null || openedRef.current) return;
      const nextProgress = Math.min(1, (now - startedAtRef.current) / HOLD_DURATION_MS);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        openedRef.current = true;
        startedAtRef.current = null;
        setProgress(1);
        setFused(true);
        setAnnouncement('Splice complete. The light now crosses the joint.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(18);
        frameRef.current = null;
        return;
      }
      frameRef.current = scheduleFrame(advance);
    };

    frameRef.current = scheduleFrame(advance);
  }, []);

  useEffect(() => () => cancelFrame(), [cancelFrame]);

  return (
    <section className={`splice-hero${fused ? ' is-fused' : ''}`} aria-labelledby="splice-hero-title">
      <div className={`splice-hero-scene${fused ? ' is-done' : ''}`} aria-hidden="true">
        <div className="splice-hero-svg" dangerouslySetInnerHTML={{ __html: spliceHeroScene }} />
        <div className="splice-hero-scene-wash" />
      </div>

      <div className="splice-hero-content">
        <div className="splice-hero-eyebrow">
          <span /> FIBER ACCESS NETWORK LAB
        </div>
        <h1 id="splice-hero-title">
          Splice the fiber.
          <br />
          <em>Light the home.</em>
        </h1>
        <p className="splice-hero-lede">Build a fiber-to-the-home network and simulate its optical performance.</p>

        <div className="splice-hero-actions">
          <button type="button" className="landing-button landing-button--primary" onClick={onLaunchStudio}>
            Launch Studio <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className={`splice-fuse${fused ? ' is-complete' : ''}`}
          onPointerDown={(event) => {
            if (event.button > 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            begin();
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
              event.preventDefault();
              begin();
            }
          }}
          onKeyUp={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              release();
            }
          }}
          aria-label={fused ? 'Splice fused' : 'Press and hold to fuse the splice'}
          aria-pressed={fused}
          title="Hold to light the splice on the scene"
        >
          <span className="splice-fuse-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
          <span className="splice-fuse-content">
            {fused ? <Check size={15} aria-hidden="true" /> : <Radio size={15} aria-hidden="true" />}
            {fused ? 'SPLICE FUSED' : progress > 0 ? 'KEEP HOLDING' : 'HOLD TO FUSE'}
          </span>
        </button>
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </div>
    </section>
  );
}

export default SpliceIntroHero;
