import { useMemo } from 'react';
import {
  CLADDING_DIAMETER_UM,
  COATING_DIAMETER_UM,
  CORE_DIAMETER_UM,
  PLC_1X4_INSERTION_LOSS_DB,
  type WaveguideWavelength,
} from '../../engine/opticalPhysics';

interface WaveguideCanvasProps {
  wavelengthNm: WaveguideWavelength;
  rayColor: string;
  criticalAngleDeg: number;
  axialRayAngleDeg: number;
  branchPowerDbm: number;
}

function makeRayPath(
  startX: number,
  endX: number,
  topY: number,
  bottomY: number,
  axialAngleDeg: number,
): string {
  const slope = Math.tan((axialAngleDeg * Math.PI) / 180);
  const centerY = (topY + bottomY) / 2;
  const commands = [`M ${startX.toFixed(2)} ${centerY.toFixed(2)}`];
  let x = startX;
  let y = centerY;
  let direction = -1;

  while (x < endX) {
    const boundaryY = direction < 0 ? topY : bottomY;
    const runToBoundary = Math.abs(boundaryY - y) / slope;
    if (x + runToBoundary >= endX) {
      y += direction * slope * (endX - x);
      commands.push(`L ${endX.toFixed(2)} ${y.toFixed(2)}`);
      break;
    }
    x += runToBoundary;
    y = boundaryY;
    commands.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    direction *= -1;
  }
  return commands.join(' ');
}

function powerLabel(powerDbm: number): string {
  return `${powerDbm >= 0 ? '+' : ''}${powerDbm.toFixed(2)} dBm`;
}

const PORTS = [
  { port: '01', startY: 148, endY: 93 },
  { port: '02', startY: 164, endY: 151 },
  { port: '03', startY: 181, endY: 209 },
  { port: '04', startY: 197, endY: 267 },
] as const;

const MOBILE_PORTS = [
  { port: '01', startX: 132, endX: 84, endY: 357 },
  { port: '02', startX: 159, endX: 270, endY: 357 },
  { port: '03', startX: 201, endX: 84, endY: 455 },
  { port: '04', startX: 228, endX: 270, endY: 455 },
] as const;

