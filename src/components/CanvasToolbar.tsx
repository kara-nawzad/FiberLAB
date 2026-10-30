import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Crosshair,
  Ellipsis,
  Grid3x3,
  Hand,
  Link2,
  ListTodo,
  MousePointer2,
  Play,
  RotateCcw,
  ScanLine,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

/* ========================================================================== *
 * Floating canvas toolbar.
 *
 * One row, five groups: Select · Pan · Connect · Delete, then Test (run the
 * budget, probe with the power meter, trace with the OTDR), then zoom, then the
 * mission door, then an overflow for view actions. Zoom folds away on phones so
 * every remaining target keeps a 44 px touch area; Settings and presets live in
 * the top bar. Adding components lives in the library.
 * ========================================================================== */

export interface CanvasToolbarProps {
  canvasTool: 'select' | 'pan';
  linkMode: boolean;
  selectionCount: number;
  toolsOpen: boolean;
  onToolsOpenChange: (open: boolean) => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  onSelectTool: () => void;
  onPanTool: () => void;
  onToggleLink: () => void;
  onDelete: () => void;
  /** Opens the field-mission drawer; the label names the running mission. */
  onOpenMissions: () => void;
  activeMissionTitle?: string | null;
  /** Test ▾ — the three read-outs that need a live network. */
  onRunTest: () => void;
  onOpenOpm: () => void;
  onOpenOtdr: () => void;
  opmActive?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
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
  className = '',
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
  /** Extra class hook (phones hide the delete target, the inspector keeps it). */
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`pu-btn pu-tb-btn${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
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
    selectionCount,
    toolsOpen,
    onToolsOpenChange,
    snapToGrid,
    onToggleSnap,
    onSelectTool,
    onPanTool,
    onToggleLink,
    onDelete,
    onOpenMissions,
    activeMissionTitle = null,
    onRunTest,
    onOpenOpm,
    onOpenOtdr,
    opmActive = false,
    onZoomIn,
    onZoomOut,
    onZoomReset,
  } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const testRef = useRef<HTMLDivElement | null>(null);
  const testButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!testOpen) return;
    const onDown = (event: MouseEvent) => {
      if (testRef.current && !testRef.current.contains(event.target as globalThis.Node)) setTestOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setTestOpen(false);
      testButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [testOpen]);

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
          className="pu-tb-delete"
          icon={<Trash2 size={16} aria-hidden="true" />}
          label={selectionCount > 1 ? `Delete (${selectionCount})` : 'Delete'}
          ariaLabel="Delete selected elements"
          title="Delete the selected node or cable"
          disabled={selectionCount === 0}
          onClick={onDelete}
        />
      </div>

      <span className="pu-tb-sep" aria-hidden="true" />

      <div className="pu-tb-group pu-tb-test" ref={testRef}>
        <button
          ref={testButtonRef}
          type="button"
          className={`pu-btn pu-tb-btn${testOpen || opmActive ? ' is-active' : ''}`}
          onClick={() => setTestOpen((open) => !open)}
          aria-expanded={testOpen}
          aria-haspopup="true"
          aria-controls="canvas-test-menu"
          aria-label="Test"
          title="Test the network: run the budget, probe light, trace fiber"
        >
          <ScanLine size={16} aria-hidden="true" />
          <span className="pu-tb-label">Test</span>
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        {testOpen ? (
          <div id="canvas-test-menu" className="pu-menu" style={{ top: 'calc(100% + 8px)', left: 0, width: 220 }}>
            <button
              type="button"
              onClick={() => {
                setTestOpen(false);
                onRunTest();
              }}
            >
              <Play size={14} className="pu-menu-ico" aria-hidden="true" /> Run the budget
            </button>
            <button
              type="button"
              onClick={() => {
                setTestOpen(false);
                onOpenOpm();
              }}
            >
              <Crosshair size={14} className="pu-menu-ico" aria-hidden="true" /> Probe with the OPM
            </button>
            <button
              type="button"
              onClick={() => {
                setTestOpen(false);
                onOpenOtdr();
              }}
            >
              <ScanLine size={14} className="pu-menu-ico" aria-hidden="true" /> Acquire an OTDR trace
            </button>
          </div>
        ) : null}
      </div>

      <span className="pu-tb-sep pu-tb-zoom" aria-hidden="true" />

      <div className="pu-tb-group pu-tb-zoom">
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
      </div>

      <span className="pu-tb-sep" aria-hidden="true" />

      <div className="pu-tb-group">
        <ToolButton
          icon={<ListTodo size={16} aria-hidden="true" />}
          label="Missions"
          ariaLabel={activeMissionTitle ? `Missions, active: ${activeMissionTitle}` : 'Missions'}
          title="Field missions: guided build and fault-finding practice"
          active={Boolean(activeMissionTitle)}
          onClick={onOpenMissions}
        />
      </div>

      <span className="pu-tb-sep" aria-hidden="true" />

      <div className="pu-tb-more" ref={menuRef}>
        <button
          ref={menuButtonRef}
          type="button"
          className={`pu-btn pu-tb-btn pu-tb-more-btn${toolsOpen || snapToGrid ? ' is-active' : ''}`}
          onClick={() => onToolsOpenChange(!toolsOpen)}
          aria-expanded={toolsOpen}
          aria-haspopup="true"
          aria-controls="canvas-more-tools"
          aria-label="More tools"
          title="More tools — zoom reset and grid snapping"
        >
          <Ellipsis size={18} aria-hidden="true" />
        </button>
        {toolsOpen ? (
          <div
            id="canvas-more-tools"
            className="pu-menu"
            role="group"
            aria-label="Canvas actions"
            style={{ top: 'calc(100% + 8px)', right: 0, width: 244 }}
          >
            <button type="button" onClick={close(onZoomReset)} aria-label="Zoom to 100%">
              <RotateCcw size={14} className="pu-menu-ico" aria-hidden="true" /> Zoom to 100%
            </button>
            <div className="pu-menu-row">
              <span id="canvas-snap-label" className="pu-menu-row-label">
                <Grid3x3 size={14} className="pu-menu-ico" aria-hidden="true" /> Snap to grid
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={snapToGrid}
                aria-labelledby="canvas-snap-label"
                onClick={onToggleSnap}
                title="Align dragged components to a 16 px grid"
                className={`pu-switch ${snapToGrid ? 'is-on' : ''}`}
              >
                {snapToGrid ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CanvasToolbar;
