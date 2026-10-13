import type { CableType, PonEdge, PonNode, SplitRatio } from '../types';

/** Reference USD unit rates for educational planning, not a supplier quotation. */
export interface UnitCostProfile {
  cablePerKm: Record<CableType, number>;
  laborPerSplice: number;
  connectorPerEnd: number;
  splitterByRatio: Record<string, number>;
  foscClosure: number;
  odfRackPanel: number;
  napFat: number;
  oltPortModule: number;
  ontTerminal: number;
  wifi6Gateway: number;
}

/** Nested, partial overrides are convenient for a local market-rate edit. */
export type PartialUnitCostProfile =
  Partial<Omit<UnitCostProfile, 'cablePerKm' | 'splitterByRatio'>> & {
    cablePerKm?: Partial<Record<CableType, number>>;
    splitterByRatio?: Partial<Record<string, number>>;
  };

export const DEFAULT_UNIT_COSTS: UnitCostProfile = {
  cablePerKm: { feeder: 350, distribution: 250, drop: 150 },
  laborPerSplice: 12.5,
  connectorPerEnd: 4,
  splitterByRatio: {
    '1:2': 14,
    '1:4': 18,
    '1:8': 26,
    '1:16': 42,
    '1:32': 68,
    '1:64': 120,
  },
  foscClosure: 85,
  odfRackPanel: 110,
  napFat: 65,
  oltPortModule: 240,
  ontTerminal: 55,
  wifi6Gateway: 85,
};

export type CostCategory = 'Cables' | 'Passives' | 'Active Gear' | 'Labor & Splicing';