function DesktopWaveguide({
  wavelengthNm,
  rayColor,
  criticalAngleDeg,
  axialRayAngleDeg,
  branchPowerDbm,
}: WaveguideCanvasProps) {
  const ray = useMemo(() => makeRayPath(40, 508, 158.3, 163.7, axialRayAngleDeg), [axialRayAngleDeg]);

  return (
    <svg
      className="landing-waveguide-svg landing-waveguide-svg--wide"
      viewBox="0 0 1000 330"
      role="img"
      aria-label={`Single-mode fiber ray tracing at ${wavelengthNm} nanometers, through a one-to-four PLC splitter. Each branch receives ${powerLabel(branchPowerDbm)}.`}
    >
      <defs>
        <pattern id="waveguide-grid-wide" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#eed8bf" strokeWidth="0.7" />
        </pattern>
        <linearGradient id="jacket-wide" x1="0" x2="1">
          <stop offset="0" stopColor="#fff4d6" />
          <stop offset="1" stopColor="#fff1c2" />
        </linearGradient>
        <filter id="ray-glow-wide" x="-20%" y="-80%" width="140%" height="260%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="1000" height="330" fill="url(#waveguide-grid-wide)" opacity="0.42" />
      <text x="26" y="28" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="11" letterSpacing="1.1">
        LONGITUDINAL WAVEGUIDE · SCHEMATIC, NOT TO SCALE
      </text>
      <text x="975" y="28" fill="#705443" textAnchor="end" fontFamily="ui-monospace, monospace" fontSize="11">
        λ {wavelengthNm} nm · θc {criticalAngleDeg.toFixed(3)}°
      </text>

      {/* Fiber jacket, cladding, and the 9 µm core are shown as nested layers. */}
      <rect x="24" y="84" width="492" height="154" rx="22" fill="url(#jacket-wide)" stroke="#d8bfa0" strokeWidth="1.2" />
      <rect x="24" y="122" width="492" height="78" rx="15" fill="#f4e8d8" stroke="#b18c72" strokeWidth="1" />
      <rect x="24" y="158.3" width="492" height="5.4" rx="2.7" fill={rayColor} opacity="0.24" />
      <path d={ray} fill="none" stroke={rayColor} strokeWidth="2" strokeLinejoin="round" filter="url(#ray-glow-wide)" />
      <path className="waveguide-ray-pulse" d={ray} fill="none" stroke="#fffaF2" strokeWidth="1.1" strokeLinecap="round" />
      <text x="42" y="104" fill="#713f12" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700">
        ACRYLATE COATING · {COATING_DIAMETER_UM} μm
      </text>
      <text x="42" y="145" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="10">
        SILICA CLADDING · {CLADDING_DIAMETER_UM} μm
      </text>
      <path d="M82 159H111" stroke={rayColor} strokeWidth="1.2" />
      <text x="118" y="177" fill="#2b1a14" fontFamily="ui-monospace, monospace" fontSize="10" fontWeight="700">
        Ge-doped core · {CORE_DIAMETER_UM} μm
      </text>
      <text x="42" y="222" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="9">
        INCIDENT ANGLE TO NORMAL · {criticalAngleDeg.toFixed(3)}°
      </text>
      <text x="42" y="254" fill="#85695a" fontFamily="ui-monospace, monospace" fontSize="9">
        Axial ray angle · {axialRayAngleDeg.toFixed(3)}°
      </text>

      {/* A magnified end-face inset keeps the actual diameter ratios explicit. */}
      <g transform="translate(88 292)">
        <circle r="22" fill="#fff1c2" stroke="#d8bfa0" strokeWidth="1.2" />
        <circle r="11" fill="#eed8bf" stroke="#b18c72" strokeWidth="1" />
        <circle r="1.1" fill={rayColor} />
        <path d="M24 -12H43" stroke="#85695a" strokeWidth="0.8" />
        <text x="48" y="-9" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="9">{COATING_DIAMETER_UM} μm coating</text>
        <path d="M12 8H43" stroke="#85695a" strokeWidth="0.8" />
        <text x="48" y="11" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="9">{CLADDING_DIAMETER_UM} μm cladding / {CORE_DIAMETER_UM} μm core</text>
      </g>

      {/* PLC cassette and its four measured output branches. */}
      <path d="M516 161H536" stroke={rayColor} strokeWidth="2.2" />
      <rect x="536" y="111" width="142" height="101" rx="12" fill="#fffaF2" stroke="#d8bfa0" strokeWidth="1.4" />
      <text x="607" y="133" textAnchor="middle" fill="#2b1a14" fontFamily="ui-monospace, monospace" fontSize="11" fontWeight="700">
        1:4 PLC
      </text>
      <path d="M558 160H579M579 160L604 145M579 160L604 156M579 160L604 168M579 160L604 179" fill="none" stroke="#85695a" strokeWidth="1.2" />
      <circle cx="579" cy="160" r="3" fill={rayColor} />
      <text x="607" y="198" textAnchor="middle" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="10">
        −{PLC_1X4_INSERTION_LOSS_DB.toFixed(2)} dB
      </text>
      <text x="607" y="226" textAnchor="middle" fill="#85695a" fontFamily="ui-monospace, monospace" fontSize="8.5">
        CATALOGUE INSERTION LOSS
      </text>

      {PORTS.map(({ port, startY, endY }) => {
        const path = `M 678 ${startY} C 735 ${startY}, 757 ${endY}, 818 ${endY}`;
        return (
          <g key={port}>
            <path d={path} fill="none" stroke={rayColor} strokeWidth="1.6" opacity="0.72" />
            <path className="waveguide-ray-pulse" d={path} fill="none" stroke="#fffaF2" strokeWidth="0.9" strokeLinecap="round" />
            <circle cx="678" cy={startY} r="2.5" fill={rayColor} />
            <rect x="823" y={endY - 19} width="157" height="38" rx="8" fill="#fffaF2" stroke="#d8bfa0" />
            <text x="835" y={endY - 4} fill="#85695a" fontFamily="ui-monospace, monospace" fontSize="8.5">
              PIGTAIL {port}
            </text>
            <text x="835" y={endY + 10} fill="#2b1a14" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700">
              {powerLabel(branchPowerDbm)}
            </text>
          </g>
        );
      })}
      <text x="823" y="313" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="9">
        Pbranch = Ptx − {PLC_1X4_INSERTION_LOSS_DB.toFixed(2)} dB
      </text>
      <text x="980" y="313" textAnchor="end" fill="#85695a" fontFamily="ui-monospace, monospace" fontSize="8">
        dBm = absolute power · dB = insertion loss
      </text>
    </svg>
  );
}

function MobileWaveguide({
  wavelengthNm,
  rayColor,
  criticalAngleDeg,
  axialRayAngleDeg,
  branchPowerDbm,
}: WaveguideCanvasProps) {
  const ray = useMemo(() => makeRayPath(25, 335, 92.8, 96.2, axialRayAngleDeg), [axialRayAngleDeg]);

  return (
    <svg
      className="landing-waveguide-svg landing-waveguide-svg--compact"
      viewBox="0 0 360 590"
      role="img"
      aria-label={`Single-mode fiber ray tracing at ${wavelengthNm} nanometers, through a one-to-four PLC splitter. Each branch receives ${powerLabel(branchPowerDbm)}.`}
    >
      <defs>
        <pattern id="waveguide-grid-mobile" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" fill="none" stroke="#eed8bf" strokeWidth="0.6" />
        </pattern>
        <filter id="ray-glow-mobile" x="-20%" y="-80%" width="140%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="360" height="590" fill="url(#waveguide-grid-mobile)" opacity="0.38" />
      <text x="18" y="24" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="9" letterSpacing="0.5">
        WAVEGUIDE · {wavelengthNm} nm · θc {criticalAngleDeg.toFixed(3)}°
      </text>
      <rect x="16" y="42" width="328" height="111" rx="18" fill="#fff4d6" stroke="#d8bfa0" />
      <rect x="16" y="70" width="328" height="56" rx="12" fill="#f4e8d8" stroke="#b18c72" />
      <rect x="16" y="92.8" width="328" height="3.4" rx="1.7" fill={rayColor} opacity="0.26" />
      <path d={ray} fill="none" stroke={rayColor} strokeWidth="1.8" filter="url(#ray-glow-mobile)" />
      <path className="waveguide-ray-pulse" d={ray} fill="none" stroke="#fffaF2" strokeWidth="0.8" strokeLinecap="round" />
      <text x="27" y="61" fill="#713f12" fontFamily="ui-monospace, monospace" fontSize="8.5" fontWeight="700">
        COATING {COATING_DIAMETER_UM} μm · CLADDING {CLADDING_DIAMETER_UM} μm · CORE {CORE_DIAMETER_UM} μm
      </text>
      <text x="27" y="142" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="8">
        AXIAL RAY {axialRayAngleDeg.toFixed(3)}° · TIR AT CORE BOUNDARY
      </text>

      {/* Optical trunk bends from the longitudinal guide into the PLC cassette. */}
      <path d="M 335 95 C 351 119, 330 168, 247 210" fill="none" stroke={rayColor} strokeWidth="1.8" />
      <path className="waveguide-ray-pulse" d="M 335 95 C 351 119, 330 168, 247 210" fill="none" stroke="#fffaF2" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="116" y="178" width="128" height="91" rx="12" fill="#fffaF2" stroke="#d8bfa0" strokeWidth="1.3" />
      <text x="180" y="200" textAnchor="middle" fill="#2b1a14" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700">1:4 PLC</text>
      <path d="M139 222H159M159 222L181 211M159 222L181 218M159 222L181 226M159 222L181 233" fill="none" stroke="#85695a" strokeWidth="1.3" />
      <circle cx="159" cy="222" r="3" fill={rayColor} />
      <text x="180" y="252" textAnchor="middle" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="10">
        −{PLC_1X4_INSERTION_LOSS_DB.toFixed(2)} dB
      </text>

      {MOBILE_PORTS.map(({ port, startX, endX, endY }, index) => {
        const startY = 269;
        const path = `M ${startX} ${startY} C ${startX} ${startY + 28}, ${endX} ${endY - 30}, ${endX} ${endY - 16}`;
        const x = index % 2 === 0 ? 14 : 186;
        const y = index < 2 ? 335 : 433;
        return (
          <g key={port}>
            <path d={path} fill="none" stroke={rayColor} strokeWidth="1.6" opacity="0.72" />
            <path className="waveguide-ray-pulse" d={path} fill="none" stroke="#fffaF2" strokeWidth="0.8" strokeLinecap="round" />
            <rect x={x} y={y} width="160" height="58" rx="9" fill="#fffaF2" stroke="#d8bfa0" />
            <text x={x + 11} y={y + 20} fill="#85695a" fontFamily="ui-monospace, monospace" fontSize="9">PIGTAIL {port}</text>
            <text x={x + 11} y={y + 41} fill="#2b1a14" fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700">{powerLabel(branchPowerDbm)}</text>
          </g>
        );
      })}
      <g transform="translate(42 540)">
        <circle r="17" fill="#fff1c2" stroke="#d8bfa0" />
        <circle r="8.5" fill="#eed8bf" stroke="#b18c72" />
        <circle r="0.7" fill={rayColor} />
        <text x="26" y="-3" fill="#705443" fontFamily="ui-monospace, monospace" fontSize="9">END-FACE · {COATING_DIAMETER_UM} / {CLADDING_DIAMETER_UM} / {CORE_DIAMETER_UM} μm</text>
        <text x="26" y="12" fill="#85695a" fontFamily="ui-monospace, monospace" fontSize="8">Magnified for legibility</text>
      </g>
      <text x="346" y="574" textAnchor="end" fill="#85695a" fontFamily="ui-monospace, monospace" fontSize="8">
        Pbranch = Ptx − {PLC_1X4_INSERTION_LOSS_DB.toFixed(2)} dB
      </text>
    </svg>
  );
}

export function WaveguideCanvas(props: WaveguideCanvasProps) {
  return (
    <figure className="landing-waveguide-figure" aria-label="Interactive photonic waveguide">
      <DesktopWaveguide {...props} />
      <MobileWaveguide {...props} />
      <figcaption className="landing-waveguide-caption">
        Each ray reflects at the core–cladding interface in an educational schematic. Its illustrative index step is calibrated to the brief’s approximate 82° reference at 1490 nm; that is a modeling assumption, not a measured fiber profile or a guaranteed deployed-fiber angle. The small Sellmeier dispersion shift is shown numerically rather than exaggerated in the drawing.
      </figcaption>
    </figure>
  );
}

export default WaveguideCanvas;
