import type { Edge, Node } from '@xyflow/react';
import type { NetworkCostBreakdown, UnitCostProfile } from './data/pricingCatalogue';

/* ========================================================================== *
 * FiberLAB — Domain Model
 *
 * Every optical element in the PON is modelled as a React Flow node. Fiber
 * runs are first-class nodes (not edges) so that a physical cable span carries
 * its own length, splice count, connector count and wavelength — the edges
 * between elements are purely patch-cord / patch-panel relationships.
 * ========================================================================== */

/** Supported PON and diagnostic wavelengths. The OPM retains its original three calibration choices. */
export type Wavelength = 1270 | 1310 | 1490 | 1550 | 1577;
export type MeterWavelength = 1310 | 1490 | 1550;
export type PonStandard = 'GPON' | 'XGS-PON';

/** Educational reference attenuation values, not calibrated fiber specifications. */
export const ATTENUATION_DB_PER_KM: Record<Wavelength, number> = {
  1270: 0.35,
  1310: 0.35,
  1490: 0.25,
  1550: 0.2,
  1577: 0.22,
};

export const WAVELENGTH_LABEL: Record<Wavelength, string> = {
  1270: '1270 nm (XGS-PON upstream)',
  1310: '1310 nm (GPON upstream)',
  1490: '1490 nm (GPON downstream)',
  1550: '1550 nm (diagnostic reference)',
  1577: '1577 nm (XGS-PON downstream)',
};

export interface PonStandardSpec {
  downstreamWavelength: Wavelength;
  upstreamWavelength: Wavelength;
  downstreamGbps: number;
  upstreamGbps: number;
}

/** Nominal line-rate/wavelength references; payload throughput is lower and shared. */
export const PON_STANDARD_SPECS: Record<PonStandard, PonStandardSpec> = {
  GPON: {
    downstreamWavelength: 1490,
    upstreamWavelength: 1310,
    downstreamGbps: 2.488,
    upstreamGbps: 1.244,
  },
  'XGS-PON': {
    downstreamWavelength: 1577,
    upstreamWavelength: 1270,
    downstreamGbps: 9.953,
    upstreamGbps: 9.953,
  },
};

export const DEFAULT_ODF_THROUGH_PORT_LOSS_DB = 0.5;
export const ODF_PORT_PAIRS = 2;
export const NAP_OUTPUT_PORTS = 8;
export const NAP_SPLIT_LOSS_DB = 10.5;
export const NAP_SPLIT_RATIO = 8;

/* -------------------------------------------------------------------------- *
 * Passive splitter catalogue
 * -------------------------------------------------------------------------- */

export type SplitRatio = 2 | 4 | 8 | 16 | 32 | 64;

/** Theoretical splitting loss + typical insertion loss, in dB. */
export const SPLITTER_LOSS_DB: Record<SplitRatio, number> = {
  2: 3.7,
  4: 7.2,
  8: 10.5,
  16: 13.8,
  32: 17.5,
  64: 20.8,
};

export const SPLIT_RATIOS: SplitRatio[] = [2, 4, 8, 16, 32, 64];

/** Physical output port count exposed on the splitter node. */
export const SPLITTER_OUTPUT_PORTS: Record<SplitRatio, number> = {
  2: 2,
  4: 4,
  8: 4,
  16: 4,
  32: 4,
  64: 4,
};

/* -------------------------------------------------------------------------- *
 * OLT transceiver classes (ITU-T G.984.2 power budgets)
 * -------------------------------------------------------------------------- */

export type OltClass = 'B+' | 'C+';

export interface OltClassSpec {
  label: string;
  /** Typical launch power used as the default when the class is selected. */
  txPowerDbm: number;
  minTxDbm: number;
  maxTxDbm: number;
  /** Receiver sensitivity of the OLT side, informational only. */
  rxSensitivityDbm: number;
  /** Nominal link budget advertised by the class. */
  linkBudgetDb: number;
}

