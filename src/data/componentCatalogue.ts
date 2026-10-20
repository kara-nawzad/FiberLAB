/*
 * Static, framework-independent reference data for the hardware shown in the
 * studio. Illustrations are authored as SVG strings, encoded as data URIs, and
 * deliberately kept separate from the optical calculation model.
 */

export type HardwareKind = 'olt' | 'splitter' | 'fiber' | 'closure' | 'ont' | 'odf' | 'nap' | 'gateway';

export interface HardwareProfile {
  id: string;
  kind: HardwareKind;
  modelName: string;
  vendorCategory: string;
  /** Compact representative SVG, ready to use as an <img src>. */
  thumbnailSvg: string;
  /** Detailed representative SVG, ready to use as an <img src>. */
  heroSvg: string;
  /** Interfaces for equipment; physical construction details for cable profiles. */
  physicalPorts: string[];
  /** Practical, field-oriented reminders. */
  fieldNotes: string[];
  /** Generic reference context only; exact values must come from the selected SKU. */
  datasheetSnippet: {
    operatingTemp: string;
    wavelengths: string;
    standards: string[];
  };
  /** Short learner-facing explanation of what the hardware does. */
  description: string;
}

const toDataUri = (markup: string): string =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup.replace(/>\s+</g, '><').trim())}`;

function heroFrame(title: string, artwork: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" role="img">
    <defs>
      <linearGradient id="case" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#53647b"/><stop offset="1" stop-color="#202b3d"/>
      </linearGradient>
      <linearGradient id="darkCase" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#34445a"/><stop offset="1" stop-color="#111a29"/>
      </linearGradient>
      <linearGradient id="whiteCase" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#b9c5d3"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000814" flood-opacity=".62"/>
      </filter>
      <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="#1b2a3e" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="480" height="270" rx="18" fill="#0b1220"/>
    <rect width="480" height="270" rx="18" fill="url(#grid)" opacity=".56"/>
    <path d="M0 43H480" stroke="#26364b"/>
    <text x="22" y="29" fill="#7dd3fc" font-family="ui-monospace,monospace" font-size="11" letter-spacing="1.8">FIBERLAB FIELD REFERENCE</text>
    <text x="458" y="29" text-anchor="end" fill="#71839c" font-family="ui-monospace,monospace" font-size="10">${title}</text>
    ${artwork}
    <text x="22" y="251" fill="#7e8da4" font-family="ui-monospace,monospace" font-size="9" letter-spacing="1">REPRESENTATIVE ILLUSTRATION · NOT A SPECIFIC SKU</text>
  </svg>`;
}

const thumbnailFrame = (artwork: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64" role="img">
    <defs><linearGradient id="thumbCase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#40526b"/><stop offset="1" stop-color="#152033"/></linearGradient></defs>
    <rect width="96" height="64" rx="10" fill="#f1f5f9"/>
    <path d="M8 53H88" stroke="#cbd5e1"/>
    ${artwork}
  </svg>`;

const coreColors = [
  '#60a5fa',
  '#f97316',
  '#22c55e',
  '#a855f7',
  '#facc15',
  '#e5e7eb',
  '#8b5e3c',
  '#f472b6',
  '#64748b',
  '#be123c',
  '#14b8a6',
  '#cbd5e1',
];

const oltCages = Array.from({ length: 16 }, (_, index) => {
  const column = index % 8;
  const row = Math.floor(index / 8);
  const x = 137 + column * 24;
  const y = 108 + row * 25;
  return `<g><rect x="${x}" y="${y}" width="19" height="17" rx="2" fill="#09111c" stroke="#76879b" stroke-width="1.2"/><rect x="${x + 4}" y="${y + 4}" width="11" height="7" rx="1" fill="#152b3c"/><circle cx="${x + 9.5}" cy="${y + 14}" r="1.5" fill="#22d383"/></g>`;
}).join('');

const oltFanSlots = Array.from({ length: 8 }, (_, index) => {
  const y = 119 + index * 7;
  return `<path d="M58 ${y}H97" stroke="#8794a5" stroke-width="2" opacity=".62"/>`;
}).join('');

const splitterOutputs = Array.from({ length: 8 }, (_, index) => {
  const y = 88 + index * 16;
  const color = coreColors[index];
  return `<path d="M344 130C380 130 373 ${y} 420 ${y}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/><circle cx="420" cy="${y}" r="4" fill="${color}" stroke="#d7e1ee" stroke-width="1"/>`;
}).join('');

