import type {
  CableType,
  ClosureNodeData,
  FiberNodeData,
  GatewayNodeData,
  NapNodeData,
  OdfNodeData,
  OltClass,
  OltNodeData,
  OntNodeData,
  PonNode,
  SplitRatio,
  SplitterNodeData,
} from '../types';
import {
  CABLE_SPECS,
  CLOSURE_OUTPUT_PORTS,
  DEFAULT_CLOSURE_SPLICE_LOSS_DB,
  DEFAULT_ODF_THROUGH_PORT_LOSS_DB,
  NAP_SPLIT_LOSS_DB,
  OLT_CLASS_SPECS,
  SPLICE_TRAY_CHANNEL_COUNT,
} from '../types';

/* ========================================================================== *
 * Node factories — single source of truth for defaults, used by the toolbox,
 * the canvas drop handler and the preset topologies.
 * ========================================================================== */

let sequence = 0;

export function nextId(kind: string): string {
  sequence += 1;
  return `${kind}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

export interface NodePlacement {
  id?: string;
  position?: { x: number; y: number };
}

export const NODE_SIZES: Record<string, { width: number; height: number }> = {
  olt: { width: 248, height: 136 },
  splitter: { width: 188, height: 132 },
  fiber: { width: 168, height: 108 },
  closure: { width: 208, height: 144 },
  ont: { width: 208, height: 138 },
  odf: { width: 208, height: 132 },
  nap: { width: 208, height: 156 },
  gateway: { width: 224, height: 164 },
};

let ontSequence = 0;

export function createOltNode(placement: NodePlacement = {}): PonNode {
  const oltClass: OltClass = 'B+';
  const data: OltNodeData = {
    kind: 'olt',
    portName: 'PON 0/1/0',
    oltClass,
    txPowerDbm: OLT_CLASS_SPECS[oltClass].txPowerDbm,
    laserOn: true,
    wavelength: 1490,
    ponStandard: 'GPON',
  };
  return {
    id: placement.id ?? nextId('olt'),
    type: 'olt',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}

export function createSplitterNode(ratio: SplitRatio = 8, placement: NodePlacement = {}): PonNode {
  const data: SplitterNodeData = {
    kind: 'splitter',
    ratio,
    excessLossDb: 0,
  };
  return {
    id: placement.id ?? nextId('splitter'),
    type: 'splitter',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}

export function createFiberNode(cableType: CableType = 'distribution', placement: NodePlacement = {}): PonNode {
  const spec = CABLE_SPECS[cableType];
  const data: FiberNodeData = {
    kind: 'fiber',
    cableType,
    lengthKm: spec.defaultLengthKm,
    splices: spec.defaultSplices,
    connectors: spec.defaultConnectors,
    wavelength: 1490,
    attenuationOverrideDbPerKm: null,
  };
  return {
    id: placement.id ?? nextId('fiber'),
    type: 'fiber',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}

export function createClosureNode(placement: NodePlacement = {}): PonNode {
  const data: ClosureNodeData = {
    kind: 'closure',
    spliceLossDb: DEFAULT_CLOSURE_SPLICE_LOSS_DB,
    activeSpliceChannels: Array.from(
      { length: SPLICE_TRAY_CHANNEL_COUNT },
      (_, index) => index < CLOSURE_OUTPUT_PORTS,
    ),
  };
  return {
    id: placement.id ?? nextId('closure'),
    type: 'closure',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}

export function createOntNode(placement: NodePlacement = {}, serial?: string, subscriber?: string): PonNode {
  ontSequence += 1;
  const data: OntNodeData = {
    kind: 'ont',
    serial: serial ?? `HWTC${(100000 + ontSequence).toString().padStart(8, '0')}`,
    subscriber: subscriber ?? `Subscriber ${ontSequence}`,
    sensitivityDbm: -28,
  };
  return {
    id: placement.id ?? nextId('ont'),
    type: 'ont',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}

export function createOdfNode(placement: NodePlacement = {}): PonNode {
  const data: OdfNodeData = {
    kind: 'odf',
    throughPortLossDb: DEFAULT_ODF_THROUGH_PORT_LOSS_DB,
  };
  return {
    id: placement.id ?? nextId('odf'),
    type: 'odf',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}

export function createNapNode(placement: NodePlacement = {}): PonNode {
  const data: NapNodeData = {
    kind: 'nap',
    splitLossDb: NAP_SPLIT_LOSS_DB,
  };
  return {
    id: placement.id ?? nextId('nap'),
    type: 'nap',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}

let gatewaySequence = 0;

export function createGatewayNode(
  placement: NodePlacement = {},
  serial?: string,
  subscriber?: string,
  ssid?: string,
): PonNode {
  gatewaySequence += 1;
  const suffix = String(gatewaySequence).padStart(2, '0');
  const data: GatewayNodeData = {
    kind: 'gateway',
    serial: serial ?? `FLGW${String(100000 + gatewaySequence).padStart(8, '0')}`,
    subscriber: subscriber ?? `Gateway Home ${gatewaySequence}`,
    ssid: ssid ?? `FiberLAB-${suffix}`,
    serviceIpAddress: `192.0.2.${100 + ((gatewaySequence - 1) % 150)}`,
    sensitivityDbm: -28,
  };
  return {
    id: placement.id ?? nextId('gateway'),
    type: 'gateway',
    position: placement.position ?? { x: 0, y: 0 },
    data,
  };
}
