import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types';
import { buildCommercialCsv, buildQuotationExport } from '../commercialQuoteExports';
import { buildPreset } from '../../engine/presets';
import { simulateTopology } from '../../engine/opticalSimulator';
import { calculateNetworkCost, DEFAULT_UNIT_COSTS } from '../pricingCatalogue';

describe('commercial quotation exports', () => {
  it('exports a versioned JSON topology with unit pricing, quotation lines, and connected-home metrics', () => {
    const topology = buildPreset('standard-1x32');
    if (!topology) throw new Error('The standard learning topology is missing.');
    const simulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
    const costBreakdown = calculateNetworkCost(topology.nodes, topology.edges);
    const quote = buildQuotationExport(
      topology.nodes,
      topology.edges,
      simulation,
      DEFAULT_SETTINGS,
      DEFAULT_UNIT_COSTS,
      costBreakdown,
    );

    expect(quote.version).toBe(2);
    expect(quote.commercial.currency).toBe('USD');
    expect(quote.commercial.unitCosts.cablePerKm.feeder).toBe(350);
    expect(quote.commercial.breakdown.totalCapex).toBe(3747);
    expect(quote.commercial.connectedSubscriberCount).toBe(3);
    expect(quote.commercial.costPerConnectedSubscriber).toBe(1249);
    expect(quote.simulation.ontTelemetry['ont-a3'].status).toBe('WARNING');
  });

  it('exports gateway service telemetry and the simulated TEST-NET address in JSON and CSV', () => {
    const topology = buildPreset('modern-10g-xgs-pon-suburb');
    if (!topology) throw new Error('The modern XGS-PON suburb preset is missing.');
    const simulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
    const costBreakdown = calculateNetworkCost(topology.nodes, topology.edges);
    const quote = buildQuotationExport(
      topology.nodes,
      topology.edges,
      simulation,
      DEFAULT_SETTINGS,
      DEFAULT_UNIT_COSTS,
      costBreakdown,
    );
    const csv = buildCommercialCsv(topology.nodes, simulation, costBreakdown);

    expect(quote.simulation.summary.gatewayCount).toBe(3);
    expect(quote.simulation.gatewayTelemetry['gateway-xgs-1']).toMatchObject({
      ponStandard: 'XGS-PON',
      ssid: 'FiberLAB-XGS-01',
      serviceIpAddress: '192.0.2.101',
      estimatedDownMbps: 1244.13,
      estimatedUpMbps: 1244.13,
    });
    expect(csv).toContain('"service_ip_address"');
    const gatewayRow = csv.split('\n').find((row) => row.includes('"gateway-xgs-1"'));
    expect(gatewayRow).toContain('"FiberLAB-XGS-01"');
    expect(gatewayRow).toContain('"192.0.2.101"');
    expect(gatewayRow).toContain('"XGS-PON"');
  });

  it('exports quotation rows and optical audit rows together in a well-formed CSV schema', () => {
    const topology = buildPreset('standard-1x32');
    if (!topology) throw new Error('The standard learning topology is missing.');
    const simulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
    const costBreakdown = calculateNetworkCost(topology.nodes, topology.edges);
    const csv = buildCommercialCsv(topology.nodes, simulation, costBreakdown);

    expect(csv).toContain('"total_capex_usd"');
    expect(csv).toContain('"cost_per_connected_subscriber_usd"');
    expect(csv).toContain('"quotation_line","Cables","Feeder / OSP cable","5","km","350","1750"');
    expect(csv).toContain('"quotation_line","Labor & Splicing","Fusion splice labor"');
    expect(csv).toContain('"optical_budget"');
    expect(csv).toContain('"ont-a3"');
  });
});
