import { DEFAULT_SETTINGS, type DesignLevel, type DesignSettings, type PonEdge, type PonNode } from '../types';
import {
  DEFAULT_UNIT_COSTS,
  resolveUnitCosts,
  type PartialUnitCostProfile,
  type UnitCostProfile,
} from '../data/pricingCatalogue';

/* ========================================================================== *
 * Workspace persistence, UI preferences and topology import.
 *
 * The design is deliberately session-only: a reload opens a clean canvas, so a
 * network built last night never reappears in the workbench days later. What is
 * written to localStorage is only the two UI preferences (detail level and a
 * dismissed canvas hint). `clearWorkspace` exists to wipe the document older
 * versions autosaved under WORKSPACE_STORAGE_KEY.
 *
 * Reading is defensive: a hand-edited or older document is dropped field by
 * field rather than allowed to crash the workbench. `sanitiseWorkspace` is the
 * same reader that validates an imported TopologyExport file.
 *
 * This module is React-free and storage-free at import time, so the engine
 * tests can exercise the parse rules directly.
 * ========================================================================== */

export const WORKSPACE_STORAGE_KEY = 'fiberlab.workspace.v1';

/** One complete canvas document, as sanitised for a topology import. */
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
  ui: {
    emptyHintDismissed: boolean;
  };
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

/* -------------------------------------------------------------------------- *
 * UI preferences — the only thing that survives a reload.
 * -------------------------------------------------------------------------- */

export const UI_PREFS_STORAGE_KEY = 'fiberlab.prefs.v1';

export interface UiPreferences {
  detailLevel: DesignLevel;
  emptyHintDismissed: boolean;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = { detailLevel: 'guided', emptyHintDismissed: false };

export function readUiPreferences(storage: MinimalStorage | undefined = globalThis.localStorage): UiPreferences {
  if (!storage) return { ...DEFAULT_UI_PREFERENCES };
  try {
    const raw = storage.getItem(UI_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_UI_PREFERENCES };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...DEFAULT_UI_PREFERENCES };
    return {
      detailLevel: parsed.detailLevel === 'engineer' ? 'engineer' : 'guided',
      emptyHintDismissed: parsed.emptyHintDismissed === true,
    };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function writeUiPreferences(
  preferences: UiPreferences,
  storage: MinimalStorage | undefined = globalThis.localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage disabled or full: the session keeps the preference, it just will
    // not be remembered next time.
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
