import { useEffect, useRef } from 'react';
import {
  Ellipsis,
  Grid3x3,
  Hand,
  Link2,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

/* ========================================================================== *
 * Floating canvas toolbar.
 *
 * Only the tools an engineer touches while drawing live here: Select · Pan ·
 * Connect · Delete, then Zoom out · Zoom in · Fit. The overflow holds canvas
 * actions only — fit, zoom reset and grid snapping. Everything that configures
 * the app (Overview, OPM, OTDR, Missions, safety margin, Auto, Clear, help)
 * lives in the Settings section. Adding components lives in the library.
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
  onFit: () => void;
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
    selectionCount,
    toolsOpen,
    onToolsOpenChange,
    snapToGrid,
    onToggleSnap,
    onSelectTool,
    onPanTool,
    onToggleLink,
    onDelete,
    onFit,
    onZoomIn,
    onZoomOut,
    onZoomReset,
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
          className={`pu-btn pu-tb-btn pu-tb-more-btn${toolsOpen || snapToGrid ? ' is-active' : ''}`}
          onClick={() => onToolsOpenChange(!toolsOpen)}
          aria-expanded={toolsOpen}
          aria-haspopup="true"
          aria-controls="canvas-more-tools"
          aria-label="More tools"
          title="More tools — fit, zoom and grid snapping"
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
            <button type="button" onClick={close(onFit)} aria-label="Fit view to screen">
              <Maximize2 size={14} className="pu-menu-ico" aria-hidden="true" /> Fit view to screen
            </button>
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
