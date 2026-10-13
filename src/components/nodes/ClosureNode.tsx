import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import { PackageOpen } from 'lucide-react';
import type { ClosureNode as ClosureFlowNode } from '../../types';
import { CLOSURE_INPUT_PORTS, CLOSURE_OUTPUT_PORTS, SPLICE_TRAY_CHANNELS } from '../../types';
import { computeClosureSpliceLoss } from '../../engine/opticalSimulator';
import { getHardwareProfileForNode } from '../../data/componentCatalogue';
import { Badge, NodeShell, Stat } from './nodeShared';

const BRANCH_NAMES = ['A', 'B', 'C', 'D'];

/** OSP dome splice closure; each visible branch port maps to tray channel 1–4. */
export function ClosureNode({ id, data, selected }: NodeProps<ClosureFlowNode>) {
  const hardware = getHardwareProfileForNode('closure');
  const activeBranches = useStore((state) =>
    state.edges.reduce((count, edge) => (edge.source === id ? count + 1 : count), 0),
  );
  const activeSplices = data.activeSpliceChannels.filter(Boolean).length;
  const spliceLossDb = computeClosureSpliceLoss(data);

  return (
    <div className="relative w-[248px]">
      {Array.from({ length: CLOSURE_INPUT_PORTS }, (_, index) => (
        <Handle
          key={`in-${index}`}
          id={`in-${index}`}
          type="target"
          position={Position.Left}
          aria-label={`Dome closure feeder input ${index + 1}`}
          title={`Feeder/input entry ${index + 1}`}
          style={{
            left: -6,
            top: `${((index + 1) / (CLOSURE_INPUT_PORTS + 1)) * 100}%`,
            borderColor: '#9b6d45',
            background: '#fff4e6',
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
              right: -6,
              top: `${((index + 1) / (CLOSURE_OUTPUT_PORTS + 1)) * 100}%`,
              borderColor: active ? '#0f8a5f' : '#b54b36',
              background: active ? '#e8f6ed' : '#fff0e9',
            }}
          />
        );
      })}
      <NodeShell
        eyebrow="OSP JOINT ENCLOSURE"
        title="Dome splice closure"
        icon={<PackageOpen size={14} />}
        thumbnail={{ src: hardware.thumbnailSvg, alt: `${hardware.modelName} illustration` }}
        accent="#2b3033"
        selected={selected}
        ringClass="border-stone-500"
        footer={
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-noc-400">{activeBranches}/4 branches patched</span>
            <span className="font-mono text-[10px] font-semibold text-amber-800">−{spliceLossDb.toFixed(2)} dB / splice</span>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge className="border-stone-300 bg-stone-100 text-stone-800">FOSC-style</Badge>
          <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800">IP68 ref.</Badge>
          <Badge className="border-blue-200 bg-blue-50 text-blue-800">{activeSplices}/12 spliced</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="Tray capacity" value="up to 48" />
          <Stat label="Active tray" value={`${activeSplices} fibers`} tone="text-emerald-700" />
        </div>
        <div className="mt-1.5 text-[9px] leading-snug text-noc-500">
          Branches A–D map to the Blue–Brown tray channels in this cable-level model.
        </div>
      </NodeShell>
    </div>
  );
}

export default ClosureNode;
