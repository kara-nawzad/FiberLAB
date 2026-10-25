import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Radio } from 'lucide-react';
import spliceHeroScene from '../../assets/splice-hero-scene.svg?raw';

interface SpliceIntroHeroProps {
  onLaunchStudio: () => void;
}

/*
 * The hero is deliberately thin: brand eyebrow, headline, one sentence, and a
 * single door into the studio — earned by doing the thing the headline says.
 * You hold the splice for two and a half seconds, the light crosses the fiber,
 * the home lights up, and only then does "Launch Studio" appear.
 *
 * Everything an engineer needs to read — budgets, tables, missions, quotations —
 * lives in the sections below.
 */
const HOLD_DURATION_MS = 2500;

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
      setAnnouncement('Splice released early. Press and hold again to splice the fiber.');
    }
  }, [cancelFrame]);

  const begin = useCallback(() => {
    if (openedRef.current || startedAtRef.current !== null) return;
    startedAtRef.current = performance.now();
    setAnnouncement('Splicing started. Keep holding for two and a half seconds.');

    const advance = (now: number) => {
      if (startedAtRef.current === null || openedRef.current) return;
      const nextProgress = Math.min(1, (now - startedAtRef.current) / HOLD_DURATION_MS);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        openedRef.current = true;
        startedAtRef.current = null;
        setProgress(1);
        setFused(true);
        setAnnouncement('Splice complete. The light crosses the fiber and the home is lit. Launch Studio is ready.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(18);
        frameRef.current = null;
        return;
      }
      frameRef.current = scheduleFrame(advance);
    };

    frameRef.current = scheduleFrame(advance);
  }, []);

  useEffect(() => () => cancelFrame(), [cancelFrame]);

  const holding = progress > 0 && !fused;
  // The label teaches the gesture before it counts: a tap reads "keep holding",
  // and the percentage only appears once the hold is genuinely under way.
  const spliceLabel = !holding
    ? 'HOLD TO SPLICE'
    : progress < 0.08
      ? 'KEEP HOLDING'
      : `SPLICING ${Math.round(progress * 100)}%`;

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
          {fused ? (
            <>
              <button type="button" className="landing-button landing-button--primary" onClick={onLaunchStudio}>
                Launch Studio <ArrowRight size={18} aria-hidden="true" />
              </button>
              <span className="splice-fuse is-complete">
                <span className="splice-fuse-content">
                  <Check size={18} aria-hidden="true" />
                  SPLICE COMPLETE
                </span>
              </span>
            </>
          ) : (
            <button
              type="button"
              className={`splice-fuse${holding ? ' is-holding' : ''}`}
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
              aria-label="Press and hold to splice the fiber"
              title="Hold for two and a half seconds to splice the fiber"
            >
              <span className="splice-fuse-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
              <span className="splice-fuse-content">
                <Radio size={18} aria-hidden="true" />
                {spliceLabel}
              </span>
            </button>
          )}
        </div>

        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </div>
    </section>
  );
}

export default SpliceIntroHero;
