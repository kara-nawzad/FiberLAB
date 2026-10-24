import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, CircleHelp, Flag, Play, RotateCcw, X } from 'lucide-react';
import type { PonEdge, PonNode, SimulationResult } from '../types';
import type { NetworkCostBreakdown } from '../data/pricingCatalogue';
import { formatDbm } from '../engine/opticalSimulator';
import { evaluateMissionObjectives, MISSIONS, type Mission } from '../engine/missions';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface MissionDrawerProps {
  open: boolean;
  activeMissionId: string | null;
  nodes: PonNode[];
  edges: PonEdge[];
  simulation: SimulationResult;
  costBreakdown: NetworkCostBreakdown;
  onClose: () => void;
  onStartMission: (mission: Mission) => void;
}

function DifficultyPill({ difficulty }: { difficulty: Mission['difficulty'] }) {
  const tone =
    difficulty === 'Beginner'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : difficulty === 'Intermediate'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-violet-200 bg-violet-50 text-violet-800';

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-caption font-semibold ${tone}`}>{difficulty}</span>
  );
}

export function MissionDrawer({
  open,
  activeMissionId,
  nodes,
  edges,
  simulation,
  costBreakdown,
  onClose,
  onStartMission,
}: MissionDrawerProps) {
  const [selectedMissionId, setSelectedMissionId] = useState(activeMissionId ?? MISSIONS[0]?.id ?? '');
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const { dialogRef } = useDialogA11y({ open, onClose, initialFocusRef: titleRef });

  useEffect(() => {
    if (activeMissionId) setSelectedMissionId(activeMissionId);
  }, [activeMissionId]);

  const mission = useMemo(
    () => MISSIONS.find((candidate) => candidate.id === selectedMissionId) ?? MISSIONS[0],
    [selectedMissionId],
  );

  if (!open || !mission) return null;

  const isActive = activeMissionId === mission.id;
  const progress = isActive ? evaluateMissionObjectives(mission, simulation, nodes, edges, costBreakdown) : [];
  const completedCount = progress.filter((item) => item.isMet).length;
  const isComplete = isActive && completedCount === mission.objectives.length;
  const progressPercent = isActive ? (completedCount / mission.objectives.length) * 100 : 0;
  const connectedCount = simulation.summary.subscriberCount - simulation.summary.byStatus.DISCONNECTED;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close field missions"
        tabIndex={-1}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-drawer-title"
        className="mission-drawer relative flex h-full w-full max-w-[440px] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-caption font-bold uppercase tracking-eyebrow text-blue-700">
              <Flag size={14} /> FiberLAB training
            </div>
            <h2
              id="mission-drawer-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-section font-bold leading-tight tracking-tight text-slate-900 outline-none"
            >
              Field missions
            </h2>
            <p className="mt-1 text-body text-slate-600">Practice network build and fault-finding.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Close missions drawer"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-label font-bold uppercase tracking-eyebrow text-slate-500">Choose a mission</h3>
            {activeMissionId ? (
              <span className="inline-flex items-center gap-2 text-caption font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Mission active
              </span>
            ) : null}
          </div>

          <div className="grid gap-2">
            {MISSIONS.map((candidate) => {
              const active = candidate.id === selectedMissionId;
              const currentlyRunning = candidate.id === activeMissionId;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedMissionId(candidate.id)}
                  className={`w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    active
                      ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-body font-semibold text-slate-900">{candidate.title}</span>
                    <span className="flex items-center gap-2">
                      {currentlyRunning ? (
                        <span className="font-mono text-caption font-bold uppercase text-emerald-700">Active</span>
                      ) : null}
                      <DifficultyPill difficulty={candidate.difficulty} />
                    </span>
                  </div>
                  <p className="line-clamp-2 text-body leading-relaxed text-slate-600">{candidate.scenarioBrief}</p>
                </button>
              );
            })}
          </div>

          <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-caption font-bold uppercase tracking-eyebrow text-blue-700">Scenario brief</p>
                <h3 className="mt-1 text-sm font-bold text-slate-900">{mission.title}</h3>
              </div>
              <DifficultyPill difficulty={mission.difficulty} />
            </div>
            <p className="mt-2 text-body leading-relaxed text-slate-700">{mission.scenarioBrief}</p>
            <button
              type="button"
              onClick={() => onStartMission(mission)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {isActive ? <RotateCcw size={14} /> : <Play size={14} />}
              {isActive ? 'Restart mission' : 'Start mission'}
            </button>
          </section>

          <section className="mt-4" aria-labelledby="mission-objectives-title">
            <div className="mb-2 flex items-center justify-between">
              <h3
                id="mission-objectives-title"
                className="text-label font-bold uppercase tracking-eyebrow text-slate-700"
              >
                Objectives
              </h3>
              {isActive ? (
                <span className="font-mono text-caption font-semibold text-slate-600">
                  {completedCount}/{mission.objectives.length} complete
                </span>
              ) : null}
            </div>
            {isActive ? (
              <div
                role="progressbar"
                aria-label="Mission objective progress"
                aria-valuemin={0}
                aria-valuemax={mission.objectives.length}
                aria-valuenow={completedCount}
                className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : (
              <p className="mb-2 rounded-md border border-blue-100 bg-blue-50 px-2 py-2 text-body leading-relaxed text-blue-900">
                Start this mission to load its scenario and turn on live objective tracking.
              </p>
            )}

            <ol className="grid gap-2">
              {mission.objectives.map((objective, index) => {
                const met = isActive && Boolean(progress[index]?.isMet);
                return (
                  <li
                    key={objective.id}
                    className={`flex items-start gap-2 rounded-lg border p-2 transition-all duration-300 ${
                      met ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span
                      className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-caption font-bold transition-all duration-300 ${
                        met
                          ? 'mission-check-complete border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white text-slate-500'
                      }`}
                      role="img"
                      aria-label={met ? 'Objective complete' : 'Objective incomplete'}
                    >
                      {met ? <Check size={12} strokeWidth={3} /> : index + 1}
                    </span>
                    <span
                      className={`text-body leading-relaxed ${met ? 'font-medium text-emerald-900' : 'text-slate-700'}`}
                    >
                      {objective.description}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {isComplete ? (
            <section
              className="mission-complete-banner mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
                Mission complete
              </div>
              <p className="mt-1 text-body leading-relaxed text-emerald-800">
                Excellent field work. Your current network meets every mission objective.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-emerald-200/80 bg-white/80 p-2">
                  <div className="text-caption font-semibold uppercase tracking-label text-slate-500">Mean Rx</div>
                  <div className="mt-1 font-mono text-label font-bold text-slate-900">
                    {formatDbm(simulation.summary.meanRxDbm)}
                  </div>
                </div>
                <div className="rounded-md border border-emerald-200/80 bg-white/80 p-2">
                  <div className="text-caption font-semibold uppercase tracking-label text-slate-500">Worst Rx</div>
                  <div className="mt-1 font-mono text-label font-bold text-slate-900">
                    {formatDbm(simulation.summary.worstRxDbm)}
                  </div>
                </div>
                <div className="rounded-md border border-emerald-200/80 bg-white/80 p-2">
                  <div className="text-caption font-semibold uppercase tracking-label text-slate-500">Margin</div>
                  <div className="mt-1 font-mono text-label font-bold text-slate-900">
                    {simulation.safetyMarginDb.toFixed(1)} dB
                  </div>
                </div>
              </div>
              <p className="mt-2 text-body text-emerald-800">
                {simulation.summary.byStatus.ONLINE} online · {connectedCount} connected ·{' '}
                {simulation.summary.totalFiberKm.toFixed(2)} km of plant
              </p>
            </section>
          ) : null}

          <details className="mt-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/70">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-label font-semibold text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <CircleHelp size={14} className="text-amber-700" /> Field hints
              <ChevronDown size={14} className="ml-auto transition-transform details-chevron" />
            </summary>
            <ol className="grid gap-2 border-t border-amber-200 px-3 py-3">
              {mission.fieldHints.map((hint, index) => (
                <li key={hint} className="flex gap-2 text-body leading-relaxed text-amber-950">
                  <span className="font-mono font-bold text-amber-800">{String(index + 1).padStart(2, '0')}</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 text-body leading-relaxed text-slate-500">
          Learning simulation only. Confirm live-network decisions against current standards, product datasheets, and
          qualified field procedures.
        </footer>
      </aside>
    </div>
  );
}

export default MissionDrawer;