export const OLT_CLASS_SPECS: Record<OltClass, OltClassSpec> = {
  'B+': {
    label: 'Class B+ (GPON)',
    txPowerDbm: 3.0,
    minTxDbm: 1.5,
    maxTxDbm: 5.0,
    rxSensitivityDbm: -28.0,
    linkBudgetDb: 28.0,
  },
  'C+': {
    label: 'Class C+ (GPON/XGS)',
    txPowerDbm: 5.0,
    minTxDbm: 3.0,
    maxTxDbm: 7.0,
    rxSensitivityDbm: -32.0,
    linkBudgetDb: 32.0,
  },
};

/* -------------------------------------------------------------------------- *
 * Fiber cable presets
 * -------------------------------------------------------------------------- */

export type CableType = 'feeder' | 'distribution' | 'drop';

export interface CableSpec {
  label: string;
  short: string;
  defaultLengthKm: number;
  defaultSplices: number;
  defaultConnectors: number;
  accent: string;
}

export const CABLE_SPECS: Record<CableType, CableSpec> = {
  feeder: {
    label: 'Feeder cable',
    short: 'FEEDER',
    defaultLengthKm: 5,
    defaultSplices: 0,
    defaultConnectors: 2,
    accent: '#facc15',
  },
  distribution: {
    label: 'Distribution cable',
    short: 'DISTRIB',
    defaultLengthKm: 1,
    defaultSplices: 2,
    defaultConnectors: 2,
    accent: '#facc15',
  },
  drop: {
    label: 'Drop cable',
    short: 'DROP',
    defaultLengthKm: 0.3,
    defaultSplices: 1,
    defaultConnectors: 2,
    accent: '#facc15',
  },
};

/* -------------------------------------------------------------------------- *
 * Per-element loss standards
 * -------------------------------------------------------------------------- */

/** Fusion splice, per ITU-T practice. */
export const SPLICE_LOSS_DB = 0.1;

/** SC/APC connector pair member loss. */
export const CONNECTOR_LOSS_DB = 0.5;

/** Educational field-fault penalties; actual loss depends on the cable and fault geometry. */
export const MACRO_BEND_PENALTY_DB = 3.5;
export const DIRTY_CONNECTOR_PENALTY_DB = 2.0;

/** Simplified through-splice allowance for the OSP closure model. */
export const CLOSURE_SPLICE_LOSS_MIN_DB = 0.05;
export const CLOSURE_SPLICE_LOSS_MAX_DB = 0.1;
export const DEFAULT_CLOSURE_SPLICE_LOSS_DB = 0.08;
export const CLOSURE_INPUT_PORTS = 2;
export const CLOSURE_OUTPUT_PORTS = 4;
export const SPLICE_TRAY_CHANNEL_COUNT = 12;

/** Two matched ODF adapter pairs; each is an independent through path. */
export const ODF_INPUT_PORTS = ODF_PORT_PAIRS;
export const ODF_OUTPUT_PORTS = ODF_PORT_PAIRS;

export interface SpliceTrayChannel {
  name: string;
  hex: string;
}

/** TIA-598-style color order used for the 12-channel teaching tray. */
export const SPLICE_TRAY_CHANNELS: SpliceTrayChannel[] = [
  { name: 'Blue', hex: '#0072BC' },
  { name: 'Orange', hex: '#F58220' },
  { name: 'Green', hex: '#1A8F3A' },
  { name: 'Brown', hex: '#8B4513' },
  { name: 'Slate', hex: '#808080' },
  { name: 'White', hex: '#F2F2F2' },
  { name: 'Red', hex: '#E31B23' },
  { name: 'Black', hex: '#191919' },
  { name: 'Yellow', hex: '#F8D40A' },
  { name: 'Violet', hex: '#6A3D9A' },
  { name: 'Rose', hex: '#E88BA2' },
  { name: 'Aqua', hex: '#17A6A6' },
];

/** Default system / ageing / repair allowance. */
export const DEFAULT_SAFETY_MARGIN_DB = 2.0;

