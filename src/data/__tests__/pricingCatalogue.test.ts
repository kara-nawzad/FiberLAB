import { describe, expect, it } from 'vitest';
import type { PonEdge, PonNode } from '../../types';
import { createClosureNode } from '../../engine/factories';
import { calculateNetworkCost, DEFAULT_UNIT_COSTS, resolveUnitCosts } from '../pricingCatalogue';
import { buildPreset } from '../../engine/presets';

function standardTopology(): { nodes: PonNode[]; edges: PonEdge[] } {
  const topology = buildPreset('standard-1x32');
  if (!topology) throw new Error('The standard learning topology is missing.');
  return topology;
}

describe('commercial pricing catalogue', () => {
  it('prices the standard 1:32 tree with deterministic, category-separated totals', () => {
    const { nodes, edges } = standardTopology();
    const first = calculateNetworkCost(nodes, edges);
    const second = calculateNetworkCost(nodes, edges);

    expect(first).toEqual(second);
    expect(first.materialsCost).toBe(3574);
    expect(first.laborCost).toBe(173);
    expect(first.totalCapex).toBe(3747);
    expect(first.costPerHomePassed).toBe(1249);
    expect(first.lineItems.find((line) => line.item === 'Feeder / OSP cable')).toMatchObject({
      quantity: 5,
      unitPrice: 350,
      totalPrice: 1750,
    });
  });

  it('reconciles every quotation line item to the materials, labor, and CAPEX totals', () => {
    const { nodes, edges } = standardTopology();
    const quote = calculateNetworkCost(nodes, edges);
    const materials = quote.lineItems
      .filter((line) => line.category !== 'Labor & Splicing')
      .reduce((sum, line) => sum + line.totalPrice, 0);
    const labor = quote.lineItems
      .filter((line) => line.category === 'Labor & Splicing')
      .reduce((sum, line) => sum + line.totalPrice, 0);

    expect(materials).toBe(quote.materialsCost);
    expect(labor).toBe(quote.laborCost);
    expect(materials + labor).toBe(quote.totalCapex);
    expect(quote.lineItems.reduce((sum, line) => sum + line.totalPrice, 0)).toBe(quote.totalCapex);
  });

  it('deep-merges local price overrides without mutating the reference catalogue', () => {
    const { nodes, edges } = standardTopology();
    const custom = {
      cablePerKm: { feeder: 100 },
      splitterByRatio: { '1:8': 30 },
      connectorPerEnd: 0,
    };
    const quote = calculateNetworkCost(nodes, edges, custom);
    const resolved = resolveUnitCosts(custom);

    expect(resolved.cablePerKm).toEqual({ feeder: 100, distribution: 250, drop: 150 });
    expect(resolved.splitterByRatio['1:8']).toBe(30);
    expect(resolved.splitterByRatio['1:4']).toBe(DEFAULT_UNIT_COSTS.splitterByRatio['1:4']);
    expect(resolved.connectorPerEnd).toBe(0);
    expect(quote.totalCapex).toBe(2453);
    expect(DEFAULT_UNIT_COSTS.cablePerKm.feeder).toBe(350);
    expect(DEFAULT_UNIT_COSTS.splitterByRatio['1:8']).toBe(26);
  });

  it('charges closure splice labor only for connected active branch sleeves', () => {
    const closure = createClosureNode({ id: 'pricing-closure' });
    if (closure.type !== 'closure') throw new Error('Closure factory returned an invalid node.');
    const pricedClosure: PonNode = {
      ...closure,
      data: { ...closure.data, activeSpliceChannels: closure.data.activeSpliceChannels.map((_, index) => index === 0) },
    };
    const nodes: PonNode[] = [pricedClosure];
    const edges: PonEdge[] = [
      {
        id: 'active-branch',
        source: closure.id,
        sourceHandle: 'out-0',
        target: 'fiber-a',
        targetHandle: 'in',
        type: 'optical',
      },
      {
        id: 'inactive-branch',
        source: closure.id,
        sourceHandle: 'out-1',
        target: 'fiber-b',
        targetHandle: 'in',
        type: 'optical',
      },
    ];
    const quote = calculateNetworkCost(nodes, edges);

    expect(quote.materialsCost).toBe(85);
    expect(quote.laborCost).toBe(12.5);
    expect(quote.lineItems.find((line) => line.item === 'Fusion splice labor')?.quantity).toBe(1);
  });

  it('returns a finite zero quotation for an empty canvas', () => {
    expect(calculateNetworkCost([], [])).toEqual({
      materialsCost: 0,
      laborCost: 0,
      totalCapex: 0,
      costPerHomePassed: 0,
      lineItems: [],
    });
  });
});
