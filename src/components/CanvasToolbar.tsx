import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Crosshair,
  Ellipsis,
  Hand,
  Link2,
  Maximize2,
  MousePointer2,
  ScanLine,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { DesignSettings } from '../types';

/* ========================================================================== *
 * Floating canvas toolbar.
 *
 * Only the tools an engineer touches while drawing live here: Select · Pan ·
 * Connect · Delete, then Zoom out · Zoom in · Fit. Everything else (Overview,
 * OPM, OTDR, Missions, safety margin, Auto, Clear, help links) sits behind one
 * "⋯" overflow menu. Adding components lives in the component library.
 * Desktop buttons print a short label with a tooltip; on phones the strip
 * collapses to icons and floats along the bottom of the canvas.
 * ========================================================================== */

export interface CanvasToolbarProps {
  canvasTool: 'select' | 'pan';
  linkMode: boolean;
  opmActive: boolean;
  selectionCount: number;
  activeMissionTitle: string | null;
  settings: DesignSettings;
  toolsOpen: boolean;
  onToolsOpenChange: (open: boolean) => void;
  onSettingsChange: (patch: Partial<DesignSettings>) => void;
  onSelectTool: () => void;
  onPanTool: () => void;
  onToggleLink: () => void;
  onDelete: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onOpenOverview: () => void;
  onToggleOpm: () => void;
  onOpenOtdr: () => void;
  onOpenMissions: () => void;
  onClear: () => void;
}

