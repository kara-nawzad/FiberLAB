import { describe, expect, it } from 'vitest';
import { calculateNetworkCost, DEFAULT_UNIT_COSTS } from '../../data/pricingCatalogue';
import { buildPreset } from '../presets';
import { simulateTopology } from '../opticalSimulator';
import { createGatewayNode, createNapNode, createOdfNode, createOltNode } from '../factories';
import {
  ATTENUATION_DB_PER_KM,
  DEFAULT_SETTINGS,
  PON_STANDARD_SPECS,
  type PonEdge,
  type PonNode,
} from '../../types';

describe('GPON and XGS-PON equipment extension', () => {
  it('adds the XGS-PON wavelength and symmetric line-rate references without replacing 1550 nm', () => {
    expect(PON_STANDARD_SPECS.GPON).toMatchObject({
      downstreamWavelength: 1490,
      upstreamWavelength: 1310,
      downstreamGbps: 2.488,
      upstreamGbps: 1.244,
    });
    expect(PON_STANDARD_SPECS['XGS-PON']).toMatchObject({
      downstreamWavelength: 1577,
      upstreamWavelength: 1270,
      downstreamGbps: 9.953,
      upstreamGbps: 9.953,
    });
    expect(ATTENUATION_DB_PER_KM[1270]).toBe(0.35);
    expect(ATTENUATION_DB_PER_KM[1550]).toBe(0.2);
    expect(ATTENUATION_DB_PER_KM[1577]).toBe(0.22);
  });

  it('creates ODF, NAP, and Wi-Fi gateway defaults with the requested port/loss data', () => {
    expect(createOltNode({ id: 'factory-olt' })).toMatchObject({
      type: 'olt',
      data: { ponStandard: 'GPON', wavelength: 1490 },
    });
    expect(createOdfNode({ id: 'factory-odf' })).toMatchObject({
      type: 'odf',
      data: { throughPortLossDb: 0.5 },
    });
    expect(createNapNode({ id: 'factory-nap' })).toMatchObject({
      type: 'nap',
      data: { splitLossDb: 10.5 },
    });
    expect(createGatewayNode({ id: 'factory-gateway' })).toMatchObject({
      type: 'gateway',
      data: {
        ssid: expect.stringMatching(/^FiberLAB-/),
        serviceIpAddress: expect.stringMatching(/^192\.0\.2\./),
        sensitivityDbm: -28,
      },
    });
  });

  it('builds and simulates the selectable modern XGS-PON suburb preset', () => {
    const topology = buildPreset('modern-10g-xgs-pon-suburb');
    if (!topology) throw new Error('The modern XGS-PON suburb preset is missing.');

    const { nodes, edges } = topology;
    const olt = nodes.find((node) => node.type === 'olt');
    const odf = nodes.find((node) => node.type === 'odf');
    const feeder = nodes.find((node) => node.type === 'fiber' && node.data.cableType === 'feeder');
    const closure = nodes.find((node) => node.type === 'closure');
    const distribution = nodes.find((node) => node.type === 'fiber' && node.data.cableType === 'distribution');
    const nap = nodes.find((node) => node.type === 'nap');
    const drops = nodes.filter((node) => node.type === 'fiber' && node.data.cableType === 'drop');
    const gateways = nodes.filter((node) => node.type === 'gateway');

    expect(olt).toMatchObject({ data: { ponStandard: 'XGS-PON', wavelength: 1577 } });
    expect(odf).toMatchObject({ data: { throughPortLossDb: 0.5 } });
    expect(feeder).toMatchObject({ data: { lengthKm: 3.5, wavelength: 1577 } });
    expect(closure).toBeDefined();
    expect(distribution).toMatchObject({ data: { lengthKm: 1.2 } });
    expect(nap).toMatchObject({ data: { splitLossDb: 10.5 } });
    expect(drops).toHaveLength(3);
    expect(drops.every((drop) => drop.type === 'fiber' && drop.data.lengthKm === 0.15)).toBe(true);
    expect(gateways).toHaveLength(3);
    expect(edges).toHaveLength(11);

    const simulation = simulateTopology(nodes, edges, DEFAULT_SETTINGS);
    expect(simulation.summary).toMatchObject({
      ontCount: 0,
      gatewayCount: 3,
      subscriberCount: 3,
      byStatus: { ONLINE: 3, DISCONNECTED: 0 },
      allOptimal: true,
    });

    const telemetry = simulation.gatewayTelemetry['gateway-xgs-1'];
    expect(telemetry).toMatchObject({
      status: 'ONLINE',
      ponStandard: 'XGS-PON',
      downstreamLineRateGbps: 9.953,
      upstreamLineRateGbps: 9.953,
      estimatedDownMbps: 1244.13,
      estimatedUpMbps: 1244.13,
      ssid: 'FiberLAB-XGS-01',
      serviceIpAddress: '192.0.2.101',
    });
    expect(telemetry.rxPowerDbm).toBeCloseTo(-12.45, 2);
    expect(telemetry.cumulativeSplitRatio).toBe(8);
    expect(simulation.bestPaths['gateway-xgs-1'].wavelength).toBe(1577);
    expect(telemetry.segments.some((segment) => segment.component === 'odf' && segment.lossDb === 0.5)).toBe(true);
    expect(telemetry.segments.some((segment) => segment.component === 'nap' && segment.lossDb === 10.5)).toBe(true);
    expect(telemetry.segments.some((segment) => segment.label.includes('0.22 dB/km @ 1577 nm'))).toBe(true);
  });

  it('reconciles the requested new equipment reference prices in CAPEX', () => {
    const topology = buildPreset('modern-10g-xgs-pon-suburb');
    if (!topology) throw new Error('The modern XGS-PON suburb preset is missing.');
    const quote = calculateNetworkCost(topology.nodes, topology.edges);

    expect(DEFAULT_UNIT_COSTS.odfRackPanel).toBe(110);
    expect(DEFAULT_UNIT_COSTS.napFat).toBe(65);
    expect(DEFAULT_UNIT_COSTS.wifi6Gateway).toBe(85);
    expect(quote.lineItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ item: 'ODF rack / 2-pair patch panel (reference)', quantity: 1, unitPrice: 110, totalPrice: 110 }),
      expect.objectContaining({ item: 'Outdoor NAP/FAT with internal 1:8 splitter (reference)', quantity: 1, unitPrice: 65, totalPrice: 65 }),
      expect.objectContaining({ item: 'Wi-Fi 6 PON gateway (reference)', quantity: 3, unitPrice: 85, totalPrice: 255 }),
    ]));
    expect(quote.costPerHomePassed).toBeCloseTo(quote.totalCapex / 3, 2);
    expect(quote.lineItems.reduce((sum, line) => sum + line.totalPrice, 0)).toBe(quote.totalCapex);
  });

  it('keeps ODF input/output pairs isolated instead of crossing them', () => {
    const olt = createOltNode({ id: 'odf-pair-olt' });
    const odf = createOdfNode({ id: 'odf-pair-panel' });
    const gateway = createGatewayNode({ id: 'odf-pair-gateway' });
    const fiber: PonNode = {
      id: 'odf-pair-span',
      type: 'fiber',
      position: { x: 0, y: 0 },
      data: {
        kind: 'fiber',
        cableType: 'feeder',
        lengthKm: 0,
        splices: 0,
        connectors: 0,
        wavelength: 1490,
        attenuationOverrideDbPerKm: null,
      },
    };
    if (olt.type !== 'olt' || odf.type !== 'odf' || gateway.type !== 'gateway') {
      throw new Error('An ODF test factory returned an unexpected node.');
    }
    const nodes: PonNode[] = [olt, odf, fiber, gateway];
    const edges: PonEdge[] = [
      { id: 'pair-in', source: olt.id, sourceHandle: 'out', target: odf.id, targetHandle: 'in-1', type: 'optical' },
      { id: 'wrong-pair-out', source: odf.id, sourceHandle: 'out-0', target: fiber.id, targetHandle: 'in', type: 'optical' },
      { id: 'pair-span', source: fiber.id, sourceHandle: 'out', target: gateway.id, targetHandle: 'in', type: 'optical' },
    ];

    expect(simulateTopology(nodes, edges, DEFAULT_SETTINGS).gatewayTelemetry[gateway.id].status).toBe('DISCONNECTED');
  });
});
