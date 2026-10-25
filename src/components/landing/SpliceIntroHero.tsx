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

/*
 * The fusion is the first act of the page: hold the splice, watch the light
 * cross the joint, and only then do the two studio doors appear. Nothing
 * navigates on its own — the hold hands the student a choice instead of taking
 * one away. The navigation bar, the capability cards and the footer keep their
 * own one-click doors, so the hold is a ritual, never a wall.
 */
const HOLD_DURATION_MS = 1100;

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
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  /* "Weakest home" means the lowest receive power across every subscriber —
   * ONTs and Wi-Fi gateways alike — so a gateway-only network still reports. */
  const reading = useMemo(() => {
    if (!simulation) return null;
    const subscribers = [...Object.values(simulation.ontTelemetry), ...Object.values(simulation.gatewayTelemetry)];
    const measured = subscribers.filter((value) => value.rxPowerDbm !== null);
    if (measured.length === 0) return subscribers[0] ?? null;
    return measured.reduce((weakest, value) =>
      (value.rxPowerDbm as number) < (weakest.rxPowerDbm as number) ? value : weakest,
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
        setProgress(1);
        setFused(true);
        setAnnouncement('Splice fused. Launch the studio or explore the guided missions.');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(18);
        frameRef.current = null;
        return;
      }
      frameRef.current = scheduleFrame(advance);
    };

    frameRef.current = scheduleFrame(advance);
  }, []);

  useEffect(() => () => cancelFrame(), [cancelFrame]);

  /* The control the student was holding disappears when the splice lands, so
   * hand the keyboard to the primary door instead of dropping focus back to the
   * top of the document. */
  useEffect(() => {
    if (!fused) return;
    const timer = window.setTimeout(() => primaryActionRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, [fused]);

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
          Draw a fiber-to-the-home network and watch the light budget decide which homes come online.
        </p>

        {fused ? (
          <div className="splice-hero-actions is-revealed" role="group" aria-label="Studio doors">
            <button
              ref={primaryActionRef}
              type="button"
              className="landing-button landing-button--primary"
              onClick={onLaunchStudio}
            >
              Launch Interactive Studio <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="landing-button landing-button--secondary" onClick={onExploreMissions}>
              Explore Guided Missions (5 Scenarios) <ArrowDownRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {fused ? null : (
          <button
            type="button"
            className="splice-fuse"
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
            aria-label="Press and hold to fuse the splice and unlock the studio"
            title="Hold to fuse the fibre; the studio doors appear when the splice is live"
          >
            <span className="splice-fuse-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
            <span className="splice-fuse-content">
              <Radio size={15} aria-hidden="true" />
              {progress > 0 ? 'KEEP HOLDING' : 'HOLD TO FUSE THE SPLICE'}
            </span>
          </button>
        )}
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>

        {/* One compact strip: source, what is measured, the number and its
            status. The longer explanation stays for screen readers only, so the
            hero keeps a single quiet line here instead of a card. */}
        <div className="splice-live-readout" aria-label="Current studio simulation readout">
          <span className="splice-live-icon" aria-hidden="true">
            <Radio size={14} />
          </span>
          <span className="splice-live-meta">
            <small className="splice-live-eyebrow">
              {simulationIsReference
                ? 'REFERENCE 1:32 TREE'
                : simulationStale
                  ? 'LAST COMMITTED RUN'
                  : 'LIVE SIMULATION'}
            </small>
            <strong className="splice-live-label">Weakest home</strong>
          </span>
          <span className="splice-live-value-wrap">
            <strong className="splice-live-value" aria-live="polite">
              {readingLabel}
            </strong>
            <span className={`splice-live-status ${readingStateClass}`}>
              <i aria-hidden="true" />
              {readingStatus}
            </span>
          </span>
          {fused ? (
            <span className="splice-fused-seal" role="status">
              <Check size={12} aria-hidden="true" /> FUSED!
            </span>
          ) : null}
          <span className="sr-only">
            {simulationIsReference
              ? 'Sample reading from the reference tree — the studio opens on an empty canvas.'
              : simulationStale
                ? 'Auto is off. Run a studio test to refresh the committed reading.'
                : 'Readouts come from the active React Flow network and optical simulator.'}
          </span>
        </div>
      </div>
    </section>
  );
}

export default SpliceIntroHero;
