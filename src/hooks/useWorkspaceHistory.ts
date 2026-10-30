import { useCallback, useRef, useState } from 'react';
import type { PonEdge, PonNode } from '../types';

/* ========================================================================== *
 * Undo / redo for the canvas.
 *
 * One history entry per user gesture, not per React render: callers hand in a
 * snapshot they captured *before* the change (a drag start, a click, a preset
 * load). The stack is bounded, so a long session cannot grow without limit,
 * and restoring a snapshot also clears the redo branch.
 * ========================================================================== */

export const HISTORY_LIMIT = 50;

export interface CanvasSnapshot {
  nodes: PonNode[];
  edges: PonEdge[];
  activePresetId: string | null;
  presetEdited: boolean;
  label: string;
}

const clone = (snapshot: CanvasSnapshot): CanvasSnapshot => ({
  ...snapshot,
  nodes: snapshot.nodes.map((node) => ({ ...node }) as PonNode),
  edges: snapshot.edges.map((edge) => ({ ...edge }) as PonEdge),
});

export interface WorkspaceHistory {
  canUndo: boolean;
  canRedo: boolean;
  /** Remember the state as it was before the next change. */
  record: (snapshot: CanvasSnapshot) => void;
  /** Drop the newest entry without restoring it (e.g. a cancelled gesture). */
  discardLast: () => void;
  undo: (current: CanvasSnapshot) => CanvasSnapshot | null;
  redo: (current: CanvasSnapshot) => CanvasSnapshot | null;
  reset: () => void;
}

export function useWorkspaceHistory(): WorkspaceHistory {
  const past = useRef<CanvasSnapshot[]>([]);
  const future = useRef<CanvasSnapshot[]>([]);
  const [depth, setDepth] = useState({ past: 0, future: 0 });
  const bump = useCallback(() => setDepth({ past: past.current.length, future: future.current.length }), []);

  const record = useCallback(
    (snapshot: CanvasSnapshot) => {
      past.current = [...past.current, clone(snapshot)].slice(-HISTORY_LIMIT);
      future.current = [];
      bump();
    },
    [bump],
  );

  const discardLast = useCallback(() => {
    past.current = past.current.slice(0, -1);
    bump();
  }, [bump]);

  const undo = useCallback(
    (current: CanvasSnapshot) => {
      const previous = past.current[past.current.length - 1];
      if (!previous) return null;
      past.current = past.current.slice(0, -1);
      future.current = [...future.current, clone(current)].slice(-HISTORY_LIMIT);
      bump();
      return clone(previous);
    },
    [bump],
  );

  const redo = useCallback(
    (current: CanvasSnapshot) => {
      const next = future.current[future.current.length - 1];
      if (!next) return null;
      future.current = future.current.slice(0, -1);
      past.current = [...past.current, clone(current)].slice(-HISTORY_LIMIT);
      bump();
      return clone(next);
    },
    [bump],
  );

  const reset = useCallback(() => {
    past.current = [];
    future.current = [];
    bump();
  }, [bump]);

  return {
    canUndo: depth.past > 0,
    canRedo: depth.future > 0,
    record,
    discardLast,
    undo,
    redo,
    reset,
  };
}
