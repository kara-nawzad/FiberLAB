import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import type { OdfNode as OdfFlowNode } from '../../types';
import { computeOdfLoss } from '../../engine/opticalSimulator';

/**
 * Optical Distribution Frame (ODF) — rendered as a 1U rack-mounted metal
 * patch panel with numbered SC/APC bulkhead adapter ports (01–12), rack mounting
 * ears, and two matched optical through-coupler pairs (in-0/out-0, in-1/out-1).
 */
export function ODFNode({ id, data, selected }: NodeProps<OdfFlowNode>) {
  const edges = useStore((state) => state.edges);
  const inputCount = edges.filter((edge) => edge.target === id).length;
  const outputCount = edges.filter((edge) => edge.source === id).length;
  const lossDb = computeOdfLoss(data.throughPortLossDb);

  return (
    <div className="relative w-[208px]">
      {/* Left & Right SC/APC Adapter Bulkhead Boots aligned with Handles */}
      {[0, 1].map((index) => {
        const topPct = ((index + 1) / 3) * 100;
        return (
          <div
            key={`left-boot-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute -left-2 -translate-y-1/2 flex items-center"
            style={{ top: `${topPct}%` }}
          >
            <span className="h-4 w-3 rounded-l border border-emerald-500 bg-emerald-600 shadow-sm" />
          </div>
        );
      })}
      {[0, 1].map((index) => {
        const topPct = ((index + 1) / 3) * 100;
        return (
          <div
            key={`right-boot-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -translate-y-1/2 flex items-center"
            style={{ top: `${topPct}%` }}
          >
            <span className="h-4 w-3 rounded-r border border-emerald-500 bg-emerald-600 shadow-sm" />
          </div>
        );
      })}

      <div
        className={`node-shell relative overflow-hidden rounded-lg border-2 bg-slate-800 p-2 text-slate-100 transition-all duration-150 ${
          selected ? 'border-violet-600 shadow-lg' : 'border-slate-600'
        }`}
      >
        {/* Top 1U Patch Panel Silkscreen Bar */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
          <div>
            <div className="font-mono text-caption font-bold uppercase tracking-wider text-teal-300">
              1U RACK PATCH FIELD · SC/APC
            </div>
            <div className="font-sans text-body font-bold leading-tight text-white">ODF rack panel</div>
          </div>
          <span className="rounded border border-teal-500/40 bg-teal-950/80 px-2 py-1 font-mono text-label font-semibold text-teal-200">
            −{lossDb.toFixed(2)} dB / pair
          </span>
        </div>

        {/* 12-Port SC/APC Coupling Adapter Row (01 through 12) */}
        <div className="my-2 rounded border border-slate-700 bg-slate-900 p-2">
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 6 }, (_, idx) => {
              const portNum = String(idx + 1).padStart(2, '0');
              const isMatchedPair = idx < 2;
              return (
                <div
                  key={portNum}
                  className={`flex flex-col items-center rounded border py-1 font-mono text-caption ${
                    isMatchedPair
                      ? 'border-emerald-500/80 bg-emerald-950 text-emerald-200'
                      : 'border-slate-700 bg-slate-800 text-slate-400'
                  }`}
                >
                  <span>{portNum}</span>
                  <span
                    className={`mt-1 h-1.5 w-2.5 rounded-xs ${isMatchedPair ? 'bg-emerald-500' : 'bg-slate-600'}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Matched Through-Pair Status Footer */}
        <div className="flex items-center justify-between font-mono text-label text-slate-300">
          <span>2 × matched pair</span>
          <span>
            {inputCount}/2 in · {outputCount}/2 out patched
          </span>
        </div>
      </div>

      {[0, 1].map((index) => (
        <Handle
          key={`in-${index}`}
          id={`in-${index}`}
          type="target"
          position={Position.Left}
          aria-label={`ODF input ${index + 1}`}
          title={`ODF matched through-pair ${index + 1} input`}
          style={{
            left: -10,
            top: `${((index + 1) / 3) * 100}%`,
            borderColor: '#16A34A',
            background: '#DCFCE7',
          }}
        />
      ))}
      {[0, 1].map((index) => (
        <Handle
          key={`out-${index}`}
          id={`out-${index}`}
          type="source"
          position={Position.Right}
          aria-label={`ODF output ${index + 1}`}
          title={`ODF matched through-pair ${index + 1} output`}
          style={{
            right: -10,
            top: `${((index + 1) / 3) * 100}%`,
            borderColor: '#16A34A',
            background: '#DCFCE7',
          }}
        />
      ))}
    </div>
  );
}

export default ODFNode;
