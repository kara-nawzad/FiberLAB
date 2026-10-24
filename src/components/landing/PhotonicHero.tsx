import { useEffect, useRef, useState } from 'react';
import { Radio, Zap } from 'lucide-react';
import { OLT_CLASS_SPECS } from '../../types';
import {
  PLC_1X4_INSERTION_LOSS_DB,
  WAVELENGTH_REFERENCES,
  getWaveguideOptics,
  splitterBranchPowerDbm,
} from '../../engine/opticalPhysics';
import { WaveguideCanvas } from './WaveguideCanvas';

interface PhotonicHeroProps {
  onLoadPreset: (presetId: string) => void;
}

/* One wavelength, one slider: the demo shows the shape of the physics instead
 * of asking a newcomer to pick a window they do not know yet. */
const STAGE_WAVELENGTH = 1490;
const WAVELENGTH_REFERENCE = WAVELENGTH_REFERENCES[STAGE_WAVELENGTH];
const WAVEGUIDE_OPTICS = getWaveguideOptics(STAGE_WAVELENGTH);
const CLASS_C_PLUS = OLT_CLASS_SPECS['C+'];

const SCOPE_NOTE =
  'The waveguide angle and 1550 nm attenuation are educational references, not deployed-fiber specifications; the studio base wavelengths are 1310/1490 nm, and the OPM can recalibrate its simulated path at 1550 nm. Field diagnostics add separate +3.50 dB macro-bend and +2.00 dB dirty-ferrule scenario penalties — these are not universal measurements.';

function useCountedNumber(target: number, durationMs = 220): number {
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);

  useEffect(() => {
    const from = displayedRef.current;
    if (from === target) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion) {
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let frameId = 0;
    let timeoutId = 0;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      const progress = Math.min(1, Math.max(0, (now - startTime) / durationMs));
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (target - from) * eased;
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) schedule();
      else displayedRef.current = target;
    };
    const schedule = () => {
      if (typeof window.requestAnimationFrame === 'function') frameId = window.requestAnimationFrame(tick);
      else timeoutId = window.setTimeout(() => tick(Date.now()), 16);
    };
    schedule();
    return () => {
      cancelled = true;
      if (frameId && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frameId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [target, durationMs]);

  return displayed;
}

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`;
}

export function PhotonicHero({ onLoadPreset }: PhotonicHeroProps) {
  const [launchPowerDbm, setLaunchPowerDbm] = useState(5.0);
  const animatedPower = useCountedNumber(launchPowerDbm);
  const branchPowerDbm = splitterBranchPowerDbm(animatedPower);

  return (
    <section className="landing-hero" aria-labelledby="landing-demo-title">
      <div className="landing-hero-copy">
        <p className="landing-eyebrow">
          <span className="landing-eyebrow-dot" aria-hidden="true" />
          TRY IT · THIRTY SECONDS
        </p>
        <h2 id="landing-demo-title" className="landing-display-title">
          Drag the laser.
          <em>Watch the light fade.</em>
        </h2>
        <p className="landing-lede">
          Turn the power up and every home gets brighter — until the splitter and the glass take their share. One
          slider, one real link budget, the same maths the studio runs on your own network.
        </p>

        <dl className="landing-stage-facts">
          <div>
            <dt>Splitter 1:4</dt>
            <dd>−{PLC_1X4_INSERTION_LOSS_DB.toFixed(2)} dB</dd>
          </div>
          <div>
            <dt>Downstream {STAGE_WAVELENGTH} nm</dt>
            <dd>{WAVELENGTH_REFERENCE.attenuationDbPerKm.toFixed(2)} dB/km</dd>
          </div>
          <div>
            <dt>Class C+ window</dt>
            <dd>
              +{CLASS_C_PLUS.minTxDbm.toFixed(0)} → +{CLASS_C_PLUS.maxTxDbm.toFixed(0)} dBm
            </dd>
          </div>
        </dl>

        <div className="landing-quickload-row">
          <button type="button" className="landing-quickload" onClick={() => onLoadPreset('standard-1x32')}>
            <span className="landing-quickload-mark">
              <Zap size={14} aria-hidden="true" />
            </span>
            <span>Load Standard 1:32 GPON Tree</span>
            <span className="landing-quickload-arrow" aria-hidden="true">
              →
            </span>
          </button>
          <button type="button" className="landing-alt-quickload" onClick={() => onLoadPreset('failing-long-haul')}>
            Load Failing Link
          </button>
        </div>

        <details className="landing-scope">
          <summary>Model scope &amp; assumptions</summary>
          <p>{SCOPE_NOTE}</p>
        </details>
      </div>

      <div className="landing-exhibit-card" role="group" aria-label="Interactive laser power demo">
        <div className="landing-exhibit-topline">
          <div className="landing-exhibit-label">
            <span className="landing-exhibit-icon">
              <Radio size={14} aria-hidden="true" />
            </span>
            <span>
              <strong>ONE SLIDER</strong>
              <small>1:4 PLC · {STAGE_WAVELENGTH} nm downstream</small>
            </span>
          </div>
          <span className="landing-live-indicator">
            <span />
            LIVE MODEL
          </span>
        </div>

        <div className="landing-control-deck">
          <div className="landing-power-control">
            <label htmlFor="landing-launch-power">
              <span>Laser launch power</span>
              <strong className="landing-number">{signed(launchPowerDbm)} dBm</strong>
            </label>
            <input
              id="landing-launch-power"
              className="landing-power-slider"
              type="range"
              min={1}
              max={7}
              step={0.1}
              value={launchPowerDbm}
              aria-valuetext={`${signed(launchPowerDbm)} dBm`}
              onChange={(event) => setLaunchPowerDbm(Number(event.target.value))}
            />
            <div className="landing-range-notes">
              <span>+1.0 dBm</span>
              <span className="landing-class-range">
                {launchPowerDbm < CLASS_C_PLUS.minTxDbm ? 'Below Class C+ range' : 'Class C+ · +3 to +7 dBm'}
              </span>
              <span>+7.0 dBm</span>
            </div>
          </div>
        </div>

        <WaveguideCanvas
          wavelengthNm={STAGE_WAVELENGTH}
          rayColor={WAVELENGTH_REFERENCE.color}
          criticalAngleDeg={WAVEGUIDE_OPTICS.criticalAngleDeg}
          axialRayAngleDeg={WAVEGUIDE_OPTICS.axialRayAngleDeg}
          branchPowerDbm={branchPowerDbm}
        />

        <div className="landing-exhibit-equation" aria-live="polite" aria-atomic="true">
          <span>
            <i>
              P<sub>branch</sub>
            </i>{' '}
            ={' '}
            <i>
              P<sub>tx</sub>
            </i>{' '}
            − {PLC_1X4_INSERTION_LOSS_DB.toFixed(2)} dB
          </span>
          <strong className="landing-number">{signed(branchPowerDbm, 2)} dBm</strong>
          <small>per output · catalogue 1:4 PLC loss</small>
        </div>
      </div>
    </section>
  );
}

export default PhotonicHero;
