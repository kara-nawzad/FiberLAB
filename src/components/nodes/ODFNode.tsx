import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import { PanelsTopLeft } from 'lucide-react';
import type { OdfNode as OdfFlowNode } from '../../types';
import { computeOdfLoss } from '../../engine/opticalSimulator';
import { getHardwareProfileForNode } from '../../data/componentCatalogue';
import { Badge, NodeShell, Stat } from './nodeShared';

/** Two matched, independent adapter through-pairs in a representative ODF. */
export function ODFNode({ id, data, selected }: NodeProps<OdfFlowNode>) {
  const hardware = getHardwareProfileForNode('odf');
  const edges = useStore((state) => state.edges);
  const inputCount = edges.filter((edge) => edge.target === id).length;
  const outputCount = edges.filter((edge) => edge.source === id).length;
  const lossDb = computeOdfLoss(data.throughPortLossDb);

  return (
    <div className="relative w-[236px]">
      {[0, 1].map((index) => (
        <Handle
          key={`in-${index}`}
          id={`in-${index}`}
          type="target"
          position={Position.Left}
          aria-label={`ODF input ${index + 1}`}
          title={`ODF matched through-pair ${index + 1} input`}
          style={{
            left: -6,
            top: `${((index + 1) / 3) * 100}%`,
            borderColor: '#0f766e',
            background: '#ecfdf5',
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
            right: -6,
            top: `${((index + 1) / 3) * 100}%`,
            borderColor: '#0f766e',
            background: '#ecfdf5',
          }}
        />
      ))}
      <NodeShell
        eyebrow="HEADEND PATCH FIELD"
        title="ODF rack panel"
        icon={<PanelsTopLeft size={14} />}
        thumbnail={{ src: hardware.thumbnailSvg, alt: `${hardware.modelName} illustration` }}
        accent="#0f766e"
        selected={selected}
        ringClass="border-teal-300"
        footer={
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-noc-400">{inputCount}/2 in · {outputCount}/2 out patched</span>
            <span className="font-mono text-[10px] font-semibold text-teal-200">−{lossDb.toFixed(2)} dB / pair</span>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge className="border-teal-200 bg-teal-50 text-teal-800">2 × matched pair</Badge>
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Passive</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Through loss" value={`${lossDb.toFixed(2)} dB`} tone="text-teal-200" />
          <Stat label="Port pairs" value="2 in / 2 out" />
        </div>
      </NodeShell>
    </div>
  );
}

export default ODFNode;
