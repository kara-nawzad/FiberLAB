import { describe, expect, it } from 'vitest';
import {
  WAVELENGTH_REFERENCES,
  fusedSilicaIndex,
  getWaveguideOptics,
  splitterBranchPowerDbm,
} from '../opticalPhysics';

describe('landing photonic exhibit physics', () => {
  it('uses the documented wavelength attenuation references and Sellmeier dispersion order', () => {
    expect(WAVELENGTH_REFERENCES[1310].attenuationDbPerKm).toBe(0.35);
    expect(WAVELENGTH_REFERENCES[1490].attenuationDbPerKm).toBe(0.25);
    expect(WAVELENGTH_REFERENCES[1550].attenuationDbPerKm).toBe(0.2);
    expect(fusedSilicaIndex(1310)).toBeGreaterThan(fusedSilicaIndex(1490));
    expect(fusedSilicaIndex(1490)).toBeGreaterThan(fusedSilicaIndex(1550));
  });

  it('calibrates critical incidence at 82° for 1490 nm and conserves branch power units', () => {
    const reference = getWaveguideOptics(1490);
    expect(reference.criticalAngleDeg).toBeCloseTo(82, 6);
    expect(reference.criticalAngleDeg + reference.axialRayAngleDeg).toBeCloseTo(90, 10);
    expect(getWaveguideOptics(1310).criticalAngleDeg).not.toBe(reference.criticalAngleDeg);
    expect(splitterBranchPowerDbm(5)).toBeCloseTo(-2.2, 8);
  });
});
