import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle, Cable } from 'lucide-react';
import type { FiberNode as FiberFlowNode } from '../../types';
import { CABLE_SPECS } from '../../types';
import { computeFiberLoss } from '../../engine/opticalSimulator';
import { getHardwareProfileForNode } from '../../data/componentCatalogue';
import { Badge, NodeShell, Stat } from './nodeShared';

/**
 * Fiber cable span — a first-class element that owns its own length, splice
 * count, connector count and operating wavelength.
 */
export function FiberNode({ data, selected }: NodeProps<FiberFlowNode>) {
  const spec = CABLE_SPECS[data.cableType];
  const loss = computeFiberLoss(data);
  const hardware = getHardwareProfileForNode('fiber', data.cableType);
  const overridden = data.attenuationOverrideDbPerKm !== null;

  return (
    <div className="relative w-[244px]">
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!top-1/2"
        aria-label="SC/APC cable input"
        title="SC/APC connector cue — verify polish and connector count"
        style={{ left: -6, borderColor: '#16a34a', background: '#f0fdf4' }}
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className="!top-1/2"
        aria-label="SC/APC cable output"
        title="SC/APC connector cue — verify polish and connector count"
        style={{ right: -6, borderColor: '#16a34a', background: '#f0fdf4' }}
      />
      <NodeShell
        eyebrow={spec.short}
        title={`${data.lengthKm.toFixed(3)} km span`}
        icon={<Cable size={14} />}
        thumbnail={{ src: hardware.thumbnailSvg, alt: `${hardware.modelName} illustration` }}
        accent={spec.accent}
        selected={selected}
        ringClass="border-noc-600"
        footer={
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-noc-400">
              {loss.attenuationDbPerKm.toFixed(2)} dB/km @ {data.wavelength} nm
              {overridden ? ' *' : ''}
            </span>
            <span className="font-mono text-[10px] font-semibold text-amber-800">
              −{loss.totalDb.toFixed(2)} dB
            </span>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge
            className="border-noc-500 bg-noc-700/60 text-noc-200"
          >
            {spec.label}
          </Badge>
          {overridden ? <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-200">custom α</Badge> : null}
          {loss.macroBendLossDb > 0 ? (
            <Badge className="fiber-fault-badge border-orange-300 bg-orange-50 text-orange-900">
              <AlertTriangle size={10} aria-hidden="true" /> Macro-bend +{loss.macroBendLossDb.toFixed(2)} dB
            </Badge>
          ) : null}
          {loss.dirtyConnectorLossDb > 0 ? (
            <Badge className="fiber-fault-badge border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle size={10} aria-hidden="true" /> Dust +{loss.dirtyConnectorLossDb.toFixed(2)} dB
            </Badge>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Cable" value={`${loss.cableDb.toFixed(2)}`} />
          <Stat label={`${data.splices}× SPL`} value={`${loss.spliceDb.toFixed(2)}`} />
          <Stat label={`${data.connectors}× CON`} value={`${loss.connectorDb.toFixed(2)}`} />
        </div>
        <div className="mt-1.5 text-[9px] text-noc-500">dB — splice 0.1 · SC/APC 0.5</div>
      </NodeShell>
    </div>
  );
}

export default FiberNode;