const feederCoreDiagram = Array.from({ length: 6 }, (_, tubeIndex) => {
  const angle = (Math.PI * 2 * tubeIndex) / 6 - Math.PI / 2;
  const cx = 122 + Math.cos(angle) * 39;
  const cy = 143 + Math.sin(angle) * 39;
  const cores = Array.from({ length: 8 }, (_, coreIndex) => {
    const coreAngle = (Math.PI * 2 * coreIndex) / 8;
    const x = cx + Math.cos(coreAngle) * 8;
    const y = cy + Math.sin(coreAngle) * 8;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${coreColors[(tubeIndex * 8 + coreIndex) % coreColors.length]}" stroke="#0b1220" stroke-width=".7"/>`;
  }).join('');
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="15" fill="#17273a" stroke="#8aa0b8" stroke-width="1.2"/>${cores}`;
}).join('');

const feederTubeBundle = Array.from({ length: 6 }, (_, index) => {
  const x = 286 + (index % 3) * 34;
  const y = 106 + Math.floor(index / 3) * 37;
  const color = ['#38bdf8', '#f59e0b', '#34d399', '#a78bfa', '#fb7185', '#facc15'][index];
  return `<g><rect x="${x}" y="${y}" width="28" height="27" rx="9" fill="#1a2c41" stroke="#a9b9ca" stroke-width="1.2"/><path d="M${x + 5} ${y + 8}h18M${x + 5} ${y + 14}h18M${x + 5} ${y + 20}h18" stroke="${color}" stroke-width="2" opacity=".9"/></g>`;
}).join('');

const distributionCores = Array.from({ length: 12 }, (_, index) => {
  const x = 287 + (index % 4) * 12;
  const y = 135 + Math.floor(index / 4) * 12;
  return `<circle cx="${x}" cy="${y}" r="3.4" fill="${coreColors[index]}" stroke="#0b1220" stroke-width="1"/>`;
}).join('');

const dropCores = Array.from({ length: 2 }, (_, index) => {
  const x = 231 + index * 35;
  return `<circle cx="${x}" cy="144" r="7" fill="#f8fafc" stroke="#16a34a" stroke-width="3"/><circle cx="${x}" cy="144" r="2.5" fill="#60a5fa"/>`;
}).join('');

const oltHero = heroFrame(
  'OLT · FRONT PANEL',
  `
  <g filter="url(#shadow)">
    <rect x="35" y="77" width="410" height="126" rx="9" fill="url(#darkCase)" stroke="#92a2b5" stroke-width="1.5"/>
    <rect x="43" y="84" width="394" height="17" rx="4" fill="#182537"/>
    <circle cx="54" cy="92" r="2" fill="#22d383"/><text x="64" y="96" fill="#a7b6c8" font-family="ui-monospace,monospace" font-size="8">PON ACCESS · 1U</text>
    <rect x="50" y="108" width="54" height="76" rx="4" fill="#0b1421" stroke="#718196"/>
    ${oltFanSlots}
    <text x="77" y="197" text-anchor="middle" fill="#8ea0b5" font-family="ui-monospace,monospace" font-size="8">FAN TRAY</text>
    <text x="137" y="104" fill="#aab8c8" font-family="ui-monospace,monospace" font-size="8">GPON SFP CAGES · 16</text>
    ${oltCages}
    <rect x="337" y="108" width="91" height="76" rx="4" fill="#101a29" stroke="#718196"/>
    <text x="382" y="120" text-anchor="middle" fill="#9dafc2" font-family="ui-monospace,monospace" font-size="7">UPLINK</text>
    ${Array.from({ length: 4 }, (_, index) => `<g><rect x="347" y="${127 + index * 12}" width="30" height="8" rx="1.5" fill="#07101b" stroke="#8291a4"/><circle cx="383" cy="${131 + index * 12}" r="1.4" fill="#38bdf8"/></g>`).join('')}
    <rect x="393" y="130" width="26" height="16" rx="2" fill="#070e17" stroke="#65778e"/>
    <text x="406" y="141" text-anchor="middle" fill="#94a3b8" font-family="ui-monospace,monospace" font-size="6">MGMT</text>
    <rect x="393" y="151" width="26" height="16" rx="2" fill="#070e17" stroke="#65778e"/>
    <text x="406" y="162" text-anchor="middle" fill="#94a3b8" font-family="ui-monospace,monospace" font-size="6">CON</text>
    <path d="M43 190H437" stroke="#718196" opacity=".6"/>
    <text x="241" y="198" text-anchor="middle" fill="#73869e" font-family="ui-monospace,monospace" font-size="7">STATUS · ALARM · POWER</text>
  </g>
  <path d="M75 215V226H124" fill="none" stroke="#38bdf8" stroke-width="1.5"/><text x="130" y="229" fill="#a8bfd3" font-family="ui-monospace,monospace" font-size="9">Fan trays</text>
  <path d="M222 215V226H273" fill="none" stroke="#38bdf8" stroke-width="1.5"/><text x="279" y="229" fill="#a8bfd3" font-family="ui-monospace,monospace" font-size="9">Optical access slots</text>
`,
);

const splitterHero = heroFrame(
  'PLC SPLITTER · CASSETTE',
  `
  <g filter="url(#shadow)">
    <path d="M31 135C72 135 82 135 121 135" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
    <path d="M32 130C70 130 82 130 121 130" fill="none" stroke="#bde8ff" stroke-width="1" opacity=".7"/>
    <rect x="42" y="119" width="24" height="31" rx="5" fill="#31455d" stroke="#91a2b8"/>
    <rect x="117" y="78" width="229" height="120" rx="18" fill="url(#case)" stroke="#c4d0dc" stroke-width="2"/>
    <rect x="128" y="88" width="207" height="99" rx="12" fill="#26354a" stroke="#71849b"/>
    <path d="M139 104H324" stroke="#71849b"/>
    <text x="231" y="101" text-anchor="middle" fill="#dce7f2" font-family="ui-monospace,monospace" font-size="10" letter-spacing="1">PLC OPTICAL SPLITTER</text>
    <rect x="174" y="116" width="115" height="48" rx="9" fill="#111c2a" stroke="#8ea0b4"/>
    <text x="231" y="137" text-anchor="middle" fill="#e2e8f0" font-family="ui-monospace,monospace" font-size="16" font-weight="700">1 : N</text>
    <text x="231" y="153" text-anchor="middle" fill="#91a5ba" font-family="ui-monospace,monospace" font-size="8">SEALED ABS CASSETTE</text>
    ${splitterOutputs}
    <text x="76" y="115" text-anchor="middle" fill="#a7c7df" font-family="ui-monospace,monospace" font-size="8">INPUT</text>
    <text x="420" y="222" text-anchor="end" fill="#a7c7df" font-family="ui-monospace,monospace" font-size="8">OUTPUT PIGTAILS · RATIO DEPENDENT</text>
    <path d="M115 197V215H163" fill="none" stroke="#94a3b8" stroke-width="1.4"/><text x="169" y="218" fill="#a8bfd3" font-family="ui-monospace,monospace" font-size="9">Strain-relieved cable glands</text>
  </g>
`,
);

const feederHero = heroFrame(
  'FEEDER · LOOSE TUBE 48F',
  `
  <g filter="url(#shadow)">
    <circle cx="122" cy="143" r="75" fill="#131d2b" stroke="#bec9d5" stroke-width="3"/>
    <circle cx="122" cy="143" r="65" fill="#26364a" stroke="#60758d" stroke-width="2"/>
    ${feederCoreDiagram}
    <circle cx="122" cy="143" r="12" fill="#f59e0b" stroke="#ffe5a3" stroke-width="2"/>
    <text x="122" y="146" text-anchor="middle" fill="#1b2430" font-family="ui-monospace,monospace" font-size="6" font-weight="700">FRP</text>
    <text x="122" y="228" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">CROSS-SECTION · 6 × 8 CORES</text>
    <path d="M213 142H250" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 4"/>
    <rect x="251" y="87" width="194" height="116" rx="47" fill="#1b2635" stroke="#c0cbd6" stroke-width="2.5"/>
    <rect x="265" y="101" width="168" height="88" rx="38" fill="#111a27" stroke="#53677f" stroke-width="1.5"/>
    ${feederTubeBundle}
    <circle cx="349" cy="157" r="8" fill="#f59e0b" stroke="#ffdc8c" stroke-width="1.5"/>
    <path d="M255 77L291 61" stroke="#7dd3fc" stroke-width="1.4"/><text x="296" y="61" fill="#bdd0e2" font-family="ui-monospace,monospace" font-size="8">Water-blocked loose tubes</text>
    <path d="M350 168L382 213" stroke="#7dd3fc" stroke-width="1.4"/><text x="386" y="220" fill="#bdd0e2" font-family="ui-monospace,monospace" font-size="8">Strength member</text>
    <text x="348" y="229" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">MICRO-DUCT CABLE CUTAWAY</text>
  </g>
`,
);

const distHero = heroFrame(
  'DISTRIBUTION · AERIAL 12F',
  `
  <g filter="url(#shadow)">
    <circle cx="130" cy="137" r="51" fill="#111a27" stroke="#c1ccd8" stroke-width="4"/>
    <circle cx="130" cy="137" r="41" fill="#27384d" stroke="#64788f" stroke-width="2"/>
    <circle cx="130" cy="78" r="29" fill="#141e2b" stroke="#c1ccd8" stroke-width="4"/>
    <circle cx="130" cy="78" r="16" fill="#667487" stroke="#dce5ee" stroke-width="2"/>
    <circle cx="130" cy="78" r="7" fill="#303b4c"/>
    <path d="M130 107V86" stroke="#c1ccd8" stroke-width="13"/>
    <path d="M130 107V86" stroke="#35465a" stroke-width="5"/>
    <circle cx="116" cy="131" r="10" fill="#17283b" stroke="#98aabd"/>
    <circle cx="143" cy="131" r="10" fill="#17283b" stroke="#98aabd"/>
    <circle cx="130" cy="155" r="10" fill="#17283b" stroke="#98aabd"/>
    ${distributionCores}
    <path d="M54 198H206" stroke="#38bdf8" stroke-width="1.4"/><text x="130" y="218" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">FIGURE-8 CROSS-SECTION</text>
    <path d="M229 137H257" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="M257 104C257 90 277 83 293 83H423C440 83 449 95 449 110V164C449 180 437 190 421 190H293C277 190 257 181 257 167Z" fill="#1a2636" stroke="#bec9d5" stroke-width="3"/>
    <path d="M274 137H433" stroke="#3e526b" stroke-width="2"/>
    <path d="M284 121C302 105 316 107 330 121M284 153C302 169 316 167 330 153" fill="none" stroke="#60a5fa" stroke-width="3"/>
    <path d="M334 121C352 105 366 107 380 121M334 153C352 169 366 167 380 153" fill="none" stroke="#f59e0b" stroke-width="3"/>
    <path d="M384 121C402 105 416 107 430 121M384 153C402 169 416 167 430 153" fill="none" stroke="#34d399" stroke-width="3"/>
    <text x="352" y="218" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">12-FIBER OPTICAL UNIT + MESSENGER</text>
    <path d="M130 49V55" stroke="#fbbf24" stroke-width="1.4"/><text x="130" y="52" text-anchor="middle" fill="#fde68a" font-family="ui-monospace,monospace" font-size="8">MESSENGER</text>
  </g>
`,
);

const dropHero = heroFrame(
  'DROP · FLAT 2F + FRP',
  `
  <g filter="url(#shadow)">
    <rect x="74" y="92" width="332" height="108" rx="48" fill="#171f2b" stroke="#c7d0d9" stroke-width="3"/>
    <rect x="88" y="106" width="304" height="80" rx="37" fill="#202d3d" stroke="#71849b" stroke-width="1.5"/>
    <path d="M110 111V181M370 111V181" stroke="#6c7d90" stroke-width="1" stroke-dasharray="3 4"/>
    <circle cx="137" cy="146" r="18" fill="#d5dbe2" stroke="#f8fafc" stroke-width="3"/>
    <text x="137" y="149" text-anchor="middle" fill="#334155" font-family="ui-monospace,monospace" font-size="7" font-weight="700">FRP</text>
    <circle cx="343" cy="146" r="18" fill="#d5dbe2" stroke="#f8fafc" stroke-width="3"/>
    <text x="343" y="149" text-anchor="middle" fill="#334155" font-family="ui-monospace,monospace" font-size="7" font-weight="700">FRP</text>
    ${dropCores}
    <text x="248" y="219" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="10">2 SINGLE-MODE FIBERS · FLAT JACKET</text>
    <path d="M137 127V75H81" fill="none" stroke="#7dd3fc" stroke-width="1.4"/><text x="76" y="71" fill="#bdd0e2" font-family="ui-monospace,monospace" font-size="8">FRP strength member</text>
    <path d="M247 137V65H311" fill="none" stroke="#7dd3fc" stroke-width="1.4"/><text x="316" y="68" fill="#bdd0e2" font-family="ui-monospace,monospace" font-size="8">Optical fibers</text>
  </g>
`,
);

const ontHero = heroFrame(
  'ONT · SUBSCRIBER TERMINAL',
  `
  <g filter="url(#shadow)">
    <path d="M69 111L101 83H392L423 111V190H69Z" fill="url(#whiteCase)" stroke="#f8fafc" stroke-width="2"/>
    <path d="M69 111L101 83H392L423 111Z" fill="#e4ebf2" stroke="#f8fafc" stroke-width="1.5"/>
    <path d="M69 111H423V190H69Z" fill="#c6d0db" stroke="#8998a8" stroke-width="1.2"/>
    <path d="M83 121H409" stroke="#eef2f7" stroke-width="2" opacity=".8"/>
    <text x="88" y="106" fill="#526174" font-family="ui-monospace,monospace" font-size="8" font-weight="700">PON / GPON</text>
    <rect x="91" y="132" width="65" height="38" rx="5" fill="#263445" stroke="#61758a" stroke-width="2"/>
    <rect x="100" y="140" width="29" height="21" rx="3" fill="#121c29" stroke="#2dd4bf" stroke-width="2"/>
    <path d="M105 144H124V158H105Z" fill="#166534" stroke="#4ade80" stroke-width="1.5"/>
    <path d="M108 147H121V155H108Z" fill="#22c55e" opacity=".75"/>
    <text x="140" y="154" fill="#dce8f0" font-family="ui-monospace,monospace" font-size="7">SC/APC</text>
    <text x="90" y="181" fill="#435367" font-family="ui-monospace,monospace" font-size="8">OPTICAL</text>
    ${['PON', 'LOS', 'LAN', 'PWR'].map((label, index) => `<g><circle cx="207" cy="145" r="4" fill="${index === 0 ? '#22c55e' : index === 1 ? '#64748b' : index === 2 ? '#38bdf8' : '#facc15'}" stroke="#718096"/><text x="207" y="165" text-anchor="middle" fill="#435367" font-family="ui-monospace,monospace" font-size="6">${label}</text></g>`).join('')}
    <rect x="254" y="134" width="63" height="34" rx="4" fill="#273444" stroke="#718096" stroke-width="2"/>
    <rect x="263" y="140" width="45" height="20" rx="2" fill="#111827" stroke="#d7b46a"/>
    ${Array.from({ length: 8 }, (_, index) => `<path d="M${267 + index * 5.5} 143V150" stroke="#fbbf24" stroke-width="1"/>`).join('')}
    <text x="285" y="181" text-anchor="middle" fill="#435367" font-family="ui-monospace,monospace" font-size="8">GE LAN</text>
    <rect x="346" y="137" width="35" height="24" rx="4" fill="#253345" stroke="#718096" stroke-width="2"/>
    <circle cx="358" cy="149" r="6" fill="#101826" stroke="#b9c6d3"/>
    <text x="363" y="181" text-anchor="middle" fill="#435367" font-family="ui-monospace,monospace" font-size="8">DC IN</text>
    <path d="M89 188H402" stroke="#8d9baa" stroke-width="1"/>
    <text x="245" y="218" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">FRONT PANEL · OPTICAL / LAN / STATUS</text>
  </g>
`,
);

const closureHero = heroFrame(
  'OSP · DOME SPLICE CLOSURE',
  `
  <g filter="url(#shadow)">
    <path d="M168 92C168 60 195 49 240 49S312 60 312 92V150H168Z" fill="#171a1c" stroke="#707579" stroke-width="2.5"/>
    ${Array.from({ length: 9 }, (_, index) => {
      const x = 178 + index * 15.5;
      return `<path d="M${x} 86V146" stroke="${index % 2 === 0 ? '#34393c' : '#090b0c'}" stroke-width="4" opacity=".95"/>`;
    }).join('')}
    <path d="M159 91C159 56 193 43 240 43S321 56 321 91" fill="none" stroke="#777c80" stroke-width="5"/>
    <path d="M156 143H324V165C324 175 315 182 305 182H175C165 182 156 175 156 165Z" fill="#2b3033" stroke="#969a9c" stroke-width="2.5"/>
    <path d="M150 148H330V158H150Z" fill="#777b7d" stroke="#b9babb" stroke-width="1.5"/>
    <path d="M157 160H323" stroke="#111415" stroke-width="5"/>
    <path d="M176 149V171M304 149V171" stroke="#c0c1c1" stroke-width="4"/>
    <circle cx="176" cy="169" r="5" fill="#d6d7d6" stroke="#34383a" stroke-width="2"/>
    <circle cx="304" cy="169" r="5" fill="#d6d7d6" stroke="#34383a" stroke-width="2"/>
    <path d="M155 181C155 191 167 196 179 196H301C313 196 325 191 325 181" fill="none" stroke="#9ca0a2" stroke-width="3"/>
    <path d="M187 181V199H165V213H143" fill="none" stroke="#464b4e" stroke-width="12" stroke-linejoin="round"/>
    <path d="M293 181V199H315V213H337" fill="none" stroke="#464b4e" stroke-width="12" stroke-linejoin="round"/>
    <path d="M143 206H113V215M337 206H367V215" fill="none" stroke="#171a1b" stroke-width="9"/>
    <rect x="312" y="113" width="23" height="16" rx="3" fill="#9c9e9e" stroke="#d0d1d1" stroke-width="1.5"/>
    <path d="M323 113V105H348" fill="none" stroke="#d4d5d5" stroke-width="2.5"/>
    <circle cx="349" cy="105" r="4" fill="#c8c9c9" stroke="#54595b" stroke-width="1.5"/>
    <path d="M240 43V31H342" fill="none" stroke="#b5b9bb" stroke-width="1.4"/>
    <text x="347" y="34" fill="#d7dbdc" font-family="ui-monospace,monospace" font-size="8">RIBBED DOME</text>
    <path d="M326 156H399V140" fill="none" stroke="#b5b9bb" stroke-width="1.4"/>
    <text x="401" y="138" fill="#d7dbdc" font-family="ui-monospace,monospace" font-size="8">BASE CLAMP</text>
    <path d="M178 208V226H112" fill="none" stroke="#7dd3fc" stroke-width="1.4"/>
    <text x="107" y="229" text-anchor="end" fill="#bdd0e2" font-family="ui-monospace,monospace" font-size="8">CABLE ENTRY BOOT</text>
    <text x="240" y="229" text-anchor="middle" fill="#d7dbdc" font-family="ui-monospace,monospace" font-size="8">SEALING CLAMP · GROUND LUG</text>
  </g>
`,
);

const odfHero = heroFrame(
  'ODF · TWO MATCHED THROUGH-PAIRS',
  `
  <g filter="url(#shadow)">
    <path d="M65 76H415V188H65Z" fill="url(#case)" stroke="#9aabc0" stroke-width="3"/>
    <path d="M77 88H403V174H77Z" fill="#111a28" stroke="#64748b" stroke-width="2"/>
    <path d="M88 102H392M88 145H392" stroke="#34465d" stroke-width="2"/>
    ${[0, 1]
      .map((row) =>
        [0, 1]
          .map((col) => {
            const x = 146 + col * 126;
            const y = 108 + row * 38;
            return `<g><rect x="${x}" y="${y}" width="46" height="24" rx="4" fill="#0b1320" stroke="#93a4ba" stroke-width="2"/><circle cx="${x + 12}" cy="${y + 12}" r="5" fill="#115e59" stroke="#5eead4"/><circle cx="${x + 34}" cy="${y + 12}" r="5" fill="#115e59" stroke="#5eead4"/><text x="${x + 23}" y="${y + 21}" text-anchor="middle" fill="#cbd5e1" font-family="ui-monospace,monospace" font-size="6">PAIR ${row * 2 + col + 1}</text></g>`;
          })
          .join(''),
      )
      .join('')}
    <path d="M102 188V207H378V188" fill="none" stroke="#cbd5e1" stroke-width="4"/>
    <text x="240" y="226" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">RACK-MOUNTED ADAPTER / PATCH FIELD</text>
  </g>
`,
);

const napHero = heroFrame(
  'OUTDOOR NAP / FAT · FIXED 1:8',
  `
  <g filter="url(#shadow)">
    <path d="M143 66V53H337V66M158 66V82M322 66V82" fill="none" stroke="#98a1a6" stroke-width="7"/>
    <path d="M145 183V211H335V183" fill="none" stroke="#737e83" stroke-width="9"/>
    <rect x="111" y="73" width="258" height="133" rx="18" fill="#252a2d" stroke="#9aa3a5" stroke-width="3"/>
    <path d="M122 89H358V188H122Z" fill="#343b3e" stroke="#15191b" stroke-width="3"/>
    <path d="M132 100H348V170H132Z" fill="#41494c" stroke="#657074" stroke-width="1.5"/>
    <path d="M151 92V184M329 92V184" stroke="#778185" stroke-width="2"/>
    <rect x="194" y="117" width="92" height="34" rx="7" fill="#111a1c" stroke="#a7b1af" stroke-width="2"/>
    <text x="240" y="138" text-anchor="middle" fill="#a7f3d0" font-family="ui-monospace,monospace" font-size="11" font-weight="700">1 : 8 PLC</text>
    <path d="M77 134H191" stroke="#f59e0b" stroke-width="8"/>
    <rect x="177" y="126" width="16" height="16" rx="5" fill="#111719" stroke="#d1d5d2" stroke-width="2"/>
    <text x="79" y="120" fill="#fef3c7" font-family="ui-monospace,monospace" font-size="8">FEEDER IN</text>
    ${Array.from({ length: 8 }, (_, index) => {
      const row = index % 4;
      const side = index < 4 ? -1 : 1;
      const x0 = side < 0 ? 134 : 346;
      const x1 = side < 0 ? 75 : 405;
      const y = 108 + row * 20;
      return `<g><path d="M${x0} ${y}H${x1}" stroke="${index % 2 ? '#38bdf8' : '#34d399'}" stroke-width="3"/><rect x="${x0 - (side < 0 ? 6 : 0)}" y="${y - 5}" width="6" height="10" rx="2" fill="#101719" stroke="#aab3b0"/><circle cx="${x1}" cy="${y}" r="3" fill="#d8dfdc"/><text x="${x1}" y="${y - 5}" text-anchor="middle" fill="#dbeafe" font-family="ui-monospace,monospace" font-size="7">DROP ${index + 1}</text></g>`;
    }).join('')}
    <path d="M124 196H356" stroke="#111719" stroke-width="4"/>
    <text x="240" y="228" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">SEALED OSP ENCLOSURE · ILLUSTRATIVE REFERENCE</text>
  </g>
`,
);

const gatewayHero = heroFrame(
  'WI-FI 6 · GPON / XGS-PON HOME GATEWAY',
  `
  <g filter="url(#shadow)">
    <path d="M181 56V24M299 56V24" stroke="#aab7c6" stroke-width="8" stroke-linecap="round"/>
    <path d="M126 62Q240 5 354 62M151 72Q240 30 329 72" fill="none" stroke="#38bdf8" stroke-width="3" opacity=".88"/>
    <rect x="157" y="47" width="166" height="163" rx="22" fill="url(#whiteCase)" stroke="#f8fafc" stroke-width="3"/>
    <path d="M169 61H311V192H169Z" fill="#f8fafc" stroke="#d2dae2" stroke-width="1.5"/>
    <path d="M183 71H297V87H183Z" rx="5" fill="#e9eef3"/>
    <text x="240" y="82" text-anchor="middle" fill="#334155" font-family="ui-monospace,monospace" font-size="7" font-weight="700">HOME GATEWAY</text>
    <circle cx="189" cy="110" r="4" fill="#22c55e"/><circle cx="207" cy="110" r="4" fill="#22c55e"/>
    <circle cx="225" cy="110" r="4" fill="#38bdf8"/><circle cx="243" cy="110" r="4" fill="#facc15"/><circle cx="261" cy="110" r="4" fill="#facc15"/>
    <text x="189" y="123" text-anchor="middle" fill="#64748b" font-family="ui-monospace,monospace" font-size="5">PWR</text>
    <text x="207" y="123" text-anchor="middle" fill="#64748b" font-family="ui-monospace,monospace" font-size="5">PON</text>
    <text x="225" y="123" text-anchor="middle" fill="#64748b" font-family="ui-monospace,monospace" font-size="5">NET</text>
    <text x="243" y="123" text-anchor="middle" fill="#64748b" font-family="ui-monospace,monospace" font-size="5">2.4G</text>
    <text x="261" y="123" text-anchor="middle" fill="#64748b" font-family="ui-monospace,monospace" font-size="5">5G</text>
    <rect x="179" y="143" width="122" height="35" rx="6" fill="#26364a" stroke="#718096" stroke-width="2"/>
    ${Array.from({ length: 4 }, (_, index) => `<rect x="${187 + index * 22}" y="151" width="18" height="19" rx="3" fill="#111827" stroke="#e5b857" stroke-width="1.5"/><path d="M${191 + index * 22} 154V162" stroke="#fbbf24" stroke-width="1"/>`).join('')}
    <rect x="270" y="151" width="13" height="17" rx="3" fill="#111827" stroke="#c4b5fd" stroke-width="1.5"/>
    <circle cx="291" cy="159" r="7" fill="#111827" stroke="#4ade80" stroke-width="2"/>
    <text x="240" y="197" text-anchor="middle" fill="#64748b" font-family="ui-monospace,monospace" font-size="6">4 × GE · FXS · PON · POWER</text>
    <text x="240" y="231" text-anchor="middle" fill="#c0cfdf" font-family="ui-monospace,monospace" font-size="9">VERTICAL DUAL-BAND WI-FI 6 ROUTER · REFERENCE</text>
  </g>
`,
);

const thumbs: Record<string, string> = {
  olt: thumbnailFrame(
    `<rect x="9" y="19" width="78" height="29" rx="5" fill="url(#thumbCase)" stroke="#91a2b8"/><path d="M15 25H27M15 30H27M15 35H27M15 40H27" stroke="#9bacbf" stroke-width="2"/>${Array.from({ length: 8 }, (_, index) => `<rect x="32" y="${24 + (index % 2) * 10}" width="6" height="6" rx="1" fill="#0a1320" stroke="#7b8ba0"/>`).join('')}<rect x="69" y="24" width="13" height="17" rx="2" fill="#111a27" stroke="#8292a6"/><circle cx="73" cy="28" r="1.5" fill="#22d383"/>`,
  ),
  splitter: thumbnailFrame(
    `<path d="M7 32H28M67 22C78 22 78 15 89 15M67 27C79 27 79 25 89 25M67 37C79 37 79 39 89 39M67 42C78 42 78 49 89 49" fill="none" stroke="#38bdf8" stroke-width="2.5"/><rect x="27" y="18" width="42" height="29" rx="7" fill="url(#thumbCase)" stroke="#c1ccd8"/><text x="48" y="36" text-anchor="middle" fill="#e2e8f0" font-family="monospace" font-size="8">1:N</text>`,
  ),
  closure: thumbnailFrame(
    `<path d="M32 35V26C32 16 39 11 48 11S64 16 64 26V37Z" fill="#171a1c" stroke="#6f7477" stroke-width="2"/><path d="M29 34H67V39H29Z" fill="#777b7d" stroke="#c0c1c1"/><path d="M34 39V47M62 39V47" stroke="#303538" stroke-width="5"/><path d="M34 46H21M62 46H75" stroke="#202426" stroke-width="6"/><path d="M38 15V34M44 13V34M50 13V34M56 14V34" stroke="#383d40" stroke-width="2"/>`,
  ),
  'fiber-feeder': thumbnailFrame(
    `<circle cx="48" cy="32" r="24" fill="#1a2636" stroke="#b8c5d2" stroke-width="3"/><circle cx="48" cy="32" r="18" fill="#304158"/>${Array.from(
      { length: 12 },
      (_, index) => {
        const angle = (index * Math.PI * 2) / 12;
        return `<circle cx="${(48 + Math.cos(angle) * 12).toFixed(1)}" cy="${(32 + Math.sin(angle) * 12).toFixed(1)}" r="2.5" fill="${coreColors[index]}"/>`;
      },
    ).join('')}<circle cx="48" cy="32" r="4" fill="#f59e0b"/>`,
  ),
  'fiber-distribution': thumbnailFrame(
    `<circle cx="47" cy="27" r="11" fill="#26364a" stroke="#c1ccd8" stroke-width="3"/><circle cx="47" cy="9" r="7" fill="#667487" stroke="#c1ccd8" stroke-width="2"/><path d="M47 16V19" stroke="#c1ccd8" stroke-width="5"/><circle cx="42" cy="25" r="2" fill="#60a5fa"/><circle cx="51" cy="25" r="2" fill="#f59e0b"/><circle cx="47" cy="31" r="2" fill="#34d399"/><path d="M65 28H87" stroke="#c1ccd8" stroke-width="7"/><path d="M66 28H86" stroke="#38bdf8" stroke-width="2"/>`,
  ),
  'fiber-drop': thumbnailFrame(
    `<rect x="10" y="22" width="76" height="21" rx="10" fill="#263445" stroke="#c1ccd8" stroke-width="2"/><circle cx="24" cy="32" r="5" fill="#e2e8f0" stroke="#fff" stroke-width="2"/><circle cx="72" cy="32" r="5" fill="#e2e8f0" stroke="#fff" stroke-width="2"/><circle cx="43" cy="32" r="3.5" fill="#60a5fa"/><circle cx="53" cy="32" r="3.5" fill="#f472b6"/>`,
  ),
  odf: thumbnailFrame(
    `<rect x="8" y="12" width="80" height="40" rx="5" fill="url(#thumbCase)" stroke="#7c8da1" stroke-width="2"/><path d="M15 20H81M15 43H81" stroke="#52657c"/><rect x="28" y="22" width="15" height="9" rx="2" fill="#0b1320" stroke="#5eead4"/><rect x="53" y="32" width="15" height="9" rx="2" fill="#0b1320" stroke="#5eead4"/><path d="M19 17V47M77 17V47" stroke="#cbd5e1" stroke-width="2"/>`,
  ),
  nap: thumbnailFrame(
    `<path d="M25 8V4H71V8M28 47V53M68 47V53" fill="none" stroke="#94a3a8" stroke-width="3"/><rect x="19" y="10" width="60" height="40" rx="8" fill="#303639" stroke="#9aa3a5" stroke-width="2"/><rect x="34" y="22" width="30" height="15" rx="4" fill="#111a1c" stroke="#a7b1af"/><text x="49" y="32" text-anchor="middle" fill="#a7f3d0" font-family="monospace" font-size="6">1:8</text><path d="M6 30H33M64 17H89M64 22H89M64 27H89M64 32H89M64 37H89M64 42H89" stroke="#38bdf8" stroke-width="1.5"/>`,
  ),
  gateway: thumbnailFrame(
    `<path d="M29 13V5M67 13V5" stroke="#475569" stroke-width="3"/><path d="M25 10Q48 0 71 10" fill="none" stroke="#38bdf8" stroke-width="1.5"/><rect x="28" y="11" width="40" height="43" rx="7" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/><path d="M33 16H63V22H33Z" fill="#e2e8f0"/><circle cx="37" cy="29" r="1.5" fill="#22c55e"/><circle cx="43" cy="29" r="1.5" fill="#38bdf8"/><circle cx="49" cy="29" r="1.5" fill="#facc15"/><rect x="35" y="36" width="5" height="7" rx="1" fill="#111827" stroke="#e5b857"/><rect x="42" y="36" width="5" height="7" rx="1" fill="#111827" stroke="#e5b857"/><rect x="49" y="36" width="5" height="7" rx="1" fill="#111827" stroke="#e5b857"/><rect x="56" y="36" width="5" height="7" rx="1" fill="#111827" stroke="#c4b5fd"/>`,
  ),
  ont: thumbnailFrame(
    `<path d="M12 28L23 19H73L84 28V45H12Z" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/><rect x="20" y="31" width="17" height="9" rx="2" fill="#166534" stroke="#4ade80"/><circle cx="48" cy="34" r="2.5" fill="#22c55e"/><circle cx="56" cy="34" r="2.5" fill="#38bdf8"/><rect x="65" y="30" width="11" height="9" rx="1.5" fill="#182536" stroke="#d7b46a"/>`,
  ),
};

export const HARDWARE_CATALOGUE: Record<string, HardwareProfile> = {
  'olt-standard': {
    id: 'olt-standard',
    kind: 'olt',
    modelName: '1U GPON / XGS-PON pizza-box OLT (reference)',
    vendorCategory: 'Central Office Optical Line Terminal',
    thumbnailSvg: toDataUri(thumbs.olt),
    heroSvg: toDataUri(oltHero),
    physicalPorts: [
      '16 PON optic cages in this representative layout; GPON/XGS-PON support and coexistence depend on the exact chassis and transceivers.',
      '4 × 10GE SFP+ uplink cages for aggregation toward the provider network.',
      'Management Ethernet and a console interface; exact console/USB layout is SKU-dependent.',
      'Front-accessible status/alarm indicators, fan trays, and replaceable power modules vary by chassis.',
    ],
    fieldNotes: [
      'Match the installed GPON or XGS-PON optics, wavelengths, launch power, optical class, and endpoint population to the link budget.',
      'Inspect and clean connector end faces before patching; keep caps on unused optical modules.',
      'Never look into an active fiber or optical port. Use an appropriate power meter and approved eye-safety procedures.',
    ],
    datasheetSnippet: {
      operatingTemp: 'Chassis and transceiver dependent; use the exact vendor datasheet.',
      wavelengths:
        'GPON reference: 1490/1310 nm downstream/upstream. XGS-PON reference: 1577/1270 nm. Confirm the installed optics and coexistence plan.',
      standards: [
        'ITU-T G.984 series (GPON)',
        'ITU-T G.9807.1 (XGS-PON)',
        'Confirm the selected OLT and optic compliance declarations.',
      ],
    },
    description:
      'The OLT is the provider-side source and controller for a PON. Its optical modules launch the downstream signal and receive upstream traffic from subscriber ONTs.',
  },
  'splitter-plc': {
    id: 'splitter-plc',
    kind: 'splitter',
    modelName: 'Box-type PLC splitter cassette (reference)',
    vendorCategory: 'Outdoor Planar Lightwave Circuit',
    thumbnailSvg: toDataUri(thumbs.splitter),
    heroSvg: toDataUri(splitterHero),
    physicalPorts: [
      'One optical input pigtail and N output pigtails; N follows the selected 1:N split ratio.',
      'Pigtail connectorization may be SC/APC, SC/UPC, or another ordered option; never assume polish from the housing alone.',
      'ABS enclosure, cable glands, internal splitter chip, and strain-relieved loose-tube pigtails.',
    ],
    fieldNotes: [
      'Confirm the ratio and insertion-loss label before connecting or splicing the splitter.',
      'Identify input and output pigtails, maintain bend radius, and avoid pulling on the loose tubes.',
      'Seal the enclosure and use a splice tray appropriate to the location and its environmental rating.',
    ],
    datasheetSnippet: {
      operatingTemp: 'Enclosure and deployment-class dependent; confirm the splitter and closure ratings.',
      wavelengths:
        'The PLC passband is product-specific; verify its specified range and insertion loss for the PON windows in use.',
      standards: ['Check the vendor declaration for applicable IEC 61753 / ITU-T G.671 component requirements.'],
    },
    description:
      'A passive splitter divides one optical path among multiple branches. Every branch receives less power; the split ratio and the actual unit’s insertion loss matter to the budget.',
  },
  'fiber-feeder': {
    id: 'fiber-feeder',
    kind: 'fiber',
    modelName: '48-core micro-duct loose-tube feeder cable (reference)',
    vendorCategory: 'Outside-Plant Feeder Fiber Cable',
    thumbnailSvg: toDataUri(thumbs['fiber-feeder']),
    heroSvg: toDataUri(feederHero),
    physicalPorts: [
      '48 single-mode fibers; the illustration groups these as six loose tubes with eight fibers each.',
      'Loose tubes, water-blocking materials, strength member, and sheath compound vary by cable construction.',
      'Micro-duct compatibility depends on the cable outside diameter and the duct/pulling system.',
    ],
    fieldNotes: [
      'Reserve fibers where practical and record tube/fiber color codes before cutting, splicing, or assigning a route.',
      'Observe the cable datasheet’s minimum bend radius, tensile load, duct fill, and installation method.',
      'Seal cable ends against moisture and retain splice/OTDR records with the route documentation.',
    ],
    datasheetSnippet: {
      operatingTemp:
        'Storage, installation, and operating ranges are cable-SKU dependent; verify all three in the datasheet.',
      wavelengths:
        'Fiber transmission windows depend on the specified fiber grade; commonly engineered GPON windows include 1310 nm and 1490 nm.',
      standards: [
        'ITU-T G.652.D or another specified single-mode fiber grade.',
        'IEC 60794-3 family for applicable outdoor cable constructions; confirm the exact cable type.',
      ],
    },
    description:
      'The feeder carries shared PON traffic from the OLT side toward the distribution plant. Its core count, routing, and splice plan determine capacity and maintainability as well as loss.',
  },
  'fiber-distribution': {
    id: 'fiber-distribution',
    kind: 'fiber',
    modelName: '12-core aerial figure-8 cable (reference)',
    vendorCategory: 'Aerial Self-Supporting Distribution Cable',
    thumbnailSvg: toDataUri(thumbs['fiber-distribution']),
    heroSvg: toDataUri(distHero),
    physicalPorts: [
      '12 single-mode fibers in a compact optical unit; the actual tube/core layout varies by design.',
      'Figure-8 profile combines the optical cable with an integral messenger element.',
      'Jacket, messenger material, tensile rating, and hardware compatibility are product-specific.',
    ],
    fieldNotes: [
      'Use the specified figure-8 clamps and suspension hardware; load the messenger, not the optical unit.',
      'Plan span, sag, clearance, wind/ice loading, and pole attachment under local rules and the cable datasheet.',
      'Avoid crushing or distorting the optical lobe while stripping, securing, or entering a closure.',
    ],
    datasheetSnippet: {
      operatingTemp:
        'Cable, messenger, and installation limits vary by SKU and environment; confirm the manufacturer’s ratings.',
      wavelengths:
        'Use the specified single-mode fiber grade; GPON plant commonly carries 1310 nm upstream and 1490 nm downstream.',
      standards: [
        'ITU-T G.652.D or another fiber grade stated by the manufacturer.',
        'Applicable IEC 60794 outdoor-cable requirements depend on the exact design.',
      ],
    },
    description:
      'A self-supporting figure-8 cable is used for aerial distribution. Its messenger supports the span while the optical section carries the fibers; each must be handled according to its own mechanical limits.',
  },
  'fiber-drop': {
    id: 'fiber-drop',
    kind: 'fiber',
    modelName: '2-core flat drop cable with FRP members (reference)',
    vendorCategory: 'Subscriber Drop Fiber Cable',
    thumbnailSvg: toDataUri(thumbs['fiber-drop']),
    heroSvg: toDataUri(dropHero),
    physicalPorts: [
      'Two single-mode fibers inside a low-profile flat jacket.',
      'Two FRP (fiber-reinforced polymer) strength members sit beside the optical fibers.',
      'The termination connector is selected for the ONT/rosette and is not part of the cable cross-section itself.',
    ],
    fieldNotes: [
      'Respect the minimum bend radius and avoid crushing the flat cable with clips, staples, or tight ties.',
      'Keep the building entry weather-sealed and provide strain relief at both ends.',
      'FRP members are mechanical reinforcement, not electrical conductors; prepare and terminate the optical fibers using the approved method.',
    ],
    datasheetSnippet: {
      operatingTemp: 'Indoor/outdoor rating, installation range, and storage range depend on the selected cable SKU.',
      wavelengths: 'Use the cable’s specified single-mode fiber grade; GPON systems commonly use 1310 nm and 1490 nm.',
      standards: [
        'ITU-T G.652.D or G.657 where specified by the cable manufacturer.',
        'Confirm the exact drop-cable construction and environmental rating from its datasheet.',
      ],
    },
    description:
      'The drop is the final cable section to a subscriber location. Its small size makes routing convenient, but tight bends, crushing, and poor entry sealing can cause trouble in the field.',
  },
  'closure-dome': {
    id: 'closure-dome',
    kind: 'closure',
    modelName: 'Industrial heat-shrink dome splice closure (FOSC-style reference)',
    vendorCategory: 'Outside Plant Fiber Splice Closure',
    thumbnailSvg: toDataUri(thumbs.closure),
    heroSvg: toDataUri(closureHero),
    physicalPorts: [
      'Dome-and-base enclosure with two modeled feeder/input entries and four distribution/branch exits.',
      'Illustrative capacity: up to 48 single fusion splices, subject to tray stack and exact closure configuration.',
      'IP68 is a reference enclosure rating only; the exact SKU, sealing kit, cable ports, and installation procedure must be verified.',
      'Ground lug and clamp details vary by closure family and local bonding requirements.',
    ],
    fieldNotes: [
      'Clean the sealing surfaces, use the correct port seals, and follow the manufacturer’s re-entry procedure.',
      'Protect each fusion joint with a correctly sized heat-shrink sleeve and secure it in the organizer tray.',
      'Record fiber colors, tube/branch assignments, splices, and test results before closing the dome.',
    ],
    datasheetSnippet: {
      operatingTemp:
        'Temperature range, re-entry limits, and service-life rating vary by exact closure and sealing kit.',
      wavelengths:
        'The enclosure is passive; the linked single-mode fibers carry the modeled 1310, 1490, or 1550 nm signal.',
      standards: [
        'Reference configuration: up to 48 single fusion splices; verify the selected tray and closure datasheet.',
        'IP68 is not universal to every FOSC-style product; confirm the product’s tested rating and installation method.',
      ],
    },
    description:
      'A dome splice closure protects cable entries and fusion joints at an outside-plant distribution point. This teaching model represents a 48-splice FOSC-style reference, not a specific vendor SKU.',
  },
  'odf-rack': {
    id: 'odf-rack',
    kind: 'odf',
    modelName: '2-pair ODF rack patch panel (reference)',
    vendorCategory: 'Optical Distribution Frame / Indoor Patch Field',
    thumbnailSvg: toDataUri(thumbs.odf),
    heroSvg: toDataUri(odfHero),
    physicalPorts: [
      'Two independent matched adapter through-pairs, each with one modeled input and one paired output.',
      'Adapter polish/connectorization can be SC/APC, SC/UPC, LC, or another ordered option; mate only compatible connector types.',
      'Rack tray, splice cassette, cable-management rings, grounding/bonding points, and port count vary by frame.',
    ],
    fieldNotes: [
      'Keep each input/output pair labeled and connected to the same logical port; the simulator does not cross-connect pairs.',
      'Clean and inspect every adapter and patch lead before use, and retain bend-radius and strain-relief control.',
      'The 0.5 dB through allowance is a teaching assumption for this graph node, not a guaranteed adapter measurement.',
    ],
    datasheetSnippet: {
      operatingTemp: 'Indoor rack environment and enclosure ratings depend on the selected frame and adapter hardware.',
      wavelengths: 'Passive patch field shown on a GPON/XGS-PON path; the modeled downstream uses 1490 nm or 1577 nm.',
      standards: [
        'Reference rack/adapter arrangement only; verify connector type, polish, and frame capacity against the selected product.',
        'Bonding and cable-management details are installation- and local-code-dependent.',
      ],
    },
    description:
      'An optical distribution frame organizes and patches feeder fibers between active equipment and the outside plant. This simplified two-pair model adds a fixed reference through-port loss.',
  },
  'nap-fat-1x8': {
    id: 'nap-fat-1x8',
    kind: 'nap',
    modelName: 'Outdoor NAP/FAT 1:8 terminal (reference)',
    vendorCategory: 'Outdoor Fiber Access / Network Access Point',
    thumbnailSvg: toDataUri(thumbs.nap),
    heroSvg: toDataUri(napHero),
    physicalPorts: [
      'One feeder input and eight subscriber/drop outputs in this representative NAP/FAT layout.',
      'Internal fixed 1:8 PLC split with a 10.5 dB insertion-loss reference used by the learning simulator.',
      'Weather-sealed housing, cable glands, connector adapters, and drop capacity vary by exact enclosure and installation.',
    ],
    fieldNotes: [
      'Verify the actual splitter ratio, insertion-loss label, connector polish, and port map before connecting a field unit.',
      'Use the specified sealing hardware and cable preparation method; weather protection depends on correct installation.',
      'The displayed 10.5 dB is the requested educational reference, not a universal or calibrated loss for every NAP.',
    ],
    datasheetSnippet: {
      operatingTemp:
        'Outdoor range and ingress rating are product-specific; check the exact NAP/FAT and connector datasheets.',
      wavelengths:
        'Passive optical distribution model for GPON or XGS-PON; verify component bandwidth and insertion-loss specifications.',
      standards: [
        'Reference 1:8 topology only; confirm the product’s splitter and environmental declarations.',
        'Connectorization, split balance, and field drop count are SKU-dependent.',
      ],
    },
    description:
      'A network access point / fiber access terminal distributes one feeder to subscriber drops. FiberLAB models its internal 1:8 split as one 10.5 dB loss on every connected output branch.',
  },
  'wifi6-gateway': {
    id: 'wifi6-gateway',
    kind: 'gateway',
    modelName: 'Dual-band Wi-Fi 6 GPON / XGS-PON gateway (reference)',
    vendorCategory: 'Integrated Optical Network Terminal and Home Gateway',
    thumbnailSvg: toDataUri(thumbs.gateway),
    heroSvg: toDataUri(gatewayHero),
    physicalPorts: [
      'One GPON/XGS-PON optical input; connector, wavelength window, optical class, and interoperability vary by SKU.',
      'Dual-band IEEE 802.11ax Wi-Fi 6 radio (2.4/5 GHz); antenna count and achievable client rate depend on model and client.',
      'Representative four-port 10/100/1000BASE-T LAN switch; port speeds and any 2.5GbE WAN/LAN option are model-specific.',
      'One FXS RJ-11 voice port, plus reset/WPS and DC power interfaces in this illustrative layout; voice service requires provider provisioning.',
    ],
    fieldNotes: [
      'Check optical registration and received power first; Wi-Fi, LAN, and voice status also depend on gateway configuration and upstream service.',
      'A radio link rate or shared PON line-rate share is not a measured application throughput or Internet speed test.',
      'Change the example SSID before deployment and follow the operator’s security, firmware, and voice-provisioning policy.',
    ],
    datasheetSnippet: {
      operatingTemp: 'Indoor operating limits, ventilation, power adapter, and thermal behavior vary by gateway SKU.',
      wavelengths:
        'GPON commonly uses 1490 nm downstream / 1310 nm upstream; XGS-PON uses 1577 / 1270 nm in the modeled reference.',
      standards: [
        'IEEE 802.11ax (Wi-Fi 6) radio feature reference; exact bands, streams, and rates vary.',
        'ITU-T G.984 series (GPON) and G.9807.1 (XGS-PON); confirm actual optical interoperability and service provisioning.',
      ],
    },
    description:
      'The integrated gateway terminates the PON and presents optical health, a configured SSID, and an illustrative per-split line-rate estimate alongside common Wi-Fi, Ethernet, and voice interfaces.',
  },
  'ont-indoor': {
    id: 'ont-indoor',
    kind: 'ont',
    modelName: 'Desktop GPON ONU / ONT (reference)',
    vendorCategory: 'Indoor Subscriber Optical Network Terminal',
    thumbnailSvg: toDataUri(thumbs.ont),
    heroSvg: toDataUri(ontHero),
    physicalPorts: [
      'One green SC/APC PON receptacle in this representative front-panel layout.',
      'One 10/100/1000BASE-T RJ45 Ethernet LAN port.',
      'DC power input and PON, LOS, LAN, and power status indicators.',
      'Port count, Wi-Fi, voice, and indicator layout vary substantially between ONT models.',
    ],
    fieldNotes: [
      'Inspect and clean the SC/APC connection; do not mate an APC connector with a UPC connector.',
      'Confirm power, PON registration, LOS state, and Ethernet link before diagnosing the customer’s router or device.',
      'Leave ventilation space and strain relief, and keep the optical lead away from sharp bends and pinch points.',
    ],
    datasheetSnippet: {
      operatingTemp: 'Model and installation environment dependent; use the exact ONT datasheet.',
      wavelengths:
        'GPON commonly uses 1490 nm downstream and 1310 nm upstream; exact receiver windows vary by ONT class.',
      standards: [
        'ITU-T G.984 series (GPON)',
        'Confirm the selected ONT class, optical limits, and interoperability requirements.',
      ],
    },
    description:
      'The ONT converts the provider’s optical access signal into customer-facing services such as Ethernet. Its PON receive level and registration state are useful clues during troubleshooting.',
  },
};

/**
 * Resolve a generic node and optional subtype to its representative hardware.
 * Fiber subtype accepts feeder, distribution, or drop; omitted/unrecognized
 * fiber subtypes use the distribution profile. Unknown component kinds fail
 * loudly rather than silently showing the wrong physical equipment.
 */
export function getHardwareProfileForNode(kind: string, subType?: string): HardwareProfile {
  let profileId: string;

  if (kind === 'olt') {
    profileId = 'olt-standard';
  } else if (kind === 'splitter') {
    profileId = 'splitter-plc';
  } else if (kind === 'fiber') {
    const cableType = subType?.toLowerCase();
    profileId = cableType === 'feeder' ? 'fiber-feeder' : cableType === 'drop' ? 'fiber-drop' : 'fiber-distribution';
  } else if (kind === 'closure') {
    profileId = 'closure-dome';
  } else if (kind === 'ont') {
    profileId = 'ont-indoor';
  } else if (kind === 'odf') {
    profileId = 'odf-rack';
  } else if (kind === 'nap') {
    profileId = 'nap-fat-1x8';
  } else if (kind === 'gateway') {
    profileId = 'wifi6-gateway';
  } else {
    throw new RangeError(`No hardware profile is defined for component kind "${kind}".`);
  }

  return HARDWARE_CATALOGUE[profileId];
}