function ToolButton({
  icon,
  label,
  ariaLabel,
  title,
  active = false,
  disabled = false,
  pressed,
  compact = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  ariaLabel?: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  /** View utilities read better as square icon buttons with a tooltip. */
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`pu-btn pu-tb-btn${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? label}
      aria-pressed={pressed}
    >
      {icon}
      <span className="pu-tb-label">{label}</span>
    </button>
  );
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const {
    canvasTool,
    linkMode,
    opmActive,
    selectionCount,
    activeMissionTitle,
    settings,
    toolsOpen,
    onToolsOpenChange,
    onSettingsChange,
    onSelectTool,
    onPanTool,
    onToggleLink,
    onDelete,
    onFit,
    onZoomIn,
    onZoomOut,
    onOpenOverview,
    onToggleOpm,
    onOpenOtdr,
    onOpenMissions,
    onClear,
  } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as globalThis.Node)) onToolsOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onToolsOpenChange(false);
      menuButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [toolsOpen, onToolsOpenChange]);

  const close = (fn: () => void) => () => {
    fn();
    onToolsOpenChange(false);
  };

  return (
    <div role="toolbar" aria-label="Canvas workbench tools" className="pu-toolbar">
      <div className="pu-tb-group">
        <ToolButton
          icon={<MousePointer2 size={16} aria-hidden="true" />}
          label="Select"
          title="Select and move components (V)"
          active={canvasTool === 'select' && !linkMode}
          pressed={canvasTool === 'select' && !linkMode}
          onClick={onSelectTool}
        />
        <ToolButton
          icon={<Hand size={16} aria-hidden="true" />}
          label="Pan"
          title="Pan the canvas (H)"
          active={canvasTool === 'pan' && !linkMode}
          pressed={canvasTool === 'pan' && !linkMode}
          onClick={onPanTool}
        />
        <ToolButton
          icon={<Link2 size={16} aria-hidden="true" />}
          label="Connect"
          ariaLabel="Link nodes"
          title="Link nodes: pick a source, then a destination"
          active={linkMode}
          pressed={linkMode}
          onClick={onToggleLink}
        />
        <ToolButton
          icon={<Trash2 size={16} aria-hidden="true" />}
          label={selectionCount > 1 ? `Delete (${selectionCount})` : 'Delete'}
          ariaLabel="Delete selected elements"
          title="Delete the selected node or cable"
          disabled={selectionCount === 0}
          onClick={onDelete}
        />
      </div>

      <span className="pu-tb-sep" aria-hidden="true" />

      <div className="pu-tb-group">
        <ToolButton
          icon={<ZoomOut size={16} aria-hidden="true" />}
          label="Zoom out"
          title="Zoom out"
          compact
          onClick={onZoomOut}
        />
        <ToolButton
          icon={<ZoomIn size={16} aria-hidden="true" />}
          label="Zoom in"
          title="Zoom in"
          compact
          onClick={onZoomIn}
        />
        <ToolButton
          icon={<Maximize2 size={16} aria-hidden="true" />}
          label="Fit"
          ariaLabel="Fit View"
          title="Fit the topology to the screen"
          compact
          onClick={onFit}
        />
      </div>

      <span className="pu-tb-sep" aria-hidden="true" />

      <div className="pu-tb-more" ref={menuRef}>
        <button
          ref={menuButtonRef}
          type="button"
          className={`pu-btn pu-tb-btn pu-tb-more-btn${toolsOpen || opmActive || activeMissionTitle ? ' is-active' : ''}`}
          onClick={() => onToolsOpenChange(!toolsOpen)}
          aria-expanded={toolsOpen}
          aria-haspopup="true"
          aria-controls="canvas-more-tools"
          aria-label="More tools"
          title="More tools — missions, test gear, settings"
        >
          <Ellipsis size={18} aria-hidden="true" />
        </button>
        {toolsOpen ? (
          <div id="canvas-more-tools" className="pu-menu" style={{ top: 'calc(100% + 8px)', right: 0, width: 280 }}>
            <button type="button" onClick={close(onOpenOverview)} aria-label="Overview & Physics">
              <ArrowLeft size={14} className="pu-menu-ico" /> Overview &amp; Physics
            </button>
            <button
              type="button"
              onClick={close(onToggleOpm)}
              aria-pressed={opmActive}
              aria-label={opmActive ? 'Close OPM' : 'OPM Tool'}
            >
              <Crosshair size={14} className="pu-menu-ico" /> {opmActive ? 'Close OPM' : 'OPM Tool'} — probe a port
            </button>
            <button type="button" onClick={close(onOpenOtdr)} aria-label="OTDR Trace">
              <ScanLine size={14} className="pu-menu-ico" /> OTDR Trace
            </button>
            <button
              type="button"
              onClick={close(onOpenMissions)}
              aria-label={activeMissionTitle ? `Missions, active: ${activeMissionTitle}` : 'Missions'}
            >
              <ClipboardList size={14} className="pu-menu-ico" /> Missions
              {activeMissionTitle ? ` · ${activeMissionTitle}` : ''}
            </button>
            <div className="pu-menu-row">
              <label htmlFor="safety-margin">Safety margin</label>
              <input
                id="safety-margin"
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={settings.safetyMarginDb}
                onChange={(event) => onSettingsChange({ safetyMarginDb: Math.max(0, Number(event.target.value) || 0) })}
                className="pu-input-sm"
              />
              <span className="pu-mut">dB</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoRun}
                onClick={() => onSettingsChange({ autoRun: !settings.autoRun })}
                title="Recalculate the optical budget on every edit"
                className={`pu-switch ${settings.autoRun ? 'is-on' : ''}`}
              >
                Auto {settings.autoRun ? 'on' : 'off'}
              </button>
            </div>
            <button
              type="button"
              onClick={close(onClear)}
              aria-label="Clear Canvas"
              title="Remove every element"
              className="is-danger"
            >
              <Trash2 size={14} className="pu-menu-ico" /> Clear canvas
            </button>
            {/* Learning resources used to sit under the component library; they
                live here now so the library stays a pure parts bin. */}
            <div className="pu-menu-links" role="group" aria-label="Learning resources">
              <span>Need help?</span>
              <a
                href="https://github.com/kara-nawzad/FiberLAB/tree/main/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Docs
              </a>
              <span aria-hidden="true">·</span>
              <a href="https://github.com/kara-nawzad/FiberLAB" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CanvasToolbar;
