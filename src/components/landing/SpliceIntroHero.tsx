import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CircleHelp, Radio } from 'lucide-react';
import { formatDbm } from '../../engine/opticalSimulator';
import type { OntStatus, SimulationResult } from '../../types';
import spliceHeroScene from '../../assets/splice-hero-scene.svg?raw';

interface SpliceIntroHeroProps {
  simulation: SimulationResult | null;
  simulationStale: boolean;
  simulationIsReference?: boolean;
  onLaunchStudio: () => void;
}

const HOLD_DURATION_MS = 1350;
const OPEN_DELAY_MS = 520;

type ScheduledFrame = { id: number; kind: 'raf' | 'timeout' };

function scheduleFrame(callback: FrameRequestCallback): ScheduledFrame {
  if (typeof window.requestAnimationFrame === 'function') {
    return { id: window.requestAnimationFrame(callback), kind: 'raf' };
  }
  return {
    id: window.setTimeout(() => callback(performance.now()), 16),
    kind: 'timeout',
  };
}

const STATUS_LABELS: Record<OntStatus, string> = {
  ONLINE: 'ONLINE',
  WARNING: 'MARGINAL',
  LOS: 'LOSS OF SIGNAL',
  OVERLOAD: 'OVERLOAD',
  DISCONNECTED: 'DISCONNECTED',
};

export function SpliceIntroHero({
  simulation,
  simulationStale,
  simulationIsReference = false,
  onLaunchStudio,
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
          <span /> THE OPTICAL ACCESS NETWORK LAB
        </div>
        <h1 id="splice-hero-title">
          Splice the fiber.
          <br />
          <em>Light the home.</em>
        </h1>
        <p className="splice-hero-lede">
          Connect the exchange to the doorstep. Build a fiber access network, then watch the real link budget reveal
          where light reaches.
        </p>

        <button
          type="button"
          className={`splice-hold-button${fused ? ' is-complete' : ''}`}
          onPointerDown={(event) => {
            if (event.button > 0) return;
            event.preventDefault();
            begin();
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
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
          aria-label="Press and hold to splice the fiber and open the studio"
          aria-describedby="splice-hold-hint"
          aria-pressed={fused}
        >
          <span className="splice-hold-progress" style={{ transform: `scaleX(${progress})` }} />
          <span className="splice-hold-content">
            {fused ? <Check size={16} aria-hidden="true" /> : <Radio size={16} aria-hidden="true" />}
            {fused ? 'FIBER FUSED' : progress > 0 ? 'KEEP HOLDING TO FUSE' : 'PRESS AND HOLD TO SPLICE'}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </button>
        <p id="splice-hold-hint" className="splice-hold-hint">
          <CircleHelp size={14} aria-hidden="true" /> Hold for a moment · or{' '}
          <button type="button" onClick={onLaunchStudio}>
            open the studio now
          </button>
        </p>
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
              <strong>Receive power · best available ONT path</strong>
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

        <div className="splice-hero-footnote">
          <span>GPON · LIVE LINK BUDGET · DOWNSTREAM</span>
          <span>01 / 03</span>
        </div>
      </div>
    </section>
  );
}

export default SpliceIntroHero;
