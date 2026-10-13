import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ClipboardList,
  Layers,
  Loader2,
  Trash2,
  Zap,
} from 'lucide-react';
import type { DesignSettings, NetworkSummary } from '../types';
import { PRESETS } from '../engine/presets';

/* ========================================================================== *
 * FiberLAB wordmark, network health, mission entry point, and global actions.
 * ========================================================================== */

type Health = 'green' | 'amber' | 'red' | 'idle';

interface TopBarProps {
  summary: NetworkSummary;
  settings: DesignSettings;
  onSettingsChange: (patch: Partial<DesignSettings>) => void;
  onPreset: (presetId: string) => void;
  onRunTest: () => void;
  onOpenBOM: () => void;
  onOpenMissions: () => void;
  onOpenOverview: () => void;
  activeMissionTitle: string | null;
  onClear: () => void;
  testing: boolean;
  stale: boolean;
  activePresetId: string | null;
}

function deriveHealth(summary: NetworkSummary): Health {
  if (summary.ontCount === 0) return 'idle';
  if (summary.byStatus.LOS > 0 || summary.byStatus.DISCONNECTED > 0) return 'red';
  if (summary.byStatus.WARNING > 0 || summary.byStatus.OVERLOAD > 0) return 'amber';
  return 'green';
}

const HEALTH_HEX: Record<Health, string> = {
  green: '#15803d',
  amber: '#a16207',
  red: '#dc2626',
  idle: '#64748b',
};

const HEALTH_TEXT: Record<Health, string> = {
  green: 'All subscribers optimal',
  amber: 'Marginal links detected',
  red: 'Fault on the network',
  idle: 'No subscribers provisioned',
};

function Pulse({ health }: { health: Health }) {
  const color = HEALTH_HEX[health];
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center" aria-hidden="true">
      {health !== 'idle' ? (
        <span
          className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full"
          style={{ background: color, opacity: 0.18 }}
        />
      ) : null}
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 0 3px ${color}1c` }}
      />
    </span>
  );
}

export function TopBar({
  summary,
  settings,
  onSettingsChange,
  onPreset,
  onRunTest,
  onOpenBOM,
  onOpenMissions,
  onOpenOverview,
  activeMissionTitle,
  onClear,
  testing,
  stale,
  activePresetId,
}: TopBarProps) {
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement | null>(null);
  const health = deriveHealth(summary);

  useEffect(() => {
    if (!presetOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(event.target as globalThis.Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [presetOpen]);

  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex min-w-[168px] items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
          <Activity size={17} strokeWidth={2.1} />
        </span>
        <div className="leading-tight">
          <div className="text-[17px] font-extrabold tracking-[-0.045em]" aria-label="FiberLAB">
            <span className="text-slate-950">Fiber</span><span className="text-blue-600">LAB</span>
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-500">
            FTTH / GPON engineering lab
          </div>
        </div>
      </div>

      <div
        className="flex min-w-[225px] items-center gap-2 rounded-lg border px-2.5 py-2"
        style={{ borderColor: `${HEALTH_HEX[health]}35`, background: `${HEALTH_HEX[health]}08` }}
        aria-label={`Network health: ${HEALTH_TEXT[health]}`}
      >
        <Pulse health={health} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold" style={{ color: HEALTH_HEX[health] }}>
          {HEALTH_TEXT[health]}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[9px] font-semibold">
          <span className="text-emerald-800">{summary.byStatus.ONLINE} up</span>
          <span className="text-amber-800">{summary.byStatus.WARNING} warn</span>
          <span className="text-red-700">{summary.byStatus.LOS + summary.byStatus.DISCONNECTED} down</span>
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
        <button id="studio-overview-toggle" type="button" className="btn-ghost" onClick={onOpenOverview} aria-label="Overview & Physics">
          <ArrowLeft size={14} aria-hidden="true" />
          Overview &amp; Physics
        </button>
        <button
          type="button"
          className={`btn-ghost relative ${activeMissionTitle ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100' : ''}`}
          onClick={onOpenMissions}
          aria-label={activeMissionTitle ? `Missions, active: ${activeMissionTitle}` : 'Missions'}
          title={activeMissionTitle ? `Active mission: ${activeMissionTitle}` : 'Open field missions'}
        >
          <ClipboardList size={14} />
          Missions
          {activeMissionTitle ? <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-blue-600" /> : null}
        </button>

        <div className="relative" ref={presetRef}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setPresetOpen((open) => !open)}
            aria-expanded={presetOpen}
            aria-label="Preset Topologies"
          >
            <Layers size={14} />
            Presets
            <ChevronDown size={13} className={`transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
          </button>
          {presetOpen ? (
            <div className="panel absolute right-0 top-[calc(100%+8px)] z-40 w-[min(330px,calc(100vw-24px))] overflow-hidden rounded-xl shadow-panel">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`block w-full border-b border-slate-100 px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${
                    activePresetId === preset.id ? 'bg-blue-50/70' : ''
                  }`}
                  onClick={() => {
                    onPreset(preset.id);
                    setPresetOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-slate-900">{preset.name}</span>
                    {activePresetId === preset.id ? (
                      <span className="font-mono text-[9px] font-bold text-blue-700">LOADED</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[10px] leading-snug text-slate-600">{preset.description}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
          <label htmlFor="safety-margin" className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
            Margin
          </label>
          <input
            id="safety-margin"
            type="number"
            min={0}
            max={10}
            step={0.5}
            className="input !w-12 !border-0 !bg-transparent !py-0 !text-center !text-[11px]"
            value={settings.safetyMarginDb}
            onChange={(event) =>
              onSettingsChange({ safetyMarginDb: Math.max(0, Number(event.target.value) || 0) })
            }
          />
          <span className="font-mono text-[9px] text-slate-500">dB</span>
          <span className="mx-0.5 h-4 w-px bg-slate-200" />
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoRun}
            onClick={() => onSettingsChange({ autoRun: !settings.autoRun })}
            title="Recalculate the optical budget on every edit"
            className="flex items-center gap-1.5"
          >
            <span
              className={`relative h-4 w-8 rounded-full transition-colors ${
                settings.autoRun ? 'bg-emerald-700' : 'bg-slate-400'
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                  settings.autoRun ? 'translate-x-[17px]' : 'translate-x-0.5'
                }`}
              />
            </span>
            <span className="text-[9px] font-medium text-slate-700">Auto</span>
          </button>
        </div>

        <button type="button" className="btn-primary" onClick={onRunTest} disabled={testing}>
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Run test
        </button>
        <button type="button" className="btn-ghost" onClick={onOpenBOM} aria-label="Bill of Materials">
          <Activity size={14} />
          BOM
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={onClear}
          title="Remove every element"
          aria-label="Clear Canvas"
        >
          <Trash2 size={14} />
          Clear
        </button>
        {stale ? (
          <span className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 font-mono text-[9px] font-semibold text-amber-900">
            UNSAVED BUDGET — RUN TEST
          </span>
        ) : null}
      </div>
    </header>
  );
}

export default TopBar;
