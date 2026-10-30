import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_STORAGE_KEY,
  clearWorkspace,
  parseTopologyImport,
  readWorkspace,
  sanitiseWorkspace,
  writeWorkspace,
  type WorkspaceState,
} from '../workspacePersistence';
import { calculateNetworkCost, resolveUnitCosts } from '../../data/pricingCatalogue';
import { buildQuotationExport } from '../../data/commercialQuoteExports';
import { buildPreset } from '../presets';
import { simulateTopology } from '../opticalSimulator';
import { DEFAULT_SETTINGS, type DesignSettings, type PonEdge, type PonNode } from '../../types';

const settings: DesignSettings = { ...DEFAULT_SETTINGS };

/** The smallest Storage we need: enough to prove the round trip and the guard rails. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    keys: () => [...map.keys()],
    raw: map,
  };
}

function workspaceFrom(presetId = 'standard-1x32'): WorkspaceState {
  const built = buildPreset(presetId) as { nodes: PonNode[]; edges: PonEdge[] };
  return {
    nodes: built.nodes,
    edges: built.edges,
    settings,
    unitCosts: resolveUnitCosts(),
    activePresetId: presetId,
    activeMissionId: null,
    projectName: 'Standard tree',
    detailLevel: 'guided',
    presetEdited: false,
    ui: { emptyHintDismissed: true },
  };
}

describe('workspace persistence', () => {
  it('writes under one versioned key and reads the same design back', () => {
    const storage = fakeStorage();
    const state = workspaceFrom();

    expect(writeWorkspace(state, storage)).toBe(true);
    expect(storage.keys()).toEqual([WORKSPACE_STORAGE_KEY]);

    const restored = readWorkspace(storage);
    expect(restored).not.toBeNull();
    expect(restored?.nodes).toHaveLength(state.nodes.length);
    expect(restored?.edges).toHaveLength(state.edges.length);
    expect(restored?.settings).toEqual(settings);
    expect(restored?.activePresetId).toBe('standard-1x32');
    expect(restored?.ui.emptyHintDismissed).toBe(true);
  });

  it('survives a corrupted document instead of crashing on boot', () => {
    expect(readWorkspace(fakeStorage({ [WORKSPACE_STORAGE_KEY]: '{not json' }))).toBeNull();
    expect(readWorkspace(fakeStorage({ [WORKSPACE_STORAGE_KEY]: '"just a string"' }))).toBeNull();
    expect(readWorkspace(fakeStorage())).toBeNull();
    expect(readWorkspace(undefined)).toBeNull();
    expect(clearWorkspace(fakeStorage({ [WORKSPACE_STORAGE_KEY]: '{}' }))).toBeUndefined();
  });

  it('drops only the unreadable nodes and the edges that pointed at them', () => {
    const state = workspaceFrom();
    const raw = {
      version: 1,
      nodes: [...state.nodes, { id: 'broken', type: 'splitter' }, { nonsense: true }],
      edges: [...state.edges, { id: 'ghost-edge', source: 'olt-a', target: 'missing-node' }, { id: 'no-ends' }],
      settings: { safetyMarginDb: 'three', autoRun: 'yes' },
    };

    const restored = sanitiseWorkspace(raw);
    expect(restored).not.toBeNull();
    expect(restored?.nodes).toHaveLength(state.nodes.length);
    expect(restored?.edges).toHaveLength(state.edges.length);
    // Bad settings fall back to the defaults rather than poisoning the budget.
    expect(restored?.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('refuses a stored workspace from a different version', () => {
    const storage = fakeStorage({
      [WORKSPACE_STORAGE_KEY]: JSON.stringify({ version: 99, nodes: [], edges: [] }),
    });
    expect(readWorkspace(storage)).toBeNull();
  });
});

describe('topology import (TopologyExport v2 round trip)', () => {
  it('rebuilds the exported design exactly', () => {
    const { nodes, edges } = buildPreset('standard-1x32') as { nodes: PonNode[]; edges: PonEdge[] };
    const simulation = simulateTopology(nodes, edges, settings, 4242);
    const unitCosts = resolveUnitCosts();
    const cost = calculateNetworkCost(nodes, edges);
    const document = buildQuotationExport(nodes, edges, simulation, settings, unitCosts, cost);

    const result = parseTopologyImport(JSON.stringify(document));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.nodes).toEqual(nodes);
    expect(result.state.edges).toEqual(edges);
    expect(result.state.settings).toEqual(settings);
    expect(result.exportedAt).toBe(document.exportedAt);
  });

  it('explains why a file was rejected', () => {
    const badJson = parseTopologyImport('<xml/>');
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.error).toMatch(/not JSON/i);

    const wrongFormat = parseTopologyImport(JSON.stringify({ format: 'something/else', version: 2 }));
    expect(wrongFormat.ok).toBe(false);
    if (!wrongFormat.ok) expect(wrongFormat.error).toMatch(/not exported by FiberLAB/i);

    const wrongVersion = parseTopologyImport(
      JSON.stringify({ format: 'ftth-studio/topology', version: 3, nodes: [], edges: [] }),
    );
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) expect(wrongVersion.error).toMatch(/version 3/i);

    const empty = parseTopologyImport(
      JSON.stringify({ format: 'ftth-studio/topology', version: 2, nodes: [], edges: [] }),
    );
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/no readable components/i);
  });
});
