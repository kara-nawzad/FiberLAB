import { useEffect, useRef, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { ChevronDown, Loader2, Play } from 'lucide-react';

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
}

export function TopBar({ projectName, presetEdited = false, stale, testing, onRunTest, onOpenOverview }: TopBarProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomRef = useRef<HTMLDivElement | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement | null>(null);
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);

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
        <span className="pu-logo-full">
          Fiber<b>LAB</b>
        </span>
        {/* Phone mark: the brand's F on the coral tile, carried by the tab icon
         * and the touch icon too. */}
        <span className="pu-logo-mark" aria-hidden="true">
          F
        </span>
      </button>
      <span className="pu-sep" aria-hidden="true" />

      <span className="pu-project">
        <span className="pu-project-name" title={projectName}>
          {projectName}
        </span>
        {presetEdited ? <span className="pu-doc-tab-edited">Edited</span> : null}
      </span>

      <div style={{ flex: 1 }} />

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
