import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import { Split } from 'lucide-react';
import type { SplitterNode as SplitterFlowNode } from '../../types';
import { SPLITTER_OUTPUT_PORTS } from '../../types';
import { computeSplitterLoss } from '../../engine/opticalSimulator';
import { getHardwareProfileForNode } from '../../data/componentCatalogue';
import { Badge, NodeShell, Stat } from './nodeShared';

/**
 * Passive optical splitter — 1 input, N outputs.
 * Every output carries the full catalogue + excess loss; there is no
 * "shared" penalty, which matches how a real PON budget is written.
 */
export function SplitterNode({ id, data, selected }: NodeProps<SplitterFlowNode>) {
  const portCount = SPLITTER_OUTPUT_PORTS[data.ratio];
  const lossDb = computeSplitterLoss(data);
  const hardware = getHardwareProfileForNode('splitter', String(data.ratio));
  const activePorts = useStore((state) =>
    state.edges.reduce((count, edge) => (edge.source === id ? count + 1 : count), 0),
  );

  return (
    <div className="relative w-[224px]">
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!top-1/2"
        aria-label="SC/APC splitter input"
        title="SC/APC input cue — confirm the installed pigtail"
        style={{ left: -6, borderColor: '#16a34a', background: '#f0fdf4' }}
      />
      {Array.from({ length: portCount }, (_, index) => (
        <Handle
          key={`out-${index}`}
          id={`out-${index}`}
          type="source"
          position={Position.Right}
          aria-label={`SC/APC splitter output ${index + 1}`}
          title={`SC/APC output ${index + 1} cue — confirm the installed pigtail`}
          style={{
            right: -6,
            top: `${((index + 1) / (portCount + 1)) * 100}%`,
            borderColor: '#16a34a',
            background: '#f0fdf4',
          }}
        />
      ))}
      <NodeShell
        eyebrow="Passive Split"
        title={`1:${data.ratio} PLC Splitter`}
        icon={<Split size={14} />}
        thumbnail={{ src: hardware.thumbnailSvg, alt: `${hardware.modelName} illustration` }}
        accent="#7c3aed"
        selected={selected}
        ringClass="border-purple-200"
        footer={
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-noc-400">
              {activePorts}/{portCount} trunk{portCount === 1 ? '' : 's'} patched
            </span>
            <span className="font-mono text-[10px] font-semibold text-purple-300">
              −{lossDb.toFixed(2)} dB
            </span>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge className="border-purple-200 bg-purple-50 text-purple-800">1:{data.ratio}</Badge>
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">SC/APC</Badge>
          {data.excessLossDb > 0 ? (
            <Badge className="border-amber-200 bg-amber-50 text-amber-900">
              +{data.excessLossDb.toFixed(1)} dB excess
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Insertion Loss" value={`${lossDb.toFixed(2)} dB`} tone="text-purple-300" />
          <Stat label="Output Ports" value={`${portCount} × SC/APC`} />
        </div>
      </NodeShell>
    </div>
  );
}

export default SplitterNode;
