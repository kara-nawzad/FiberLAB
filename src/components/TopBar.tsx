import { useEffect, useRef, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import {
  ChevronDown,
  Crosshair,
  Download,
  FileBarChart,
  Layers,
  ListTodo,
  Loader2,
  Play,
  Redo2,
  ScanLine,
  Settings2,
  Undo2,
  Upload,
} from 'lucide-react';
import { PRESETS } from '../engine/presets';
import type { DesignLevel } from '../types';
import { readFileText } from '../lib/readFileText';

/* ========================================================================== *
 * Top bar — four things only: the logo, the project (with an edited marker),
 * the zoom percentage and the primary Run Simulation action. Presets belong to
 * the Design screen, Reports has its own section, and health/CAPEX live in the
 * status bar and the Reports screen.
 * ========================================================================== */

interface TopBarProps {
  /** Current topology name shown as the project. */
  projectName: string;
  /** True once the canvas has been edited away from the loaded preset. */
  presetEdited?: boolean;
  /** True when Auto is off and the budget is older than the last edit. */
  stale: boolean;
  testing: boolean;
  onRunTest: () => void;
  onOpenOverview: () => void;
  /** Whether the last debounced write landed in this browser's storage. */
  saveStatus?: 'saved' | 'saving' | 'error';
  canUndo?: boolean;
  canRedo?: boolean;
  onUndoRequest?: () => void;
  onRedoRequest?: () => void;
  /** Renaming is an edit like any other: it is saved with the workspace. */
  onRenameProject?: (name: string) => void;
  detailLevel?: DesignLevel;
  onToggleDetailLevel?: () => void;
  activePresetId?: string | null;
  onSelectPreset?: (presetId: string) => void;
  onOpenSettings?: () => void;
  onOpenResults?: () => void;
  onOpenQuotation?: () => void;
  onOpenMissions?: () => void;
  onOpenOtdr?: () => void;
  onToggleOpm?: () => void;
  onImportTopology?: (text: string, fileName?: string) => { ok: boolean; error?: string };
}

export function TopBar({
  projectName,
  presetEdited = false,
  stale,
  testing,
  onRunTest,
  onOpenOverview,
  saveStatus = 'saved',
  canUndo = false,
  canRedo = false,
  onUndoRequest,
  onRedoRequest,
  onRenameProject,
  detailLevel = 'guided',
  onToggleDetailLevel,
  activePresetId = null,
  onSelectPreset,
  onOpenSettings,
  onOpenResults,
  onOpenQuotation,
  onOpenMissions,
  onOpenOtdr,
  onToggleOpm,
  onImportTopology,
}: TopBarProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const zoomRef = useRef<HTMLDivElement | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement | null>(null);
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);

  /* The overflow closes on an outside click or Escape, like the zoom menu. */
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as globalThis.Node;
      if (moreRef.current && !moreRef.current.contains(target)) {
        setMoreOpen(false);
        setPresetsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMoreOpen(false);
      setPresetsOpen(false);
      moreButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const runMenuAction = (action?: () => void) => () => {
    setMoreOpen(false);
    setPresetsOpen(false);
    action?.();
  };

  useEffect(() => {
    if (!zoomOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as globalThis.Node;
      if (zoomRef.current && !zoomRef.current.contains(target)) setZoomOpen(false);
    };
    // Escape dismisses the popover and returns focus to the button that opened it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setZoomOpen(false);
      zoomButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [zoomOpen]);

  return (
    <header className="fiberlab-topbar pu-top">
      <button
        type="button"
        id="studio-overview-toggle"
        className="pu-logo"
        onClick={onOpenOverview}
        aria-label="Overview & Physics"
        title="Return to Overview & Physics"
      >
        {/* The wordmark is the logo at every width. A lettered tile stood in for
         * it on phones and read as a placeholder, not the brand. */}
        <span className="pu-logo-full">
          Fiber<b>LAB</b>
        </span>
      </button>
      <span className="pu-sep" aria-hidden="true" />

      <span className="pu-project">
        {onRenameProject ? (
          <input
            className="pu-project-input"
            aria-label="Project name"
            value={projectName}
            size={Math.max(10, Math.min(34, projectName.length + 2))}
            onChange={(event) => onRenameProject(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            title="Rename this project"
          />
        ) : (
          <span className="pu-project-name" title={projectName}>
            {projectName}
          </span>
        )}
        {presetEdited ? <span className="pu-doc-tab-edited">Edited</span> : null}
        <span className={`pu-save-status${saveStatus === 'error' ? ' is-error' : ''}`} role="status">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved'}
        </span>
      </span>

      <div style={{ flex: 1 }} />

      {onToggleDetailLevel ? (
        <button
          type="button"
          className="pu-btn pu-detail-chip"
          onClick={onToggleDetailLevel}
          aria-pressed={detailLevel === 'engineer'}
          aria-label={`Detail level: ${detailLevel === 'guided' ? 'Guided' : 'Engineer'}`}
          title={
            detailLevel === 'guided'
              ? 'Guided — plain-language essentials. Switch to Engineer for loss tables and allowances.'
              : 'Engineer — every loss table and allowance is open.'
          }
        >
          {detailLevel === 'guided' ? 'Guided' : 'Engineer'}
        </button>
      ) : null}

      <div className="pu-history">
        <button
          type="button"
          className="pu-btn"
          onClick={onUndoRequest}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo2 size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pu-btn"
          onClick={onRedoRequest}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
        >
          <Redo2 size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="relative pu-zoom" ref={zoomRef}>
        <button
          ref={zoomButtonRef}
          type="button"
          className="pu-select"
          onClick={() => setZoomOpen((open) => !open)}
          aria-label="Zoom"
          aria-expanded={zoomOpen}
          aria-haspopup="true"
          aria-controls="zoom-menu"
        >
          {Math.round(zoom * 100)}% <ChevronDown size={14} className="pu-mut" aria-hidden="true" />
        </button>
        {zoomOpen ? (
          <div id="zoom-menu" className="pu-menu" style={{ top: 'calc(100% + 8px)', right: 0, minWidth: 160 }}>
            <button type="button" onClick={() => void zoomIn({ duration: 200 })}>
              Zoom in
            </button>
            <button type="button" onClick={() => void zoomOut({ duration: 200 })}>
              Zoom out
            </button>
            <button type="button" onClick={() => void zoomTo(1, { duration: 200 })}>
              Reset to 100%
            </button>
            <button type="button" onClick={() => void fitView({ padding: 0.16, duration: 350 })}>
              Fit to screen
            </button>
          </div>
        ) : null}
      </div>

      <div className="pu-top-more" ref={moreRef}>
        <button
          ref={moreButtonRef}
          type="button"
          className="pu-btn"
          onClick={() => {
            setMoreOpen((open) => !open);
            setPresetsOpen(false);
          }}
          aria-label="More"
          aria-expanded={moreOpen}
          aria-haspopup="true"
          aria-controls="top-more-menu"
          title="Presets, settings and test gear"
        >
          <Layers size={15} aria-hidden="true" />
          <span className="pu-label-full">More</span>
        </button>
        {moreOpen ? (
          <div id="top-more-menu" className="pu-menu" style={{ top: 'calc(100% + 8px)', right: 0, width: 248 }}>
            {onSelectPreset ? (
              <>
                <button type="button" onClick={() => setPresetsOpen((open) => !open)} aria-expanded={presetsOpen}>
                  <Download size={14} className="pu-menu-ico" aria-hidden="true" /> Presets
                  <ChevronDown size={12} className="pu-menu-ico" aria-hidden="true" />
                </button>
                {presetsOpen ? (
                  <div className="pu-menu-sub" role="group" aria-label="Preset topologies">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={runMenuAction(() => onSelectPreset(preset.id))}
                        aria-current={preset.id === activePresetId ? 'true' : undefined}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
            {onOpenResults ? (
              <button type="button" onClick={runMenuAction(onOpenResults)}>
                <FileBarChart size={14} className="pu-menu-ico" aria-hidden="true" /> Results
              </button>
            ) : null}
            {onOpenQuotation ? (
              <button type="button" onClick={runMenuAction(onOpenQuotation)}>
                <FileBarChart size={14} className="pu-menu-ico" aria-hidden="true" /> Quotation
              </button>
            ) : null}
            {onOpenMissions ? (
              <button type="button" onClick={runMenuAction(onOpenMissions)}>
                <ListTodo size={14} className="pu-menu-ico" aria-hidden="true" /> Missions
              </button>
            ) : null}
            {onToggleOpm ? (
              <button type="button" onClick={runMenuAction(onToggleOpm)}>
                <Crosshair size={14} className="pu-menu-ico" aria-hidden="true" /> Optical power meter
              </button>
            ) : null}
            {onOpenOtdr ? (
              <button type="button" onClick={runMenuAction(onOpenOtdr)}>
                <ScanLine size={14} className="pu-menu-ico" aria-hidden="true" /> OTDR trace
              </button>
            ) : null}
            {onImportTopology ? (
              <button type="button" onClick={runMenuAction(() => importRef.current?.click())}>
                <Upload size={14} className="pu-menu-ico" aria-hidden="true" /> Import topology
              </button>
            ) : null}
            {onOpenSettings ? (
              <button type="button" onClick={runMenuAction(onOpenSettings)}>
                <Settings2 size={14} className="pu-menu-ico" aria-hidden="true" /> Settings
              </button>
            ) : null}
          </div>
        ) : null}
        {/* Outside the popover on purpose: closing the menu must not unmount the
         * input while the OS file picker is still open. Otherwise the chosen
         * file is delivered to a detached node and the import silently does
         * nothing at all. */}
        {onImportTopology ? (
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import topology file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void readFileText(file).then((text: string) => onImportTopology(text, file.name));
            }}
          />
        ) : null}
      </div>

      <button
        type="button"
        className={`pu-btn pri${stale ? ' is-stale' : ''}`}
        onClick={onRunTest}
        disabled={testing}
        aria-label="Run Simulation"
        title={stale ? 'The budget changed since the last run — run it again' : 'Run the optical simulation'}
      >
        {testing ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Play size={14} fill="currentColor" aria-hidden="true" />
        )}
        <span className="pu-label-full">Run Simulation</span>
        <span className="pu-label-short">Run</span>
      </button>
    </header>
  );
}

export default TopBar;
