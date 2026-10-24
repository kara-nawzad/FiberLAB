import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import type { NapNode as NapFlowNode } from '../../types';
import { NAP_OUTPUT_PORTS, NAP_SPLIT_RATIO } from '../../types';
import { computeNapLoss } from '../../engine/opticalSimulator';

/**
 * Outdoor NAP / FAT (Fiber Access Terminal) — rendered as a rugged outdoor
 * pole/wall-mounted polycarbonate gray distribution enclosure with weather
 * latches, incoming feeder gland on the left, and 8 SC/APC subscriber drop
 * grommets on the right.
 */
export function NAPNode({ id, data, selected }: NodeProps<NapFlowNode>) {
  const outputCount = useStore((state) => state.edges.filter((edge) => edge.source === id).length);
  const lossDb = computeNapLoss(data.splitLossDb);

  return (
    <div className="relative w-[208px]">
      {/* Incoming Feeder Cable Gland on Left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-2.5 top-1/2 -translate-y-1/2 flex items-center"
      >
        <span className="h-4 w-3 rounded-l border border-slate-500 bg-slate-700 shadow-sm" />
      </div>

      {/* Outgoing 8 Subscriber Drop Grommets on Right */}
      {Array.from({ length: NAP_OUTPUT_PORTS }, (_, index) => {
        const topPct = ((index + 1) / (NAP_OUTPUT_PORTS + 1)) * 100;
        return (
          <div
            key={`drop-grommet-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute -right-2.5 -translate-y-1/2 flex items-center"
            style={{ top: `${topPct}%` }}
          >
            <span className="h-3 w-3 rounded-r border border-emerald-500 bg-emerald-600 shadow-sm" />
          </div>
        );
      })}

      <div
        className={`node-shell relative overflow-hidden rounded-xl border-2 bg-slate-100 p-3 text-slate-900 transition-all duration-150 ${
          selected ? 'border-violet-600 shadow-lg' : 'border-slate-300'
        }`}
        style={{ minHeight: 196 }}
      >
        {/* Side Mechanical Snap Latches */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-3 h-3 w-1.5 rounded-sm bg-orange-600"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 bottom-3 h-3 w-1.5 rounded-sm bg-orange-600"
        />

        {/* Weatherproof Enclosure Header */}
        <div className="border-b border-slate-200 pb-1.5 pr-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-caption font-bold uppercase tracking-wider text-orange-700">
              OUTDOOR ACCESS BOX · IP65
            </span>
            <span className="rounded bg-orange-100 px-1.5 py-0.2 font-mono text-label font-bold text-orange-900 border border-orange-300">
              1:{NAP_SPLIT_RATIO}
            </span>
          </div>
          <div className="font-sans text-body font-bold leading-tight text-slate-900">NAP / FAT · 1:8</div>
        </div>

        {/* Internal SC/APC Drop Adapter Cassette Bay */}
        <div className="my-2 rounded-lg border border-slate-300 bg-white p-2 shadow-inner">
          <div className="flex items-center justify-between font-mono text-label text-slate-600">
            <span>Feeder In → 1:8 PLC</span>
            <span className="font-bold text-orange-700">−{lossDb.toFixed(2)} dB</span>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1" aria-hidden="true">
            {Array.from({ length: 8 }, (_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-center rounded border border-emerald-300 bg-emerald-50 py-0.5 font-mono text-caption font-bold text-emerald-800"
              >
                D{idx + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Telemetry */}
        <div className="flex items-center justify-between font-mono text-label text-slate-600">
          <span>
            {outputCount}/{NAP_OUTPUT_PORTS} drops patched
          </span>
          <span className="font-semibold text-slate-800">SC/APC drops</span>
        </div>
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!top-1/2"
        aria-label="NAP feeder input"
        title="Outdoor NAP/FAT feeder input"
        style={{ left: -10, borderColor: '#16A34A', background: '#DCFCE7' }}
      />
      {Array.from({ length: NAP_OUTPUT_PORTS }, (_, index) => (
        <Handle
          key={`out-${index}`}
          id={`out-${index}`}
          type="source"
          position={Position.Right}
          aria-label={`NAP drop output ${index + 1}`}
          title={`1:8 NAP drop output ${index + 1}`}
          style={{
            right: -10,
            top: `${((index + 1) / (NAP_OUTPUT_PORTS + 1)) * 100}%`,
            borderColor: '#16A34A',
            background: '#DCFCE7',
          }}
        />
      ))}
    </div>
  );
}

export default NAPNode;