/* -------------------------------------------------------------------------- *
 * ONT status classification (ITU-T G.984 GPON)
 * -------------------------------------------------------------------------- */

export type OntStatus = 'OVERLOAD' | 'ONLINE' | 'WARNING' | 'LOS' | 'DISCONNECTED';

export interface OntThresholds {
  /** Above this the receiver saturates / risks damage. */
  overloadDbm: number;
  /** Best achievable sensitivity for the ONT class. */
  optimalFloorDbm: number;
  /** Below this the link is marginal (high BER). */
  warningFloorDbm: number;
  /** Below this there is loss of signal. */
  losFloorDbm: number;
}

export const ONT_THRESHOLDS: OntThresholds = {
  overloadDbm: -8.0,
  optimalFloorDbm: -24.0,
  warningFloorDbm: -28.0,
  losFloorDbm: -28.0,
};

export interface StatusStyle {
  label: string;
  /** Badge / LED colour. */
  hex: string;
  /** Tailwind utility classes for badges. */
  badge: string;
  /** Tailwind utility classes for the node ring. */
  ring: string;
  /** Description shown in the inspector + BOM. */
  blurb: string;
}

export const STATUS_STYLES: Record<OntStatus, StatusStyle> = {
  OVERLOAD: {
    label: 'OVERLOAD',
    hex: '#7c3aed',
    badge: 'bg-purple-50 text-purple-800 border-purple-200',
    ring: 'border-purple-500/70 shadow-[0_0_18px_-8px_rgba(124,58,237,0.32)]',
    blurb: 'Receiver saturation — optical burn risk. Add attenuation.',
  },
  ONLINE: {
    label: 'ONLINE',
    hex: '#15803d',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    ring: 'border-emerald-500/70 shadow-[0_0_18px_-8px_rgba(21,128,61,0.28)]',
    blurb: 'Within the GPON optimal receive window.',
  },
  WARNING: {
    label: 'WARNING',
    hex: '#a16207',
    badge: 'bg-amber-50 text-amber-900 border-amber-200',
    ring: 'border-amber-600/70 shadow-[0_0_18px_-8px_rgba(161,98,7,0.25)]',
    blurb: 'Marginal link — high BER risk, service will degrade.',
  },
  LOS: {
    label: 'LOS',
    hex: '#dc2626',
    badge: 'bg-red-50 text-red-800 border-red-200',
    ring: 'border-red-600/70 shadow-[0_0_18px_-8px_rgba(220,38,38,0.28)]',
    blurb: 'Loss of signal — received power below receiver sensitivity.',
  },
  DISCONNECTED: {
    label: 'DISCONNECTED',
    hex: '#64748b',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    ring: 'border-slate-300',
    blurb: 'No active OLT path reaches this ONT.',
  },
};

/* -------------------------------------------------------------------------- *
 * Node data payloads
 * -------------------------------------------------------------------------- */

export type ComponentKind = 'olt' | 'splitter' | 'fiber' | 'closure' | 'ont' | 'odf' | 'nap' | 'gateway';

export interface OltNodeData extends Record<string, unknown> {
  kind: 'olt';
  portName: string;
  oltClass: OltClass;
  txPowerDbm: number;
  laserOn: boolean;
  wavelength: Wavelength;
  /** Omitted only by older saved graphs; legacy OLTs are treated as GPON. */
  ponStandard?: PonStandard;
}

export interface SplitterNodeData extends Record<string, unknown> {
  kind: 'splitter';
  ratio: SplitRatio;
  /** Extra non-ideal loss on top of the catalogue value (uniformity/wavelength). */
  excessLossDb: number;
}

export interface FiberNodeData extends Record<string, unknown> {
  kind: 'fiber';
  cableType: CableType;
  lengthKm: number;
  splices: number;
  connectors: number;
  wavelength: Wavelength;
  /** Manual override of the attenuation coefficient; when set it wins over wavelength. */
  attenuationOverrideDbPerKm: number | null;
  /** Optional simplified field-fault flags; each is a separate explicit loss term. */
  macroBendActive?: boolean;
  dirtyConnectorActive?: boolean;
}

