import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ClipboardList,
  Crosshair,
  Hand,
  Link2,
  Maximize2,
  MousePointer2,
  PlusCircle,
  ScanLine,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { DesignSettings } from '../types';

/* ========================================================================== *
 * Floating canvas toolbar: Select · Pan · Connect · Add Node · Delete, plus a
 * "More tools" popover that keeps every advanced FiberLAB feature reachable
 * (OPM probe, OTDR, Missions, safety margin, Auto, Overview, Clear).
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
  onAddNode: () => void;
  onDelete: () => void;
  onFit: () => void;
  onOpenOverview: () => void;
  onToggleOpm: () => void;
  onOpenOtdr: () => void;
  onOpenMissions: () => void;
  onClear: () => void;
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const {
    canvasTool, linkMode, opmActive, selectionCount, activeMissionTitle, settings,
    toolsOpen, onToolsOpenChange, onSettingsChange, onSelectTool, onPanTool, onToggleLink,
    onAddNode, onDelete, onFit, onOpenOverview, onToggleOpm, onOpenOtdr, onOpenMissions, onClear,
  } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as globalThis.Node)) onToolsOpenChange(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [toolsOpen, onToolsOpenChange]);

  const close = (fn: () => void) => () => {
    fn();
    onToolsOpenChange(false);
  };

  return (
    <div role="toolbar" aria-label="Canvas workbench tools" className="pu-toolbar">
      <button type="button" className={`pu-btn ${canvasTool === 'select' && !linkMode ? 'is-active' : ''}`} onClick={onSelectTool}>
        <MousePointer2 size={14} /> Select
      </button>
      <button type="button" className={`pu-btn ${canvasTool === 'pan' && !linkMode ? 'is-active' : ''}`} onClick={onPanTool}>
        <Hand size={14} /> Pan
      </button>
      <button
        type="button"
        className={`pu-btn ${linkMode ? 'is-active' : ''}`}
        onClick={onToggleLink}
        aria-pressed={linkMode}
        aria-label="Link nodes"
        title={linkMode ? 'Cancel link mode or press Escape' : 'Select a source node, then a destination node'}
      >
        <Link2 size={14} /> Connect
      </button>
      <button type="button" className="pu-btn" onClick={onAddNode} title="Quickly place a subscriber ONT on the canvas">
        <PlusCircle size={14} /> Add Node
      </button>
      <button
        type="button"
        className="pu-btn"
        disabled={selectionCount === 0}
        onClick={onDelete}
        aria-label="Delete selected elements"
        title="Delete selected node or cable"
      >
        <Trash2 size={14} /> Delete{selectionCount > 1 ? ` (${selectionCount})` : ''}
      </button>
      <button type="button" className="pu-btn" onClick={onFit} title="Fit topology to screen" aria-label="Fit View">
        <Maximize2 size={14} />
      </button>

      <div style={{ position: 'relative' }} ref={menuRef}>
        <button
          type="button"
          className={`pu-btn ${toolsOpen || opmActive || activeMissionTitle ? 'is-active' : ''}`}
          onClick={() => onToolsOpenChange(!toolsOpen)}
          aria-expanded={toolsOpen}
          aria-label="More tools"
        >
          <SlidersHorizontal size={14} /> More tools
        </button>
        {toolsOpen ? (
          <div className="pu-menu" style={{ top: 'calc(100% + 8px)', left: 0, width: 280 }}>
            <button type="button" id="studio-overview-toggle" onClick={close(onOpenOverview)} aria-label="Overview & Physics">
              <ArrowLeft size={13} style={{ display: 'inline', marginRight: 8 }} /> Overview &amp; Physics
            </button>
            <button type="button" onClick={close(onToggleOpm)} aria-pressed={opmActive} aria-label={opmActive ? 'Close OPM' : 'OPM Tool'}>
              <Crosshair size={13} style={{ display: 'inline', marginRight: 8 }} /> {opmActive ? 'Close OPM' : 'OPM Tool'} — probe a port
            </button>
            <button type="button" onClick={close(onOpenOtdr)} aria-label="OTDR Trace">
              <ScanLine size={13} style={{ display: 'inline', marginRight: 8 }} /> OTDR Trace
            </button>
            <button type="button" onClick={close(onOpenMissions)} aria-label={activeMissionTitle ? `Missions, active: ${activeMissionTitle}` : 'Missions'}>
              <ClipboardList size={13} style={{ display: 'inline', marginRight: 8 }} /> Missions{activeMissionTitle ? ` · ${activeMissionTitle}` : ''}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--pu-line)', fontSize: 12 }}>
              <label htmlFor="safety-margin" style={{ fontWeight: 600 }}>Safety margin</label>
              <input
                id="safety-margin"
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={settings.safetyMarginDb}
                onChange={(event) => onSettingsChange({ safetyMarginDb: Math.max(0, Number(event.target.value) || 0) })}
                style={{ width: 54, padding: '4px 6px', border: '1px solid var(--pu-line)', borderRadius: 7, textAlign: 'center' }}
              />
              <span className="pu-mut">dB</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoRun}
                onClick={() => onSettingsChange({ autoRun: !settings.autoRun })}
                title="Recalculate the optical budget on every edit"
                style={{ marginLeft: 'auto', width: 'auto', padding: '4px 10px', borderRadius: 99, border: '1px solid var(--pu-line)', fontWeight: 700, color: settings.autoRun ? 'var(--pu-ok)' : 'var(--pu-mut)' }}
              >
                Auto {settings.autoRun ? 'on' : 'off'}
              </button>
            </div>
            <button type="button" onClick={close(onClear)} aria-label="Clear Canvas" title="Remove every element" style={{ color: 'var(--pu-bad)' }}>
              <Trash2 size={13} style={{ display: 'inline', marginRight: 8 }} /> Clear canvas
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CanvasToolbar;
