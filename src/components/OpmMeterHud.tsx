import { forwardRef, useMemo, useState } from 'react';
import { BatteryFull, Crosshair, X } from 'lucide-react';
import type { MeterWavelength } from '../types';
import type { OpticalProbeTarget } from '../engine/opticalProbe';

const WAVELENGTHS: MeterWavelength[] = [1310, 1490, 1550];

interface OpmMeterHudProps {
  target: OpticalProbeTarget;
  position: { x: number; y: number };
  readingDbm: number | null;
  wavelength: MeterWavelength;
  onWavelengthChange: (value: MeterWavelength) => void;
  onClose: () => void;
}

function targetLabel(target: OpticalProbeTarget): string {
  if (target.kind === 'edge') return `PATCH CORD · ${target.id}`;
  if (target.handleType === 'target') return `INPUT PORT · ${target.id}`;
  if (target.handleType === 'source') return `OUTPUT PORT · ${target.id}`;
  return `COMPONENT · ${target.id}`;
}

export const OpmMeterHud = forwardRef<HTMLElement, OpmMeterHudProps>(function OpmMeterHud(
  { target, position, readingDbm, wavelength, onWavelengthChange, onClose },
  ref,
) {
  const [referenceDbm, setReferenceDbm] = useState<number | null>(null);
  const [relativeMode, setRelativeMode] = useState(false);
  const inRange = readingDbm !== null && readingDbm >= -60;
  const display = useMemo(() => {
    if (!inRange || readingDbm === null) return readingDbm === null ? 'LO' : 'UNDER';
    if (relativeMode && referenceDbm !== null) {
      const delta = readingDbm - referenceDbm;
      return `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
    }
    return `${readingDbm >= 0 ? '+' : ''}${readingDbm.toFixed(2)}`;
  }, [inRange, readingDbm, referenceDbm, relativeMode]);

  const toggleReference = () => {
    if (relativeMode) {
      setRelativeMode(false);
      setReferenceDbm(null);
      return;
    }
    if (!inRange || readingDbm === null) return;
    setReferenceDbm(readingDbm);
    setRelativeMode(true);
  };

  /* No light, or a reading outside the meter's usable window, must not look
   * like a healthy green measurement. */
  const backlight = !inRange || readingDbm === null ? 'off' : readingDbm < -28 || readingDbm > -8 ? 'amber' : 'green';

  return (
    <section
      ref={ref}
      className={`opm-meter-hud opm-meter-hud--${backlight}`}
      role="region"
      aria-label="Optical Power Meter"
      data-testid="opm-meter-hud"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="opm-meter-header">
        <span className="opm-meter-brand">
          <Crosshair size={14} aria-hidden="true" /> FIELD OPM
        </span>
        <span className="opm-meter-battery" aria-hidden="true">
          <BatteryFull size={16} aria-hidden="true" />
        </span>
        <button type="button" className="opm-meter-close" aria-label="Close OPM" onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      <div className="opm-meter-reading-wrap">
        <div className="opm-meter-target" title={targetLabel(target)}>
          {targetLabel(target)}
        </div>
        <output className="opm-meter-reading" aria-label="Optical power reading" aria-live="polite">
          {display}
          <span className="opm-meter-unit">
            {display === 'LO' || display === 'UNDER' ? '' : relativeMode ? ' dB' : ' dBm'}
          </span>
        </output>
        <div className="opm-meter-state">
          <span className="opm-meter-led" aria-hidden="true" />
          {readingDbm === null
            ? 'NO LIGHT DETECTED'
            : readingDbm < -60
              ? 'BELOW METER RANGE'
              : relativeMode
                ? 'REFERENCE DELTA'
                : `SIMULATED PATH @ ${wavelength} nm`}
        </div>
      </div>

      <div className="opm-meter-wavelengths" role="group" aria-label="Meter calibration wavelength">
        {WAVELENGTHS.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`Use OPM wavelength ${value} nm`}
            aria-pressed={wavelength === value}
            className={wavelength === value ? 'is-active' : ''}
            onClick={() => onWavelengthChange(value)}
          >
            {value}
          </button>
        ))}
        <span>nm</span>
      </div>

      <footer className="opm-meter-footer">
        <button
          type="button"
          className={`opm-meter-ref ${relativeMode ? 'is-active' : ''}`}
          onClick={toggleReference}
          disabled={!inRange && !relativeMode}
          aria-pressed={relativeMode}
          title={
            relativeMode ? 'Clear reference and return to absolute dBm' : 'Store this reading as the 0 dB reference'
          }
        >
          REF
        </button>
        <span>{relativeMode && referenceDbm !== null ? `REF ${referenceDbm.toFixed(2)} dBm` : 'CAL · SIMULATOR'}</span>
        <button type="button" className="opm-meter-close-text" onClick={onClose}>
          Close OPM
        </button>
      </footer>
    </section>
  );
});
