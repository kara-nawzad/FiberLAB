import type { PonEdge, PonNode } from '../types';

/* ========================================================================== *
 * Preset topologies
 *
 * Preset A — "Standard 1:32 GPON Tree"
 *   OLT -> 5 km feeder -> 1:4 -> 1 km distribution -> 1:8 -> 300 m drop -> ONT
 *   Aggregate split 1:4 x 1:8 = 1:32. Three subscribers hang off the 1:8 so the
 *   tree demonstrates healthy, marginal and long-drop behaviour at once.
 *
 * Preset B — "Failing Long-Distance Link"
 *   A 1:512 cascade stretched over ~30 km of plant: both wired ONTs fall into
 *   LOS, and a third ONT is left unwired to show the DISCONNECTED state.
 * ========================================================================== */

export interface Preset {
  id: string;
  name: string;
  description: string;
  build: () => { nodes: PonNode[]; edges: PonEdge[] };
}

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle = 'in',
): PonEdge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  type: 'optical',
});

/* --------------------------------- Preset A -------------------------------- */

function buildStandardTree(): { nodes: PonNode[]; edges: PonEdge[] } {
  const nodes: PonNode[] = [
    {
      id: 'olt-a',
      type: 'olt',
      position: { x: 20, y: 196 },
      data: {
        kind: 'olt',
        portName: 'PON 0/1/0',
        oltClass: 'B+',
        txPowerDbm: 3.0,
        laserOn: true,
        wavelength: 1490,
      },
    },
    {
      id: 'fiber-feeder-a',
      type: 'fiber',
      position: { x: 300, y: 206 },
      data: {
        kind: 'fiber',
        cableType: 'feeder',
        lengthKm: 5,
        splices: 0,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'splitter-1x4-a',
      type: 'splitter',
      position: { x: 500, y: 200 },
      data: { kind: 'splitter', ratio: 4, excessLossDb: 0 },
    },
    {
      id: 'fiber-dist-a',
      type: 'fiber',
      position: { x: 720, y: 206 },
      data: {
        kind: 'fiber',
        cableType: 'distribution',
        lengthKm: 1,
        splices: 2,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'splitter-1x8-a',
      type: 'splitter',
      position: { x: 920, y: 200 },
      data: { kind: 'splitter', ratio: 8, excessLossDb: 0 },
    },
    {
      id: 'fiber-drop-a1',
      type: 'fiber',
      position: { x: 1140, y: 44 },
      data: {
        kind: 'fiber',
        cableType: 'drop',
        lengthKm: 0.3,
        splices: 1,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'ont-a1',
      type: 'ont',
      position: { x: 1345, y: 30 },
      data: {
        kind: 'ont',
        serial: 'HWTC00100001',
        subscriber: 'Al-Sulaymaniyah — Unit 12',
        sensitivityDbm: -28,
      },
    },
    {
      id: 'fiber-drop-a2',
      type: 'fiber',
      position: { x: 1140, y: 206 },
      data: {
        kind: 'fiber',
        cableType: 'drop',
        lengthKm: 1.2,
        splices: 3,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'ont-a2',
      type: 'ont',
      position: { x: 1345, y: 192 },
      data: {
        kind: 'ont',
        serial: 'HWTC00100002',
        subscriber: 'Al-Sulaymaniyah — Unit 14',
        sensitivityDbm: -28,
      },
    },
    {
      id: 'fiber-drop-a3',
      type: 'fiber',
      position: { x: 1140, y: 368 },
      data: {
        kind: 'fiber',
        cableType: 'drop',
        lengthKm: 6,
        splices: 4,
        connectors: 4,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'ont-a3',
      type: 'ont',
      position: { x: 1345, y: 354 },
      data: {
        kind: 'ont',
        serial: 'HWTC00100003',
        subscriber: 'Tanaro Village — Remote',
        sensitivityDbm: -28,
      },
    },
  ];

  const edges: PonEdge[] = [
    edge('e-a1', 'olt-a', 'fiber-feeder-a', 'out'),
    edge('e-a2', 'fiber-feeder-a', 'splitter-1x4-a', 'out'),
    edge('e-a3', 'splitter-1x4-a', 'fiber-dist-a', 'out-0'),
    edge('e-a4', 'fiber-dist-a', 'splitter-1x8-a', 'out'),
    edge('e-a5', 'splitter-1x8-a', 'fiber-drop-a1', 'out-0'),
    edge('e-a6', 'fiber-drop-a1', 'ont-a1', 'out'),
    edge('e-a7', 'splitter-1x8-a', 'fiber-drop-a2', 'out-1'),
    edge('e-a8', 'fiber-drop-a2', 'ont-a2', 'out'),
    edge('e-a9', 'splitter-1x8-a', 'fiber-drop-a3', 'out-2'),
    edge('e-a10', 'fiber-drop-a3', 'ont-a3', 'out'),
  ];

  return { nodes, edges };
}

/* --------------------------------- Preset B -------------------------------- */

function buildFailingLink(): { nodes: PonNode[]; edges: PonEdge[] } {
  const nodes: PonNode[] = [
    {
      id: 'olt-b',
      type: 'olt',
      position: { x: 20, y: 196 },
      data: {
        kind: 'olt',
        portName: 'PON 0/2/3',
        oltClass: 'C+',
        txPowerDbm: 5.0,
        laserOn: true,
        wavelength: 1490,
      },
    },
    {
      id: 'fiber-feeder-b',
      type: 'fiber',
      position: { x: 300, y: 206 },
      data: {
        kind: 'fiber',
        cableType: 'feeder',
        lengthKm: 20,
        splices: 2,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'splitter-1x32-b',
      type: 'splitter',
      position: { x: 500, y: 200 },
      data: { kind: 'splitter', ratio: 32, excessLossDb: 0 },
    },
    {
      id: 'fiber-dist-b',
      type: 'fiber',
      position: { x: 720, y: 206 },
      data: {
        kind: 'fiber',
        cableType: 'distribution',
        lengthKm: 8,
        splices: 4,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'splitter-1x16-b',
      type: 'splitter',
      position: { x: 920, y: 200 },
      data: { kind: 'splitter', ratio: 16, excessLossDb: 0 },
    },
    {
      id: 'fiber-drop-b1',
      type: 'fiber',
      position: { x: 1140, y: 44 },
      data: {
        kind: 'fiber',
        cableType: 'drop',
        lengthKm: 1.5,
        splices: 2,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'ont-b1',
      type: 'ont',
      position: { x: 1345, y: 30 },
      data: {
        kind: 'ont',
        serial: 'ZTEG00200001',
        subscriber: 'Dukan Ridge — Tower 7',
        sensitivityDbm: -28,
      },
    },
    {
      id: 'fiber-drop-b2',
      type: 'fiber',
      position: { x: 1140, y: 206 },
      data: {
        kind: 'fiber',
        cableType: 'drop',
        lengthKm: 0.4,
        splices: 1,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'ont-b2',
      type: 'ont',
      position: { x: 1345, y: 192 },
      data: {
        kind: 'ont',
        serial: 'ZTEG00200002',
        subscriber: 'Dukan Ridge — Tower 9',
        sensitivityDbm: -28,
      },
    },
    {
      id: 'fiber-drop-b3',
      type: 'fiber',
      position: { x: 1140, y: 368 },
      data: {
        kind: 'fiber',
        cableType: 'drop',
        lengthKm: 0.25,
        splices: 1,
        connectors: 2,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'ont-b3',
      type: 'ont',
      position: { x: 1345, y: 354 },
      data: {
        kind: 'ont',
        serial: 'ZTEG00200003',
        subscriber: 'Dukan Ridge — Not Yet Wired',
        sensitivityDbm: -28,
      },
    },
  ];

  const edges: PonEdge[] = [
    edge('e-b1', 'olt-b', 'fiber-feeder-b', 'out'),
    edge('e-b2', 'fiber-feeder-b', 'splitter-1x32-b', 'out'),
    edge('e-b3', 'splitter-1x32-b', 'fiber-dist-b', 'out-0'),
    edge('e-b4', 'fiber-dist-b', 'splitter-1x16-b', 'out'),
    edge('e-b5', 'splitter-1x16-b', 'fiber-drop-b1', 'out-0'),
    edge('e-b6', 'fiber-drop-b1', 'ont-b1', 'out'),
    edge('e-b7', 'splitter-1x16-b', 'fiber-drop-b2', 'out-1'),
    edge('e-b8', 'fiber-drop-b2', 'ont-b2', 'out'),
    // fiber-drop-b3 and ont-b3 are deliberately left unpatched (DISCONNECTED).
  ];

  return { nodes, edges };
}

/* --------------------------------- Preset C -------------------------------- */

function buildModernXgsSuburb(): { nodes: PonNode[]; edges: PonEdge[] } {
  const nodes: PonNode[] = [
    {
      id: 'olt-xgs-suburb',
      type: 'olt',
      position: { x: 20, y: 210 },
      data: {
        kind: 'olt',
        portName: 'XGS-PON 0/1/0',
        oltClass: 'C+',
        txPowerDbm: 5,
        laserOn: true,
        wavelength: 1577,
        ponStandard: 'XGS-PON',
      },
    },
    {
      id: 'odf-xgs-suburb',
      type: 'odf',
      position: { x: 295, y: 214 },
      data: { kind: 'odf', throughPortLossDb: 0.5 },
    },
    {
      id: 'fiber-feeder-xgs-suburb',
      type: 'fiber',
      position: { x: 525, y: 220 },
      data: {
        kind: 'fiber',
        cableType: 'feeder',
        lengthKm: 3.5,
        splices: 0,
        connectors: 2,
        wavelength: 1577,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'closure-xgs-suburb',
      type: 'closure',
      position: { x: 715, y: 210 },
      data: {
        kind: 'closure',
        spliceLossDb: 0.08,
        activeSpliceChannels: Array.from({ length: 12 }, (_, index) => index < 4),
      },
    },
    {
      id: 'fiber-distribution-xgs-suburb',
      type: 'fiber',
      position: { x: 945, y: 220 },
      data: {
        kind: 'fiber',
        cableType: 'distribution',
        lengthKm: 1.2,
        splices: 2,
        connectors: 2,
        wavelength: 1577,
        attenuationOverrideDbPerKm: null,
      },
    },
    {
      id: 'nap-xgs-suburb',
      type: 'nap',
      position: { x: 1135, y: 204 },
      data: { kind: 'nap', splitLossDb: 10.5 },
    },
    ...[0, 1, 2].flatMap((index): PonNode[] => {
      const suffix = index + 1;
      const y = 40 + index * 176;
      return [
        {
          id: `fiber-drop-xgs-${suffix}`,
          type: 'fiber',
          position: { x: 1365, y: y + 12 },
          data: {
            kind: 'fiber',
            cableType: 'drop',
            lengthKm: 0.15,
            splices: 1,
            connectors: 2,
            wavelength: 1577,
            attenuationOverrideDbPerKm: null,
          },
        },
        {
          id: `gateway-xgs-${suffix}`,
          type: 'gateway',
          position: { x: 1560, y },
          data: {
            kind: 'gateway',
            serial: `FLGW0010000${suffix}`,
            subscriber: `Modern Suburb — Home ${suffix}`,
            ssid: `FiberLAB-XGS-${String(suffix).padStart(2, '0')}`,
            serviceIpAddress: `192.0.2.${100 + suffix}`,
            sensitivityDbm: -28,
          },
        },
      ];
    }),
  ];

  const edges: PonEdge[] = [
    edge('e-xgs-1', 'olt-xgs-suburb', 'odf-xgs-suburb', 'out', 'in-0'),
    edge('e-xgs-2', 'odf-xgs-suburb', 'fiber-feeder-xgs-suburb', 'out-0'),
    edge('e-xgs-3', 'fiber-feeder-xgs-suburb', 'closure-xgs-suburb', 'out', 'in-0'),
    edge('e-xgs-4', 'closure-xgs-suburb', 'fiber-distribution-xgs-suburb', 'out-0'),
    edge('e-xgs-5', 'fiber-distribution-xgs-suburb', 'nap-xgs-suburb', 'out'),
    ...[0, 1, 2].flatMap((index): PonEdge[] => {
      const suffix = index + 1;
      return [
        edge(`e-xgs-${6 + index * 2}`, 'nap-xgs-suburb', `fiber-drop-xgs-${suffix}`, `out-${index}`),
        edge(`e-xgs-${7 + index * 2}`, `fiber-drop-xgs-${suffix}`, `gateway-xgs-${suffix}`, 'out'),
      ];
    }),
  ];

  return { nodes, edges };
}

export const PRESETS: Preset[] = [
  {
    id: 'standard-1x32',
    name: 'Standard 1:32 GPON Tree',
    description: 'OLT → 5 km feeder → 1:4 → 1 km distribution → 1:8 → 300 m drop → ONT',
    build: buildStandardTree,
  },
  {
    id: 'failing-long-haul',
    name: 'Failing Long-Distance Link',
    description: 'A 1:512 cascade over ~30 km — subscribers land in LOS / offline',
    build: buildFailingLink,
  },
  {
    id: 'modern-10g-xgs-pon-suburb',
    name: 'MODERN 10G XGS-PON SUBURB',
    description: 'XGS-PON OLT → ODF → 3.5 km feeder → dome closure → 1.2 km distribution → 1:8 NAP → three 150 m drops and Wi-Fi 6 gateways',
    build: buildModernXgsSuburb,
  },
];

export function buildPreset(id: string): { nodes: PonNode[]; edges: PonEdge[] } | null {
  const preset = PRESETS.find((candidate) => candidate.id === id);
  return preset ? preset.build() : null;
}
