import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, Check, Radio } from 'lucide-react';
import { formatDbm } from '../../engine/opticalSimulator';
import type { OntStatus, SimulationResult } from '../../types';
import spliceHeroScene from '../../assets/splice-hero-scene.svg?raw';

interface SpliceIntroHeroProps {
  simulation: SimulationResult | null;
  simulationStale: boolean;
  simulationIsReference?: boolean;
  onLaunchStudio: () => void;
  onExploreMissions: () => void;
}

const STATUS_LABELS: Record<OntStatus, string> = {
  ONLINE: 'ONLINE',
  WARNING: 'MARGINAL',
  LOS: 'LOSS OF SIGNAL',
  OVERLOAD: 'OVERLOAD',
  DISCONNECTED: 'DISCONNECTED',
};

/* The fusion flourish: a short hold on the fibre scene lights the splice and
 * opens the studio. It is never required — the Launch button beside it does the
 * same thing in one click — so the hold stays a small piece of theatre. */
const HOLD_DURATION_MS = 1100;
const OPEN_DELAY_MS = 420;

type ScheduledFrame = { id: number; kind: 'raf' | 'timeout' };

function scheduleFrame(callback: FrameRequestCallback): ScheduledFrame {
  if (typeof window.requestAnimationFrame === 'function') {
    return { id: window.requestAnimationFrame(callback), kind: 'raf' };
  }
  return { id: window.setTimeout(() => callback(performance.now()), 16), kind: 'timeout' };
}

export function SpliceIntroHero({
  simulation,
  simulationStale,
  simulationIsReference = false,
  onLaunchStudio,
  onExploreMissions,
}: SpliceIntroHeroProps) {
  const [progress, setProgress] = useState(0);
  const [fused, setFused] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const frameRef = useRef<ScheduledFrame | null>(null);
  const openedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const launchTimerRef = useRef<number | null>(null);

  const reading = useMemo(() => {
    if (!simulation) return null;
    const values = Object.values(simulation.ontTelemetry);
    return (
      values.find((value) => value.status === 'ONLINE' && value.rxPowerDbm !== null) ??
      values.find((value) => value.rxPowerDbm !== null) ??
      values[0] ??
      null
    );
  }, [simulation]);

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
        setFused(true);
        setAnnouncement('Fusion complete. Opening the optical engineering studio.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(18);
        launchTimerRef.current = window.setTimeout(onLaunchStudio, OPEN_DELAY_MS);
        frameRef.current = null;
        return;
      }
      frameRef.current = scheduleFrame(advance);
    };

    frameRef.current = scheduleFrame(advance);
  }, [onLaunchStudio]);

  useEffect(
    () => () => {
      cancelFrame();
      if (launchTimerRef.current !== null) window.clearTimeout(launchTimerRef.current);
    },
    [cancelFrame],
  );

  const readingLabel =
    reading?.rxPowerDbm === null || reading?.rxPowerDbm === undefined ? '— —' : formatDbm(reading.rxPowerDbm);
  const readingStatus = reading ? STATUS_LABELS[reading.status] : 'NO SIMULATED PATH';
  const readingStateClass = reading ? `is-${reading.status.toLowerCase()}` : 'is-idle';

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
        <p className="splice-hero-lede">
          Build a fiber-to-the-home network in your browser, then watch the light budget decide which homes come online.
          Drag in an OLT, a splitter and a few subscribers — the physics handles the rest.
        </p>

        <div className="splice-hero-actions">
          <button type="button" className="landing-button landing-button--primary" onClick={onLaunchStudio}>
            Launch Interactive Studio <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="landing-button landing-button--secondary" onClick={onExploreMissions}>
            Explore Guided Missions (5 Scenarios) <ArrowDownRight size={16} aria-hidden="true" />
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
          aria-label={
            fused ? 'Fiber fused — opening the studio' : 'Press and hold to fuse the splice and open the studio'
          }
          aria-pressed={fused}
          title="Optional: hold to fuse the fibre and jump into the studio"
        >
          <span className="splice-fuse-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
          <span className="splice-fuse-content">
            {fused ? <Check size={15} aria-hidden="true" /> : <Radio size={15} aria-hidden="true" />}
            {fused ? 'FIBER FUSED' : progress > 0 ? 'KEEP HOLDING' : 'HOLD TO FUSE THE SPLICE'}
          </span>
        </button>
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>

        <div className="splice-live-readout" aria-label="Current studio simulation readout">
          <div className="splice-live-readout-label">
            <span className="splice-live-icon">
              <Radio size={16} aria-hidden="true" />
            </span>
            <span>
              <small>
                {simulationIsReference
                  ? 'REFERENCE 1:32 TREE'
                  : simulationStale
                    ? 'LAST COMMITTED RUN'
                    : 'LIVE STUDIO SIMULATION'}
              </small>
              <strong>Weakest home · receive power</strong>
            </span>
          </div>
          <div className="splice-live-value-wrap">
            <strong className="splice-live-value" aria-live="polite">
              {readingLabel}
            </strong>
            <span className={`splice-live-status ${readingStateClass}`}>
              <i aria-hidden="true" />
              {readingStatus}
            </span>
          </div>
          <p>
            {simulationIsReference
              ? 'Sample reading from the reference tree — the studio opens on an empty canvas.'
              : simulationStale
                ? 'Auto is off. Run a studio test to refresh the committed reading.'
                : 'Readouts come from the active React Flow network and optical simulator.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default SpliceIntroHero;
