import { useRef, useState } from 'react';
import { Crosshair, ExternalLink, ScanLine, ClipboardList, Trash2, ArrowLeft, Gauge, Upload } from 'lucide-react';
import type { DesignLevel, DesignSettings } from '../types';
import { useSectionFocus } from '../hooks/useSectionFocus';
import { readFileText } from '../lib/readFileText';

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
  activeMissionTitle?: string | null;
  onClear: () => void;
  onOpenOverview: () => void;
  /** Reads a TopologyExport v2 JSON file back onto the canvas. */
  onImportTopology?: (text: string) => { ok: boolean; error?: string };
  detailLevel?: DesignLevel;
  onDetailLevelChange?: (level: DesignLevel) => void;
}

export function SettingsScreen({
  settings,
  onSettingsChange,
  opmActive,
  onToggleOpm,
  onOpenOtdr,
  onOpenMissions,
  activeMissionTitle = null,
  onClear,
  onOpenOverview,
  onImportTopology,
  detailLevel = 'guided',
  onDetailLevelChange,
}: SettingsScreenProps) {
  const headingRef = useSectionFocus<HTMLHeadingElement>();
  const importRef = useRef<HTMLInputElement | null>(null);
  const [importMessage, setImportMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [clearArmed, setClearArmed] = useState(false);

  const readImport = async (file: File) => {
    if (!onImportTopology) return;
    const text = await readFileText(file);
    const result = onImportTopology(text);
    setImportMessage(
      result.ok
        ? { tone: 'ok', text: `Imported ${file.name}.` }
        : { tone: 'error', text: result.error ?? 'That file could not be read.' },
    );
  };

  return (
    <section className="pu-screen" aria-labelledby="settings-title">
      <header className="pu-screen-head">
        <div className="pu-screen-head-copy">
          <h1 id="settings-title" ref={headingRef} tabIndex={-1}>
            Settings
          </h1>
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

            {onDetailLevelChange ? (
              <div className="pu-set-row">
                <span className="pu-set-label" id="settings-detail-label">
                  Detail level
                </span>
                <div className="pu-set-control" role="group" aria-labelledby="settings-detail-label">
                  <button
                    type="button"
                    className={`pu-btn${detailLevel === 'guided' ? ' is-active' : ''}`}
                    aria-pressed={detailLevel === 'guided'}
                    onClick={() => onDetailLevelChange('guided')}
                  >
                    Guided
                  </button>
                  <button
                    type="button"
                    className={`pu-btn${detailLevel === 'engineer' ? ' is-active' : ''}`}
                    aria-pressed={detailLevel === 'engineer'}
                    onClick={() => onDetailLevelChange('engineer')}
                  >
                    Engineer
                  </button>
                </div>
              </div>
            ) : null}
            <p className="pu-set-note">
              Guided keeps the essentials and hides loss tables. Engineer opens every table, allowance and hardware
              note.
            </p>

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
                  onChange={(event) => {
                    // Never turn a mistyped field into 0 dB of allowance.
                    const next = Number(event.target.value);
                    if (event.target.value.trim() === '' || !Number.isFinite(next)) return;
                    onSettingsChange({ safetyMarginDb: Math.max(0, next) });
                  }}
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
              <button
                type="button"
                className={`pu-btn${activeMissionTitle ? ' is-active' : ''}`}
                onClick={onOpenMissions}
                aria-label={activeMissionTitle ? `Missions, active: ${activeMissionTitle}` : 'Missions'}
              >
                <ClipboardList size={16} aria-hidden="true" /> Missions
              </button>
            </div>
            <p className="pu-set-note">
              {activeMissionTitle ? (
                <>
                  Active mission: <strong>{activeMissionTitle}</strong>. Each button opens on the canvas, where it acts.
                </>
              ) : (
                <>
                  The power meter probes a port, the OTDR traces a route, and the guided missions walk through the same
                  simulator.
                </>
              )}
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
              {onImportTopology ? (
                <>
                  <button
                    type="button"
                    className="pu-btn"
                    onClick={() => importRef.current?.click()}
                    aria-label="Import topology"
                    title="Read a topology JSON exported from Reports"
                  >
                    <Upload size={16} aria-hidden="true" /> Import topology
                  </button>
                  <input
                    ref={importRef}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    aria-label="Topology JSON file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) void readImport(file);
                    }}
                  />
                </>
              ) : null}
              {clearArmed ? (
                <>
                  <button
                    type="button"
                    className="pu-btn pu-btn-danger"
                    onClick={() => {
                      setClearArmed(false);
                      onClear();
                    }}
                    aria-label="Confirm clear canvas"
                    title="This removes every component; Ctrl/Cmd+Z brings it back"
                  >
                    <Trash2 size={16} aria-hidden="true" /> Confirm clear
                  </button>
                  <button type="button" className="pu-btn" onClick={() => setClearArmed(false)}>
                    Keep my design
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="pu-btn pu-btn-danger"
                  onClick={() => setClearArmed(true)}
                  aria-label="Clear Canvas"
                  title="Asks once, and can be undone with Ctrl/Cmd+Z"
                >
                  <Trash2 size={16} aria-hidden="true" /> Clear canvas
                </button>
              )}
            </div>
            {importMessage ? (
              <p
                className="pu-set-note"
                role="status"
                style={importMessage.tone === 'error' ? { color: 'var(--pu-warn-text)' } : undefined}
              >
                {importMessage.text}
              </p>
            ) : null}
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
