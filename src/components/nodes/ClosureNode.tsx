import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import type { ClosureNode as ClosureFlowNode } from '../../types';
import { CLOSURE_INPUT_PORTS, CLOSURE_OUTPUT_PORTS, SPLICE_TRAY_CHANNELS } from '../../types';
import { computeClosureSpliceLoss } from '../../engine/opticalSimulator';

const BRANCH_NAMES = ['A', 'B', 'C', 'D'];

/**
 * OSP Dome Splice Closure — rendered as an IP68 ribbed black polypropylene
 * dome housing with a metallic V-band clamping collar, 2 feeder entry glands
 * on the left, and 4 branch glands on the right mapped to TIA-598 splice tray
 * channels 1–4.
 */
export function ClosureNode({ id, data, selected }: NodeProps<ClosureFlowNode>) {
  const activeBranches = useStore((state) =>
    state.edges.reduce((count, edge) => (edge.source === id ? count + 1 : count), 0),
  );
  const activeSplices = data.activeSpliceChannels.filter(Boolean).length;
  const spliceLossDb = computeClosureSpliceLoss(data);

  return (
    <div className="relative w-[208px]">
      {/* Left Feeder Entry Cable Seals */}
      {Array.from({ length: CLOSURE_INPUT_PORTS }, (_, index) => {
        const topPct = ((index + 1) / (CLOSURE_INPUT_PORTS + 1)) * 100;
        return (
          <div
            key={`seal-in-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute -left-2 -translate-y-1/2 flex items-center"
            style={{ top: `${topPct}%` }}
          >
            <span className="h-4 w-3 rounded-l border border-slate-500 bg-slate-800 shadow-sm" />
          </div>
        );
      })}

      {/* Right Branch Cable Seals colored by TIA-598 Tray Channel */}
      {Array.from({ length: CLOSURE_OUTPUT_PORTS }, (_, index) => {
        const topPct = ((index + 1) / (CLOSURE_OUTPUT_PORTS + 1)) * 100;
        const channel = SPLICE_TRAY_CHANNELS[index];
        return (
          <div
            key={`seal-out-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -translate-y-1/2 flex items-center"
            style={{ top: `${topPct}%` }}
          >
            <span
              className="h-3.5 w-3 rounded-r border border-slate-700 shadow-sm"
              style={{ background: channel.hex }}
            />
          </div>
        );
      })}

      <div
        className={`node-shell relative overflow-hidden rounded-2xl border-2 p-3 text-slate-100 transition-all duration-150 ${
          selected ? 'border-violet-600 shadow-lg' : 'border-slate-700'
        }`}
        style={{
          background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
        }}
      >
        {/* Top Dome Header */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <div>
            <div className="font-mono text-caption font-bold uppercase tracking-wider text-amber-300">
              OSP JOINT ENCLOSURE · IP68
            </div>
            <div className="font-sans text-body font-bold leading-tight text-white">Dome splice closure</div>
          </div>
          <span className="rounded border border-slate-600 bg-slate-900 px-2 py-1 font-mono text-label font-semibold text-amber-300">
            −{spliceLossDb.toFixed(2)} dB
          </span>
        </div>

        {/* Splice Organizer Tray Preview (Channels 1–4 Blue/Orange/Green/Brown) */}
        <div className="my-2 rounded-lg border border-slate-700 bg-slate-900/90 p-2">
          <div className="mb-1 flex items-center justify-between font-mono text-caption text-slate-400">
            <span>SPLICE TRAY CHANNELS A–D</span>
            <span className="text-emerald-400 font-semibold">{activeSplices}/12 spliced</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {BRANCH_NAMES.map((branch, idx) => {
              const ch = SPLICE_TRAY_CHANNELS[idx];
              const active = data.activeSpliceChannels[idx] ?? false;
              return (
                <div
                  key={branch}
                  className={`flex items-center justify-between rounded-md border px-2 py-1 font-mono text-caption ${
                    active
                      ? 'border-slate-600 bg-slate-800 text-white'
                      : 'border-red-900/70 bg-red-950/60 text-red-300 line-through'
                  }`}
                >
                  <span>{branch}</span>
                  <span className="h-2 w-2 rounded-full" style={{ background: ch.hex }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Telemetry */}
        <div className="flex items-center justify-between font-mono text-label text-slate-300">
          <span>{activeBranches}/4 branches patched</span>
          <span>FOSC-400B4</span>
        </div>
      </div>

      {Array.from({ length: CLOSURE_INPUT_PORTS }, (_, index) => (
        <Handle
          key={`in-${index}`}
          id={`in-${index}`}
          type="target"
          position={Position.Left}
          aria-label={`Dome closure feeder input ${index + 1}`}
          title={`Feeder/input entry ${index + 1}`}
          style={{
            left: -10,
            top: `${((index + 1) / (CLOSURE_INPUT_PORTS + 1)) * 100}%`,
            borderColor: '#16A34A',
            background: '#DCFCE7',
          }}
        />
      ))}
      {Array.from({ length: CLOSURE_OUTPUT_PORTS }, (_, index) => {
        const channel = SPLICE_TRAY_CHANNELS[index];
        const active = data.activeSpliceChannels[index] ?? false;
        return (
          <Handle
            key={`out-${index}`}
            id={`out-${index}`}
            type="source"
            position={Position.Right}
            aria-label={`Dome closure branch ${BRANCH_NAMES[index]} output, channel ${index + 1} ${channel.name}`}
            title={`Branch ${BRANCH_NAMES[index]} → ${channel.name} tray channel ${index + 1}${active ? '' : ' (unspliced)'}`}
            style={{
              right: -10,
              top: `${((index + 1) / (CLOSURE_OUTPUT_PORTS + 1)) * 100}%`,
              borderColor: active ? '#16A34A' : '#DC2626',
              background: active ? '#DCFCE7' : '#FEE2E2',
            }}
          />
        );
      })}
    </div>
  );
}

export default ClosureNode;
