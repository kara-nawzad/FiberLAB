import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_PREFERENCES,
  UI_PREFS_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  clearWorkspace,
  parseTopologyImport,
  readUiPreferences,
  sanitiseWorkspace,
  writeUiPreferences,
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

describe('UI preferences', () => {
  it('round-trips the two preferences that survive a reload', () => {
    const storage = fakeStorage();

    writeUiPreferences({ detailLevel: 'engineer', emptyHintDismissed: true }, storage);

    expect(storage.keys()).toEqual([UI_PREFS_STORAGE_KEY]);
    expect(readUiPreferences(storage)).toEqual({ detailLevel: 'engineer', emptyHintDismissed: true });
  });

  it('falls back to the defaults for a missing or corrupted document', () => {
    expect(readUiPreferences(fakeStorage())).toEqual(DEFAULT_UI_PREFERENCES);
    expect(readUiPreferences(fakeStorage({ [UI_PREFS_STORAGE_KEY]: '{not json' }))).toEqual(DEFAULT_UI_PREFERENCES);
    expect(readUiPreferences(fakeStorage({ [UI_PREFS_STORAGE_KEY]: '"just a string"' }))).toEqual(
      DEFAULT_UI_PREFERENCES,
    );
    expect(readUiPreferences(undefined)).toEqual(DEFAULT_UI_PREFERENCES);
  });

  it('ignores unknown values one field at a time', () => {
    const storage = fakeStorage({
      [UI_PREFS_STORAGE_KEY]: JSON.stringify({ detailLevel: 'wizard', emptyHintDismissed: 'yes' }),
    });
    expect(readUiPreferences(storage)).toEqual(DEFAULT_UI_PREFERENCES);
  });

  it('stays quiet when the browser refuses storage', () => {
    const failing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readUiPreferences(failing)).toEqual(DEFAULT_UI_PREFERENCES);
    expect(() => writeUiPreferences(DEFAULT_UI_PREFERENCES, failing)).not.toThrow();
    expect(() => clearWorkspace(failing)).not.toThrow();
  });
});

describe('session-only workspace', () => {
  it('clears the autosaved document older versions left behind', () => {
    const storage = fakeStorage({ [WORKSPACE_STORAGE_KEY]: JSON.stringify({ version: 1 }) });

    clearWorkspace(storage);

    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(() => clearWorkspace(fakeStorage())).not.toThrow();
  });

  it('never writes a workspace document, so a reload starts clean', () => {
    const storage = fakeStorage();
    writeUiPreferences({ detailLevel: 'guided', emptyHintDismissed: false }, storage);

    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
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

  it('refuses a document that is not a workspace at all', () => {
    expect(sanitiseWorkspace(null)).toBeNull();
    expect(sanitiseWorkspace('a workspace, honest')).toBeNull();
    expect(sanitiseWorkspace({ nodes: [], edges: 'none' })).toBeNull();
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