export interface ClosureNodeData extends Record<string, unknown> {
  kind: 'closure';
  /** Representative through-splice allowance, clamped to the educational 0.05–0.10 dB range. */
  spliceLossDb: number;
  /** Twelve tray occupancy flags; channels 1–4 map to the four modeled branch handles. */
  activeSpliceChannels: boolean[];
}

export interface OntNodeData extends Record<string, unknown> {
  kind: 'ont';
  serial: string;
  subscriber: string;
  /** Receive sensitivity of the installed ONT (informational, thresholds are global). */
  sensitivityDbm: number;
}

export interface OdfNodeData extends Record<string, unknown> {
  kind: 'odf';
  /** Illustrative adapter/through-port insertion allowance. */
  throughPortLossDb: number;
}

export interface NapNodeData extends Record<string, unknown> {
  kind: 'nap';
  /** Reference insertion loss for the internal fixed 1:8 splitter. */
  splitLossDb: number;
}

export interface GatewayNodeData extends Record<string, unknown> {
  kind: 'gateway';
  serial: string;
  subscriber: string;
  ssid: string;
  /** Reserved TEST-NET address used only as an educational service-state placeholder. */
  serviceIpAddress: string;
  /** Informational receiver sensitivity; shared status thresholds remain global. */
  sensitivityDbm: number;
}

export type AnyNodeData =
  | OltNodeData
  | SplitterNodeData
  | FiberNodeData
  | ClosureNodeData
  | OntNodeData
  | OdfNodeData
  | NapNodeData
  | GatewayNodeData;

export type OltNode = Node<OltNodeData, 'olt'>;
export type SplitterNode = Node<SplitterNodeData, 'splitter'>;
export type FiberNode = Node<FiberNodeData, 'fiber'>;
export type ClosureNode = Node<ClosureNodeData, 'closure'>;
export type OntNode = Node<OntNodeData, 'ont'>;
export type OdfNode = Node<OdfNodeData, 'odf'>;
export type NapNode = Node<NapNodeData, 'nap'>;
export type GatewayNode = Node<GatewayNodeData, 'gateway'>;
export type SubscriberEndpointNode = OntNode | GatewayNode;
export type PonNode = OltNode | SplitterNode | FiberNode | ClosureNode | OntNode | OdfNode | NapNode | GatewayNode;

/** Edge payload — carries the optical state produced by the simulator. */
export interface FiberEdgeData extends Record<string, unknown> {
  /** Optical power at the far end of this edge, dBm. `null` when no light flows. */
  powerDbm: number | null;
  edgeState: EdgeState;
  /** Non-empty on the output patch cord of a faulted cable span. */
  faultLabels?: string[];
}

export type EdgeState = 'live' | 'degraded' | 'idle';

export type PonEdge = Edge<FiberEdgeData>;

/* -------------------------------------------------------------------------- *
 * Simulation telemetry
 * -------------------------------------------------------------------------- */

export interface LossSegment {
  nodeId: string | null;
  component: 'fiber' | 'splitter' | 'splice' | 'connector' | 'fault' | 'margin' | 'olt' | 'odf' | 'nap';
  label: string;
  lossDb: number;
}

export interface OpticalPath {
  oltId: string;
  oltPort: string;
  /** Ordered node ids from the OLT to the subscriber endpoint (inclusive). */
  nodeIds: string[];
  txPowerDbm: number;
  totalLossDb: number;
  rxPowerDbm: number;
  segments: LossSegment[];
  fiberKm: number;
  splitStages: number;
  cumulativeSplitRatio: number;
  splices: number;
  connectors: number;
  wavelength: Wavelength;
  ponStandard: PonStandard;
}

