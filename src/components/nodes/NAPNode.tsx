import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import { Network } from 'lucide-react';
import type { NapNode as NapFlowNode } from '../../types';
import { NAP_OUTPUT_PORTS, NAP_SPLIT_RATIO } from '../../types';
import { computeNapLoss } from '../../engine/opticalSimulator';
import { getHardwareProfileForNode } from '../../data/componentCatalogue';
import { Badge, NodeShell, Stat } from './nodeShared';

/** Outdoor NAP/FAT with a fixed educational internal 1:8 split-loss model. */
export function NAPNode({ id, data, selected }: NodeProps<NapFlowNode>) {
  const hardware = getHardwareProfileForNode('nap');
  const outputCount = useStore((state) =>
    state.edges.filter((edge) => edge.source === id).length,
  );
  const lossDb = computeNapLoss(data.splitLossDb);

  return (
    <div className="relative w-[248px]">
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!top-1/2"
        aria-label="NAP feeder input"
        title="Outdoor NAP/FAT feeder input"
        style={{ left: -6, borderColor: '#c2410c', background: '#fff7ed' }}
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
            right: -6,
            top: `${((index + 1) / (NAP_OUTPUT_PORTS + 1)) * 100}%`,
            borderColor: '#c2410c',
            background: '#fff7ed',
          }}
        />
      ))}
      <NodeShell
        eyebrow="OUTDOOR ACCESS POINT"
        title="NAP / FAT · 1:8"
        icon={<Network size={14} />}
        thumbnail={{ src: hardware.thumbnailSvg, alt: `${hardware.modelName} illustration` }}
        accent="#c2410c"
        selected={selected}
        ringClass="border-orange-300"
        footer={
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-noc-400">{outputCount}/{NAP_OUTPUT_PORTS} drops patched</span>
            <span className="font-mono text-[10px] font-semibold text-orange-200">−{lossDb.toFixed(2)} dB / branch</span>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge className="border-orange-200 bg-orange-50 text-orange-900">1 input → 8 drops</Badge>
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Weatherproof ref.</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Internal split" value={`1:${NAP_SPLIT_RATIO}`} tone="text-orange-200" />
          <Stat label="Reference loss" value={`${lossDb.toFixed(2)} dB`} />
        </div>
        <div className="mt-1.5 text-[9px] leading-snug text-noc-500">
          Simplified fixed 1:8 insertion-loss model; actual NAP/FAT loss is label- and SKU-dependent.
        </div>
      </NodeShell>
    </div>
  );
}

export default NAPNode;
