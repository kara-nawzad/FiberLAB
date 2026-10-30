import { DEFAULT_SETTINGS, type DesignLevel, type DesignSettings, type PonEdge, type PonNode } from '../types';
import {
  DEFAULT_UNIT_COSTS,
  resolveUnitCosts,
  type PartialUnitCostProfile,
  type UnitCostProfile,
} from '../data/pricingCatalogue';

/* ========================================================================== *
 * Workspace persistence.
 *
 * The designed network is the product's primary artefact, so it is written to
 * localStorage under one versioned key on a debounce. Reading is defensive: a
 * half-written, hand-edited or older document is dropped field by field rather
 * than allowed to crash the workbench on boot.
 *
 * This module is React-free and storage-free at import time, so the engine
 * tests can exercise the parse rules directly.
 * ========================================================================== */

export const WORKSPACE_STORAGE_KEY = 'fiberlab.workspace.v1';

/** Everything that survives a reload. */
export interface WorkspaceState {
  nodes: PonNode[];
  edges: PonEdge[];
  settings: DesignSettings;
  unitCosts: UnitCostProfile;
  activePresetId: string | null;
  activeMissionId: string | null;
  /** Editable project name shown in the top bar. */
  projectName: string | null;
  presetEdited: boolean;
  /** How much engineering detail the reader asked for. */
  detailLevel: DesignLevel;
  /** Chrome that should not come back the next time the tab opens. */
  ui: {
    emptyHintDismissed: boolean;
  };
}

interface StoredWorkspace extends WorkspaceState {
  version: 1;
  savedAt: string;
}

export const NODE_TYPES = [
  'olt',
  'splitter',
  'fiber',
  'ont',
  'gateway',
  'closure',
  'nap',
  'odf',
  'attenuator',
] as const;

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** One node is kept only when its identity, geometry and payload are present. */
function readNode(value: unknown): PonNode | null {
  if (!isRecord(value)) return null;
  const { id, type, position, data } = value;
  if (typeof id !== 'string' || !id) return null;
  if (typeof type !== 'string' || !(NODE_TYPES as readonly string[]).includes(type)) return null;
  if (!isRecord(position) || typeof position.x !== 'number' || typeof position.y !== 'number') return null;
  if (!isRecord(data)) return null;
  return { ...(value as unknown as PonNode), id, type, position, data } as PonNode;
}

/** One edge is kept only when both ends and both handles are named. */
function readEdge(value: unknown): PonEdge | null {
  if (!isRecord(value)) return null;
  const { id, source, target } = value;
  if (typeof id !== 'string' || !id) return null;
  if (typeof source !== 'string' || !source) return null;
  if (typeof target !== 'string' || !target) return null;
  return { ...(value as unknown as PonEdge), id, source, target } as PonEdge;
}

function readSettings(value: unknown): DesignSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  const safetyMarginDb =
    typeof value.safetyMarginDb === 'number' && Number.isFinite(value.safetyMarginDb)
      ? Math.max(0, value.safetyMarginDb)
      : DEFAULT_SETTINGS.safetyMarginDb;
  const autoRun = typeof value.autoRun === 'boolean' ? value.autoRun : DEFAULT_SETTINGS.autoRun;
  return { safetyMarginDb, autoRun };
}

/**
 * Normalise anything that claims to be a workspace. Returns `null` when the
 * document is not usable at all; otherwise every field is individually
 * validated, so one broken node never costs the whole design.
 */
export function sanitiseWorkspace(value: unknown): WorkspaceState | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;

  const nodes = value.nodes.map(readNode).filter((node): node is PonNode => node !== null);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges
    .map(readEdge)
    .filter((edge): edge is PonEdge => edge !== null && nodeIds.has(edge.source) && nodeIds.has(edge.target));

  const ui = isRecord(value.ui) ? value.ui : {};
  const unitCosts =
    isRecord(value.unitCosts) && value.unitCosts
      ? resolveUnitCosts(value.unitCosts as unknown as PartialUnitCostProfile)
      : resolveUnitCosts(DEFAULT_UNIT_COSTS);

  return {
    nodes,
    edges,
    settings: readSettings(value.settings),
    unitCosts,
    activePresetId: asString(value.activePresetId),
    activeMissionId: asString(value.activeMissionId),
    projectName: asString(value.projectName),
    presetEdited: value.presetEdited === true,
    detailLevel: value.detailLevel === 'engineer' ? 'engineer' : 'guided',
    ui: { emptyHintDismissed: ui.emptyHintDismissed === true },
  };
}

export function readWorkspace(storage: MinimalStorage | undefined = globalThis.localStorage): WorkspaceState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Only the current workspace version is read; anything else is discarded.
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    return sanitiseWorkspace(parsed);
  } catch {
    return null;
  }
}

export function writeWorkspace(
  state: WorkspaceState,
  storage: MinimalStorage | undefined = globalThis.localStorage,
): boolean {
  if (!storage) return false;
  const document: StoredWorkspace = { version: 1, savedAt: new Date().toISOString(), ...state };
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(document));
    return true;
  } catch {
    // Quota exceeded or storage disabled: the session keeps working, unsaved.
    return false;
  }
}

export function clearWorkspace(storage: MinimalStorage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    /* nothing to do: the caller is already resetting the canvas */
  }
}

/* -------------------------------------------------------------------------- *
 * Topology import — the reader for the TopologyExport v2 document the Reports
 * screen has always written but nothing could read back.
 * -------------------------------------------------------------------------- */

export type TopologyImportResult =
  | { ok: true; state: Pick<WorkspaceState, 'nodes' | 'edges' | 'settings'>; exportedAt: string | null }
  | { ok: false; error: string };

export function parseTopologyImport(text: string): TopologyImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not JSON. Import the .json quotation exported from Reports.' };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'That file does not contain a FiberLAB topology.' };
  if (parsed.format !== 'ftth-studio/topology') {
    return { ok: false, error: 'That file was not exported by FiberLAB.' };
  }
  if (parsed.version !== 2) {
    return { ok: false, error: `Topology version ${String(parsed.version)} is not supported (expected 2).` };
  }
  const workspace = sanitiseWorkspace(parsed);
  if (!workspace || workspace.nodes.length === 0) {
    return { ok: false, error: 'The topology contains no readable components.' };
  }
  return {
    ok: true,
    state: { nodes: workspace.nodes, edges: workspace.edges, settings: workspace.settings },
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
  };
}