export interface SubscriberOpticalTelemetry {
  status: OntStatus;
  rxPowerDbm: number | null;
  totalLossDb: number;
  /** Distance from the subscriber receiver's illustrative worst acceptable floor (-28 dBm). */
  marginDb: number;
  /** Distance from the overload ceiling (-8 dBm). */
  headroomDb: number;
  sourceOltId: string | null;
  fiberKm: number;
  splitStages: number;
  cumulativeSplitRatio: number;
  splices: number;
  connectors: number;
  segments: LossSegment[];
  candidatePaths: OpticalPath[];
}

export interface OntTelemetry extends SubscriberOpticalTelemetry {
  ontId: string;
}

export interface GatewayTelemetry extends SubscriberOpticalTelemetry {
  gatewayId: string;
  ssid: string;
  /** Reserved TEST-NET address placeholder; not assigned by a simulated DHCP service. */
  serviceIpAddress: string;
  ponStandard: PonStandard | null;
  downstreamLineRateGbps: number | null;
  upstreamLineRateGbps: number | null;
  /** Topology-derived equal-share PON rate estimate, not an Internet speed test. */
  estimatedDownMbps: number | null;
  estimatedUpMbps: number | null;
}

export interface EdgeTelemetry {
  powerDbm: number | null;
  edgeState: EdgeState;
}

export interface NetworkSummary {
  ontCount: number;
  gatewayCount: number;
  /** ONTs plus Wi-Fi gateways represented as subscriber endpoints. */
  subscriberCount: number;
  /** Statuses and power statistics include both endpoint types. */
  byStatus: Record<OntStatus, number>;
  totalFiberKm: number;
  totalSplices: number;
  totalConnectors: number;
  splitterCountByRatio: Partial<Record<SplitRatio, number>>;
  splitterTotal: number;
  oltCount: number;
  oltActive: number;
  /** Mean received power across all subscriber endpoints that have signal. */
  meanRxDbm: number | null;
  worstRxDbm: number | null;
  /** True when every subscriber endpoint sits inside the optimal window. */
  allOptimal: boolean;
  hasFault: boolean;
}

export interface SimulationResult {
  ontTelemetry: Record<string, OntTelemetry>;
  gatewayTelemetry: Record<string, GatewayTelemetry>;
  /** Best path per ONT or gateway id. */
  bestPaths: Record<string, OpticalPath>;
  edgeTelemetry: Record<string, EdgeTelemetry>;
  summary: NetworkSummary;
  /** Monotonic counter so consumers can animate on re-run. */
  runId: number;
  safetyMarginDb: number;
  computedAt: number;
}

/* -------------------------------------------------------------------------- *
 * Global design settings
 * -------------------------------------------------------------------------- */

export interface DesignSettings {
  safetyMarginDb: number;
  /** When true the simulator recalculates on every edit. */
  autoRun: boolean;
}

export const DEFAULT_SETTINGS: DesignSettings = {
  safetyMarginDb: DEFAULT_SAFETY_MARGIN_DB,
  autoRun: true,
};

/* -------------------------------------------------------------------------- *
 * Exportable topology document
 * -------------------------------------------------------------------------- */

export interface TopologyExport {
  format: 'ftth-studio/topology';
  version: 2;
  exportedAt: string;
  settings: DesignSettings;
  nodes: PonNode[];
  edges: PonEdge[];
  simulation: {
    summary: NetworkSummary;
    ontTelemetry: Record<string, OntTelemetry>;
    gatewayTelemetry: Record<string, GatewayTelemetry>;
  };
  commercial: {
    currency: 'USD';
    unitCosts: UnitCostProfile;
    breakdown: NetworkCostBreakdown;
    connectedSubscriberCount: number;
    costPerConnectedSubscriber: number;
  };
}

/* -------------------------------------------------------------------------- *
 * Node factory signatures (used by the toolbox + presets)
 * -------------------------------------------------------------------------- */

export interface NodeFactory {
  data: AnyNodeData;
  /** Canvas size hint so presets can lay out cleanly. */
  width: number;
  height: number;
}
