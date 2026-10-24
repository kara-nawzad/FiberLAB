import { Crosshair, ExternalLink, ScanLine, ClipboardList, Trash2, ArrowLeft, Gauge } from 'lucide-react';
import type { DesignSettings } from '../types';

/* ========================================================================== *
 * Settings — the fourth section: simulation options, test gear, workspace.
 *
 * It holds the same handlers as the canvas overflow menu, but laid out as a
 * page instead of a popover so nothing has to be hunted for mid-drawing.
 * ========================================================================== */

interface SettingsScreenProps {
  settings: DesignSettings;
  onSettingsChange: (patch: Partial<DesignSettings>) => void;
  opmActive: boolean;
  onToggleOpm: () => void;
  onOpenOtdr: () => void;
  onOpenMissions: () => void;
  onClear: () => void;
  onOpenOverview: () => void;
}

export function SettingsScreen({
  settings,
  onSettingsChange,
  opmActive,
  onToggleOpm,
  onOpenOtdr,
  onOpenMissions,
  onClear,
  onOpenOverview,
}: SettingsScreenProps) {
  return (
    <section className="pu-screen" aria-labelledby="settings-title">
      <header className="pu-screen-head">
        <div className="pu-screen-head-copy">
          <h1 id="settings-title">Settings</h1>
          <p>
            Simulation behaviour, test gear and workspace actions. Optical physics stays the same — these only change
            how it is reported.
          </p>
        </div>
      </header>

      <div className="pu-screen-body">
        <div className="pu-screen-cards">
          <section className="pu-screen-card" aria-labelledby="settings-sim-title">
            <div className="pu-screen-card-head">
              <h2 id="settings-sim-title">Simulation</h2>
            </div>

            <div className="pu-set-row">
              <label className="pu-set-label" htmlFor="settings-safety-margin">
                Global safety margin
              </label>
              <div className="pu-set-control">
                <input
                  id="settings-safety-margin"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={settings.safetyMarginDb}
                  onChange={(event) =>
                    onSettingsChange({ safetyMarginDb: Math.max(0, Number(event.target.value) || 0) })
                  }
                  className="pu-input-sm"
                />
                <span className="pu-mut">dB</span>
              </div>
            </div>
            <p className="pu-set-note">
              Spare loss reserved on every path. It is added to the budget, never to a measured reading.
            </p>

            <div className="pu-set-row">
              <span className="pu-set-label" id="settings-auto-label">
                Auto-run
              </span>
              <div className="pu-set-control">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.autoRun}
                  aria-labelledby="settings-auto-label"
                  onClick={() => onSettingsChange({ autoRun: !settings.autoRun })}
                  className={`pu-switch ${settings.autoRun ? 'is-on' : ''}`}
                >
                  Auto {settings.autoRun ? 'on' : 'off'}
                </button>
              </div>
            </div>
            <p className="pu-set-note">
              On, every edit recalculates the budget. Off, the canvas keeps the last run until you press Run Simulation.
            </p>
          </section>

          <section className="pu-screen-card" aria-labelledby="settings-gear-title">
            <div className="pu-screen-card-head">
              <h2 id="settings-gear-title">Test gear &amp; missions</h2>
            </div>
            <div className="pu-set-actions">
              <button
                type="button"
                className="pu-btn"
                onClick={onToggleOpm}
                aria-pressed={opmActive}
                aria-label={opmActive ? 'Close OPM' : 'OPM Tool'}
              >
                <Crosshair size={16} aria-hidden="true" /> {opmActive ? 'Close OPM' : 'OPM Tool'}
              </button>
              <button type="button" className="pu-btn" onClick={onOpenOtdr} aria-label="OTDR Trace">
                <ScanLine size={16} aria-hidden="true" /> OTDR Trace
              </button>
              <button type="button" className="pu-btn" onClick={onOpenMissions} aria-label="Missions">
                <ClipboardList size={16} aria-hidden="true" /> Missions
              </button>
            </div>
            <p className="pu-set-note">
              The power meter probes a port, the OTDR traces a route, and the guided missions walk through the same
              simulator.
            </p>
          </section>

          <section className="pu-screen-card" aria-labelledby="settings-work-title">
            <div className="pu-screen-card-head">
              <h2 id="settings-work-title">Workspace</h2>
            </div>
            <div className="pu-set-actions">
              <button type="button" className="pu-btn" onClick={onOpenOverview} aria-label="Overview & Physics">
                <ArrowLeft size={16} aria-hidden="true" /> Overview &amp; Physics
              </button>
              <button
                type="button"
                className="pu-btn pu-btn-danger"
                onClick={onClear}
                aria-label="Clear Canvas"
                title="Remove every element"
              >
                <Trash2 size={16} aria-hidden="true" /> Clear canvas
              </button>
            </div>
            <div className="pu-set-links" role="group" aria-label="Learning resources">
              <span>
                <Gauge size={14} aria-hidden="true" /> Need help?
              </span>
              <a
                href="https://github.com/kara-nawzad/FiberLAB/tree/main/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                Docs <ExternalLink size={12} aria-hidden="true" />
              </a>
              <a href="https://github.com/kara-nawzad/FiberLAB" target="_blank" rel="noopener noreferrer">
                GitHub <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export default SettingsScreen;
