import { useEffect, useRef, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { ChevronDown, FileBarChart, LayoutGrid, Loader2, Play } from 'lucide-react';
import type { NetworkSummary } from '../types';
import type { NetworkCostBreakdown } from '../data/pricingCatalogue';
import { formatUsd } from '../data/pricingCatalogue';
import { PRESETS } from '../engine/presets';

/* ========================================================================== *
 * Top bar — logo, topology picker, zoom, Run Simulation, Design / Reports.
 * Tool buttons that used to live here (OPM, OTDR, Missions, Margin, Clear…)
 * are in CanvasToolbar.
 * ========================================================================== */

type Health = 'green' | 'amber' | 'red' | 'idle';

interface TopBarProps {
  summary: NetworkSummary;
  costBreakdown: NetworkCostBreakdown;
  onPreset: (presetId: string) => void;
  onRunTest: () => void;
  onOpenBOM: () => void;
  onOpenOverview: () => void;
  testing: boolean;
  stale: boolean;
  activePresetId: string | null;
  /** True once the canvas has been edited away from the loaded preset. */
  presetEdited?: boolean;
}

function deriveHealth(summary: NetworkSummary): Health {
  if (summary.subscriberCount === 0) return 'idle';
  if (summary.byStatus.LOS > 0 || summary.byStatus.DISCONNECTED > 0) return 'red';
  if (summary.byStatus.WARNING > 0 || summary.byStatus.OVERLOAD > 0 || summary.upstreamDynamicRangeWarning)
    return 'amber';
  return 'green';
}

const HEALTH_TEXT: Record<Health, string> = {
  green: 'All subscribers optimal',
  amber: 'Marginal links detected',
  red: 'Fault on the network',
  idle: 'No subscribers provisioned',
};

export function TopBar({
  summary,
  costBreakdown,
  onPreset,
  onRunTest,
  onOpenBOM,
  onOpenOverview,
  testing,
  stale,
  activePresetId,
  presetEdited = false,
}: TopBarProps) {
  const [presetOpen, setPresetOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<HTMLDivElement | null>(null);
  const presetButtonRef = useRef<HTMLButtonElement | null>(null);
  const zoomButtonRef = useRef<HTMLButtonElement | null>(null);
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const health = deriveHealth(summary);
  const activePreset = PRESETS.find((preset) => preset.id === activePresetId);

  useEffect(() => {
    if (!presetOpen && !zoomOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as globalThis.Node;
      if (presetRef.current && !presetRef.current.contains(target)) setPresetOpen(false);
      if (zoomRef.current && !zoomRef.current.contains(target)) setZoomOpen(false);
    };
    // Escape dismisses a popover and returns focus to the button that opened it,
    // matching how the workspace overlays behave.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (presetOpen) {
        setPresetOpen(false);
        presetButtonRef.current?.focus({ preventScroll: true });
      }
      if (zoomOpen) {
        setZoomOpen(false);
        zoomButtonRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [presetOpen, zoomOpen]);

  return (
    <header className="fiberlab-topbar pu-top">
      <button
        type="button"
        id="studio-overview-toggle"
        className="pu-logo"
        onClick={onOpenOverview}
        aria-label="Overview & Physics"
        title="Return to Overview & Physics"
        style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--pu-ink)', padding: 0 }}
      >
        <span>
          Fiber<b>LAB</b>
        </span>
      </button>
      <span className="pu-sep" />

      <div className="relative" ref={presetRef}>
        <button
          ref={presetButtonRef}
          type="button"
          className="pu-select"
          onClick={() => setPresetOpen((open) => !open)}
          aria-expanded={presetOpen}
          aria-haspopup="true"
          aria-controls="preset-menu"
          aria-label="Preset Topologies"
        >
          <LayoutGrid size={15} className="pu-mut" />
          {activePreset ? activePreset.name : 'FTTH Network'}
          <ChevronDown size={14} className="pu-mut" />
        </button>
        {presetOpen ? (
          <div id="preset-menu" className="pu-menu" style={{ top: 'calc(100% + 8px)', left: 0, width: 340 }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onPreset(preset.id);
                  setPresetOpen(false);
                }}
              >
                <strong style={{ fontSize: 12.5 }}>{preset.name}</strong>
                {activePresetId === preset.id ? (
                  <span style={{ float: 'right', color: 'var(--pu-pri)', fontSize: 10, fontWeight: 700 }}>
                    {presetEdited ? 'LOADED · EDITED' : 'LOADED'}
                  </span>
                ) : null}
                <div className="pu-mut" style={{ fontSize: 10.5, marginTop: 3 }}>
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="pu-health-wrap" style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 8 }}>
        <span
          className={`pu-health ${health === 'green' ? '' : health}`}
          aria-label={`Network health: ${HEALTH_TEXT[health]}`}
        >
          ● {HEALTH_TEXT[health]}
        </span>
        <span
          className="pu-capex"
          role="region"
          aria-live="polite"
          data-testid="capex-telemetry"
          aria-label={`Network CAPEX ${formatUsd(costBreakdown.totalCapex)}; ${formatUsd(costBreakdown.costPerHomePassed)} per home passed`}
        >
          CAPEX <strong>{formatUsd(costBreakdown.totalCapex, true)}</strong>
          <span style={{ opacity: 0.7 }}>{formatUsd(costBreakdown.costPerHomePassed)} / Home Passed</span>
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {stale ? <span className="pu-health amber">UNSAVED BUDGET — RUN SIMULATION</span> : null}

      <div className="relative" ref={zoomRef}>
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
          {Math.round(zoom * 100)}% <ChevronDown size={14} className="pu-mut" />
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

      <button type="button" className="pu-btn pri" onClick={onRunTest} disabled={testing} aria-label="Run Simulation">
        {testing ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} fill="currentColor" />}
        Run Simulation
      </button>
      <button type="button" className="pu-btn" onClick={onOpenBOM} aria-label="Bill of Materials">
        <FileBarChart size={15} /> Reports
      </button>
    </header>
  );
}

export default TopBar;
