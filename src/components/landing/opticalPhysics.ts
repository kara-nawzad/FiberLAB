/**
 * Small, presentation-only optical reference model for the landing exhibit.
 * The production simulator remains the authority for the editable GPON graph.
 */
import { ATTENUATION_DB_PER_KM, SPLITTER_LOSS_DB } from '../../types';

export const WAVEGUIDE_WAVELENGTHS = [1310, 1490, 1550] as const;
export type WaveguideWavelength = (typeof WAVEGUIDE_WAVELENGTHS)[number];

export interface WavelengthReference {
  wavelengthNm: WaveguideWavelength;
  direction: string;
  attenuationDbPerKm: number;
  color: string;
  shortLabel: string;
}

export const WAVELENGTH_REFERENCES: Record<WaveguideWavelength, WavelengthReference> = {
  1310: {
    wavelengthNm: 1310,
    direction: 'Upstream burst',
    attenuationDbPerKm: ATTENUATION_DB_PER_KM[1310],
    color: '#06B6D4',
    shortLabel: 'Upstream',
  },
  1490: {
    wavelengthNm: 1490,
    direction: 'Downstream GPON',
    attenuationDbPerKm: ATTENUATION_DB_PER_KM[1490],
    color: '#10B981',
    shortLabel: 'Downstream',
  },
  1550: {
    wavelengthNm: 1550,
    direction: 'Extended low-loss window',
    attenuationDbPerKm: 0.20,
    color: '#8B5CF6',
    shortLabel: 'Low-loss',
  },
};

export const CORE_DIAMETER_UM = 9;
export const CLADDING_DIAMETER_UM = 125;
export const COATING_DIAMETER_UM = 250;
export const PLC_1X4_INSERTION_LOSS_DB = SPLITTER_LOSS_DB[4];

const TARGET_REFERENCE_CRITICAL_ANGLE_DEG = 82;
const REFERENCE_WAVELENGTH_NM = 1490;

/** Malitson Sellmeier constants for fused silica; wavelength input is µm. */
export function fusedSilicaIndex(wavelengthNm: number): number {
  const lambdaUm = wavelengthNm / 1000;
  const lambdaSquared = lambdaUm * lambdaUm;
  const terms = [
    [0.6961663, 0.0684043 ** 2],
    [0.4079426, 0.1162414 ** 2],
    [0.8974794, 9.896161 ** 2],
  ] as const;
  const indexSquared = 1 + terms.reduce(
    (sum, [coefficient, resonanceSquared]) =>
      sum + (coefficient * lambdaSquared) / (lambdaSquared - resonanceSquared),
    0,
  );
  return Math.sqrt(indexSquared);
}

// A fixed reference core/cladding index step is calibrated to the brief's
// approximate 82° critical-angle annotation at 1490 nm. This is a schematic
// Ge-doped step, not a claim about a specific G.652 fiber's measured profile.
const REFERENCE_CLADDING_INDEX = fusedSilicaIndex(REFERENCE_WAVELENGTH_NM);
const REFERENCE_INDEX_STEP =
  REFERENCE_CLADDING_INDEX / Math.sin((TARGET_REFERENCE_CRITICAL_ANGLE_DEG * Math.PI) / 180) -
  REFERENCE_CLADDING_INDEX;

export interface WaveguideOptics {
  claddingIndex: number;
  coreIndex: number;
  criticalAngleDeg: number;
  axialRayAngleDeg: number;
}

/**
 * Computes the core/cladding critical angle from n_clad / n_core.
 * The axial ray angle is its complement because the critical angle is measured
 * from the interface normal. Both values change with the silica dispersion.
 */
export function getWaveguideOptics(wavelengthNm: WaveguideWavelength): WaveguideOptics {
  const claddingIndex = fusedSilicaIndex(wavelengthNm);
  const coreIndex = claddingIndex + REFERENCE_INDEX_STEP;
  const criticalAngleDeg =
    (Math.asin(claddingIndex / coreIndex) * 180) / Math.PI;
  return {
    claddingIndex,
    coreIndex,
    criticalAngleDeg,
    axialRayAngleDeg: 90 - criticalAngleDeg,
  };
}

/** dBm is absolute power; splitter insertion loss is a relative dB quantity. */
export function splitterBranchPowerDbm(
  launchPowerDbm: number,
  insertionLossDb = PLC_1X4_INSERTION_LOSS_DB,
): number {
  return launchPowerDbm - insertionLossDb;
}