export interface NetworkCostLineItem {
  category: CostCategory;
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface NetworkCostBreakdown {
  materialsCost: number;
  laborCost: number;
  totalCapex: number;
  costPerHomePassed: number;
  lineItems: NetworkCostLineItem[];
}

export const SPLITTER_COST_RATIOS: readonly SplitRatio[] = [2, 4, 8, 16, 32, 64];

const CABLE_COST_ITEMS: ReadonlyArray<{ type: CableType; label: string }> = [
  { type: 'feeder', label: 'Feeder / OSP cable' },
  { type: 'distribution', label: 'Distribution cable' },
  { type: 'drop', label: 'Drop cable' },
];

const money = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100;

function sanitizedRate(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sanitizedQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** Deep-merge local overrides over the complete reference price list. */
export function resolveUnitCosts(overrides: PartialUnitCostProfile = {}): UnitCostProfile {
  const cableOverrides = overrides.cablePerKm ?? {};
  const splitterOverrides = overrides.splitterByRatio ?? {};
  const splitterByRatio = { ...DEFAULT_UNIT_COSTS.splitterByRatio };

  for (const ratio of SPLITTER_COST_RATIOS) {
    const key = `1:${ratio}`;
    splitterByRatio[key] = sanitizedRate(splitterOverrides[key], DEFAULT_UNIT_COSTS.splitterByRatio[key]);
  }

  return {
    cablePerKm: {
      feeder: sanitizedRate(cableOverrides.feeder, DEFAULT_UNIT_COSTS.cablePerKm.feeder),
      distribution: sanitizedRate(cableOverrides.distribution, DEFAULT_UNIT_COSTS.cablePerKm.distribution),
      drop: sanitizedRate(cableOverrides.drop, DEFAULT_UNIT_COSTS.cablePerKm.drop),
    },
    laborPerSplice: sanitizedRate(overrides.laborPerSplice, DEFAULT_UNIT_COSTS.laborPerSplice),
    connectorPerEnd: sanitizedRate(overrides.connectorPerEnd, DEFAULT_UNIT_COSTS.connectorPerEnd),
    splitterByRatio,
    foscClosure: sanitizedRate(overrides.foscClosure, DEFAULT_UNIT_COSTS.foscClosure),
    odfRackPanel: sanitizedRate(overrides.odfRackPanel, DEFAULT_UNIT_COSTS.odfRackPanel),
    napFat: sanitizedRate(overrides.napFat, DEFAULT_UNIT_COSTS.napFat),
    oltPortModule: sanitizedRate(overrides.oltPortModule, DEFAULT_UNIT_COSTS.oltPortModule),
    ontTerminal: sanitizedRate(overrides.ontTerminal, DEFAULT_UNIT_COSTS.ontTerminal),
    wifi6Gateway: sanitizedRate(overrides.wifi6Gateway, DEFAULT_UNIT_COSTS.wifi6Gateway),
  };
}

function connectedActiveClosureSplices(node: Extract<PonNode, { type: 'closure' }>, edges: PonEdge[]): number {
  const channels = node.data.activeSpliceChannels ?? [];
  const connected = new Set<number>();

  for (const edge of edges) {
    if (edge.source !== node.id) continue;
    const match = /^out-(\d+)$/.exec(edge.sourceHandle ?? 'out-0');
    const channel = match ? Number(match[1]) : 0;
    if (Number.isInteger(channel) && channel >= 0 && channel < 4 && channels[channel]) {
      connected.add(channel);
    }
  }

  return connected.size;
}

/**
 * Build a deterministic, topology-derived CAPEX estimate. Patch cords are
 * graph relationships and have no separate price in this baseline catalogue.
 * All reference prices are USD; local unit-rate overrides do not touch physics.
 */
export function calculateNetworkCost(
  nodes: PonNode[],
  edges: PonEdge[],
  customCosts?: PartialUnitCostProfile,
): NetworkCostBreakdown {
  const costs = resolveUnitCosts(customCosts);
  const lineItems: NetworkCostLineItem[] = [];

  const addLineItem = (
    category: CostCategory,
    item: string,
    rawQuantity: number,
    unit: string,
    unitPrice: number,
  ) => {
    const quantity = sanitizedQuantity(rawQuantity);
    if (quantity <= 0) return;
    lineItems.push({
      category,
      item,
      quantity,
      unit,
      unitPrice,
      totalPrice: money(quantity * unitPrice),
    });
  };

  for (const cable of CABLE_COST_ITEMS) {
    const lengthKm = nodes.reduce((sum, node) => (
      node.type === 'fiber' && node.data.cableType === cable.type
        ? sum + sanitizedQuantity(node.data.lengthKm)
        : sum
    ), 0);
    addLineItem('Cables', cable.label, lengthKm, 'km', costs.cablePerKm[cable.type]);
  }

  for (const ratio of SPLITTER_COST_RATIOS) {
    const quantity = nodes.filter((node) => node.type === 'splitter' && node.data.ratio === ratio).length;
    addLineItem('Passives', `PLC splitter 1:${ratio}`, quantity, 'each', costs.splitterByRatio[`1:${ratio}`]);
  }

  const closureCount = nodes.filter((node) => node.type === 'closure').length;
  addLineItem('Passives', 'Dome splice closure (FOSC-style reference)', closureCount, 'each', costs.foscClosure);

  const odfCount = nodes.filter((node) => node.type === 'odf').length;
  addLineItem('Passives', 'ODF rack / 2-pair patch panel (reference)', odfCount, 'each', costs.odfRackPanel);

  const napCount = nodes.filter((node) => node.type === 'nap').length;
  addLineItem('Passives', 'Outdoor NAP/FAT with internal 1:8 splitter (reference)', napCount, 'each', costs.napFat);

  const oltCount = nodes.filter((node) => node.type === 'olt').length;
  addLineItem('Active Gear', 'OLT PON port module (C+ reference)', oltCount, 'each', costs.oltPortModule);

  const ontCount = nodes.filter((node) => node.type === 'ont').length;
  addLineItem('Active Gear', 'Customer ONT terminal', ontCount, 'each', costs.ontTerminal);

  const gatewayCount = nodes.filter((node) => node.type === 'gateway').length;
  addLineItem('Active Gear', 'Wi-Fi 6 PON gateway (reference)', gatewayCount, 'each', costs.wifi6Gateway);
  const homeCount = ontCount + gatewayCount;

  const fiberSpliceCount = nodes.reduce((sum, node) => (
    node.type === 'fiber' ? sum + sanitizedQuantity(node.data.splices) : sum
  ), 0);
  const closureSpliceCount = nodes.reduce((sum, node) => (
    node.type === 'closure' ? sum + connectedActiveClosureSplices(node, edges) : sum
  ), 0);
  addLineItem(
    'Labor & Splicing',
    'Fusion splice labor',
    fiberSpliceCount + closureSpliceCount,
    'splice',
    costs.laborPerSplice,
  );

  const connectorCount = nodes.reduce((sum, node) => (
    node.type === 'fiber' ? sum + sanitizedQuantity(node.data.connectors) : sum
  ), 0);
  addLineItem(
    'Labor & Splicing',
    'SC/APC connector termination',
    connectorCount,
    'connector end',
    costs.connectorPerEnd,
  );

  const materialsCost = money(lineItems
    .filter((line) => line.category !== 'Labor & Splicing')
    .reduce((sum, line) => sum + line.totalPrice, 0));
  const laborCost = money(lineItems
    .filter((line) => line.category === 'Labor & Splicing')
    .reduce((sum, line) => sum + line.totalPrice, 0));
  const totalCapex = money(materialsCost + laborCost);

  return {
    materialsCost,
    laborCost,
    totalCapex,
    costPerHomePassed: homeCount === 0 ? 0 : money(totalCapex / homeCount),
    lineItems,
  };
}

export function formatUsd(amount: number, compact = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
