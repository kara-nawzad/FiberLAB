import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, Radio, Zap } from 'lucide-react';
import { OLT_CLASS_SPECS } from '../../types';
import {
  PLC_1X4_INSERTION_LOSS_DB,
  WAVELENGTH_REFERENCES,
  getWaveguideOptics,
  splitterBranchPowerDbm,
  type WaveguideWavelength,
} from '../../engine/opticalPhysics';
import { WaveguideCanvas } from './WaveguideCanvas';

interface PhotonicHeroProps {
  onLaunchStudio: () => void;
  onExploreMissions: () => void;
  onLoadPreset: (presetId: string) => void;
}

const WAVELENGTHS: WaveguideWavelength[] = [1310, 1490, 1550];
const OLT_C_PLUS_MIN_DBM = OLT_CLASS_SPECS['C+'].minTxDbm;

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

export function PhotonicHero({ onLaunchStudio, onExploreMissions, onLoadPreset }: PhotonicHeroProps) {
  const [launchPowerDbm, setLaunchPowerDbm] = useState(5.0);
  const [wavelengthNm, setWavelengthNm] = useState<WaveguideWavelength>(1490);
  const animatedPower = useCountedNumber(launchPowerDbm);
  const branchPowerDbm = splitterBranchPowerDbm(animatedPower);
  const wavelength = WAVELENGTH_REFERENCES[wavelengthNm];
  const waveguideOptics = getWaveguideOptics(wavelengthNm);

  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <div className="landing-hero-copy">
        <p className="landing-eyebrow">
          <span className="landing-eyebrow-dot" aria-hidden="true" />
          AUTONOMOUS OPTICAL ENGINEERING LAB · ITU-T G.984 GPON STANDARDS
        </p>
        <h2 id="landing-hero-title" className="landing-display-title">
          Shoot the laser. Split the spectrum.
          <em>Watch the photons decay.</em>
        </h2>
        <p className="landing-lede">
          A real-time, deterministic sandbox for Passive Optical Networks. Trace Class C+ launch power through cascaded
          PLC splitters and resolve downstream link budgets from explicit fiber, splice, connector, and safety-margin
          losses.
        </p>
        <p className="landing-scope-note">
          The waveguide angle and 1550 nm attenuation are educational references, not deployed-fiber specifications; the
          studio's base wavelengths are 1310/1490 nm, and the OPM can recalibrate its simulated path at 1550 nm. Field
          diagnostics add separate +3.50 dB macro-bend and +2.00 dB dirty-ferrule scenario penalties; these are not
          universal measurements.
        </p>
        <div className="landing-hero-actions">
          <button type="button" className="landing-button landing-button--primary" onClick={onLaunchStudio}>
            Launch Interactive Studio <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="landing-button landing-button--secondary" onClick={onExploreMissions}>
            Explore Guided Missions (5 Scenarios) <ArrowDownRight size={15} aria-hidden="true" />
          </button>
        </div>
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

      <div className="landing-exhibit-card" role="group" aria-label="Interactive photonic waveguide exhibit">
        <div className="landing-exhibit-topline">
          <div className="landing-exhibit-label">
            <span className="landing-exhibit-icon">
              <Radio size={14} aria-hidden="true" />
            </span>
            <span>
              <strong>LIVING WAVEGUIDE</strong>
              <small>Interactive optical bench · 1:4 PLC</small>
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
              <span>
                Optical Launch Power (
                <i>
                  P<sub>tx</sub>
                </i>
                )
              </span>
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
                {launchPowerDbm < OLT_C_PLUS_MIN_DBM ? 'Below Class C+ range' : 'Class C+ · +3 to +7 dBm'}
              </span>
              <span>+7.0 dBm</span>
            </div>
          </div>
          <fieldset className="landing-wavelength-fieldset">
            <legend>Wavelength · λ</legend>
            <div className="landing-wavelength-options">
              {WAVELENGTHS.map((value) => {
                const reference = WAVELENGTH_REFERENCES[value];
                const selected = value === wavelengthNm;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`landing-wavelength-chip${selected ? ' is-selected' : ''}`}
                    style={{ '--wavelength-color': reference.color } as React.CSSProperties}
                    aria-label={`${value} nm (${reference.shortLabel} - ${reference.attenuationDbPerKm.toFixed(2)} dB/km)`}
                    aria-pressed={selected}
                    onClick={() => setWavelengthNm(value)}
                  >
                    <span className="landing-spectrum-dot" aria-hidden="true" />
                    <span>
                      <strong>{value} nm</strong>
                      <small>{reference.attenuationDbPerKm.toFixed(2)} dB/km</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <WaveguideCanvas
          wavelengthNm={wavelengthNm}
          rayColor={wavelength.color}
          criticalAngleDeg={waveguideOptics.criticalAngleDeg}
          axialRayAngleDeg={waveguideOptics.axialRayAngleDeg}
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
