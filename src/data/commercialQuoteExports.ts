import type { DesignSettings, PonEdge, PonNode, SimulationResult, TopologyExport } from '../types';
import type { NetworkCostBreakdown, UnitCostProfile } from './pricingCatalogue';

/* ========================================================================== *
 * Commercial quotation exports — pure, React-free helpers shared by the BOM
 * modal and the export tests. Keeping them out of the component module keeps
 * the UI file component-only (and fast-refresh friendly).
 * ========================================================================== */

export function connectedSubscriberCount(nodes: PonNode[], simulation: SimulationResult): number {
  return nodes.filter(
    (node) => (node.type === 'ont' || node.type === 'gateway') && Boolean(simulation.bestPaths[node.id]),
  ).length;
}

export function buildQuotationExport(
  nodes: PonNode[],
  edges: PonEdge[],
  simulation: SimulationResult,
  settings: DesignSettings,
  unitCosts: UnitCostProfile,
  costBreakdown: NetworkCostBreakdown,
): TopologyExport {
  const connectedCount = connectedSubscriberCount(nodes, simulation);
  return {
    format: 'ftth-studio/topology',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    nodes,
    edges,
    simulation: {
      summary: simulation.summary,
      ontTelemetry: simulation.ontTelemetry,
      gatewayTelemetry: simulation.gatewayTelemetry,
    },
    commercial: {
      currency: 'USD',
      unitCosts,
      breakdown: costBreakdown,
      connectedSubscriberCount: connectedCount,
      costPerConnectedSubscriber:
        connectedCount === 0 ? 0 : Math.round((costBreakdown.totalCapex / connectedCount + Number.EPSILON) * 100) / 100,
    },
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** One quotation/summary section and the existing per-ONT optical audit in one CSV. */
export function buildCommercialCsv(
  nodes: PonNode[],
  simulation: SimulationResult,
  costBreakdown: NetworkCostBreakdown,
): string {
  const headers = [
    'record_type',
    'category',
    'item',
    'quantity',
    'unit',
    'unit_price_usd',
    'extended_price_usd',
    'materials_cost_usd',
    'labor_cost_usd',
    'total_capex_usd',
    'cost_per_home_passed_usd',
    'cost_per_connected_subscriber_usd',
    'ont_id',
    'subscriber',
    'serial',
    'ssid',
    'service_ip_address',
    'pon_standard',
    'estimated_down_mbps',
    'estimated_up_mbps',
    'status',
    'rx_power_dbm',
    'total_path_loss_db',
    'link_margin_db',
    'fiber_km',
    'split_stages',
    'cumulative_split_ratio',
    'splices',
    'connectors',
    'source_olt',
    'endpoint_type',
  ];
  const connectedCount = connectedSubscriberCount(nodes, simulation);
  const costPerConnected =
    connectedCount === 0 ? 0 : Math.round((costBreakdown.totalCapex / connectedCount + Number.EPSILON) * 100) / 100;
  const serialize = (record: Record<string, unknown>) => headers.map((header) => csvCell(record[header])).join(',');

  const rows = [
    serialize({
      record_type: 'quotation_summary',
      category: 'Summary',
      item: 'Project CAPEX summary',
      unit: 'USD',
      materials_cost_usd: costBreakdown.materialsCost,
      labor_cost_usd: costBreakdown.laborCost,
      total_capex_usd: costBreakdown.totalCapex,
      cost_per_home_passed_usd: costBreakdown.costPerHomePassed,
      cost_per_connected_subscriber_usd: costPerConnected,
    }),
    ...costBreakdown.lineItems.map((line) =>
      serialize({
        record_type: 'quotation_line',
        category: line.category,
        item: line.item,
        quantity: line.quantity,
        unit: line.unit,
        unit_price_usd: line.unitPrice,
        extended_price_usd: line.totalPrice,
      }),
    ),
    ...nodes
      .filter((node) => node.type === 'ont' || node.type === 'gateway')
      .map((node) => {
        const telemetry = node.type === 'ont' ? simulation.ontTelemetry[node.id] : simulation.gatewayTelemetry[node.id];
        const gatewayReading = node.type === 'gateway' ? simulation.gatewayTelemetry[node.id] : undefined;
        if (!telemetry) return null;
        return serialize({
          record_type: 'optical_budget',
          endpoint_type: node.type,
          ont_id: node.id,
          subscriber: node.data.subscriber,
          serial: node.data.serial,
          ssid: node.type === 'gateway' ? node.data.ssid : '',
          service_ip_address: gatewayReading?.serviceIpAddress ?? '',
          pon_standard: gatewayReading?.ponStandard ?? simulation.bestPaths[node.id]?.ponStandard ?? '',
          estimated_down_mbps: gatewayReading?.estimatedDownMbps ?? '',
          estimated_up_mbps: gatewayReading?.estimatedUpMbps ?? '',
          status: telemetry.status,
          rx_power_dbm: telemetry.rxPowerDbm,
          total_path_loss_db: telemetry.totalLossDb,
          link_margin_db: telemetry.rxPowerDbm === null ? '' : telemetry.marginDb,
          fiber_km: telemetry.fiberKm,
          split_stages: telemetry.splitStages,
          cumulative_split_ratio: telemetry.cumulativeSplitRatio,
          splices: telemetry.splices,
          connectors: telemetry.connectors,
          source_olt: telemetry.sourceOltId ?? '',
        });
      })
      .filter((row): row is string => row !== null),
  ];

  return [headers.map(csvCell).join(','), ...rows].join('\n');
}
