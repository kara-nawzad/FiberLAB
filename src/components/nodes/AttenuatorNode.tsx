import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import type { AttenuatorNode as AttenuatorFlowNode } from '../../types';
import { ATTENUATOR_VALUES_DB, normaliseAttenuatorDb } from '../../types';
import { computeAttenuatorLoss } from '../../engine/opticalSimulator';

/**
 * Fixed inline attenuator pad — an SC/APC male-to-female barrel the technician
 * inserts when a subscriber sits so close to the OLT that the receiver would
 * otherwise saturate above the −8 dBm overload limit. It is a straight
 * through-element: one input on the left, one output on the right, and a
 * constant insertion loss that never depends on wavelength.
 */
export function AttenuatorNode({ data, selected }: NodeProps<AttenuatorFlowNode>) {
  const lossDb = computeAttenuatorLoss(data);
  const stored = normaliseAttenuatorDb(data.attenuationDb);
  const mismatch = stored !== Number(data.attenuationDb);
  const strongestPad = ATTENUATOR_VALUES_DB[ATTENUATOR_VALUES_DB.length - 1];

  return (
    <div className="relative w-[184px]">
      {/* Yellow pad body peeking out on both sides, like the real barrel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-2 top-1/2 flex -translate-y-1/2 items-center"
      >
        <span className="h-4 w-3 rounded-l border border-amber-600 bg-amber-400 shadow-sm" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 top-1/2 flex -translate-y-1/2 items-center"
      >
        <span className="h-4 w-3 rounded-r border border-amber-600 bg-amber-400 shadow-sm" />
      </div>

      <div
        className={`node-shell relative overflow-hidden rounded-xl border-2 bg-white p-3 text-slate-900 transition-all duration-150 ${
          selected ? 'border-amber-600 shadow-lg' : 'border-slate-300'
        }`}
        style={{ minHeight: 112 }}
      >
        <div className="border-b border-slate-200 pb-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-caption font-bold uppercase tracking-label text-amber-700">
              INLINE PAD · {data.polish}
            </span>
            {mismatch ? <AlertTriangle size={12} aria-hidden="true" style={{ color: 'var(--pu-warn-text)' }} /> : null}
          </div>
          <div className="font-sans text-body font-bold leading-tight text-slate-900">Attenuator</div>
        </div>

        <div className="my-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-center">
          <div className="font-mono text-[26px] font-bold leading-none text-amber-800">−{lossDb.toFixed(0)} dB</div>
          <div className="mt-1 font-mono text-label text-amber-900/80">fixed insertion loss</div>
        </div>

        <div className="flex items-center justify-between font-mono text-label text-slate-600">
          <span>Straight through</span>
          <span className="font-semibold text-slate-800">max {strongestPad} dB</span>
        </div>
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        aria-label="Attenuator input"
        title="Attenuator input — patch cord from the plant side"
        style={{ left: -10, borderColor: '#B45309', background: '#FDE68A' }}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        aria-label="Attenuator output"
        title="Attenuator output — patch cord toward the ONT"
        style={{ right: -10, borderColor: '#B45309', background: '#FDE68A' }}
      />
    </div>
  );
}

export default AttenuatorNode;
