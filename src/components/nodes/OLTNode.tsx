import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Power, PowerOff, Radio } from 'lucide-react';
import type { OltNode as OltFlowNode } from '../../types';
import { OLT_CLASS_SPECS, PON_STANDARD_SPECS } from '../../types';
import { getHardwareProfileForNode } from '../../data/componentCatalogue';
import { Badge, NodeShell, Stat } from './nodeShared';

/**
 * OLT transceiver — the light source of the PON.
 * Displays launch power, PON port identity, wavelength and laser state.
 */
export function OLTNode({ data, selected }: NodeProps<OltFlowNode>) {
  const spec = OLT_CLASS_SPECS[data.oltClass];
  const ponStandard = data.ponStandard ?? 'GPON';
  const ponSpec = PON_STANDARD_SPECS[ponStandard];
  const hardware = getHardwareProfileForNode('olt', data.oltClass);
  const accent = data.laserOn ? '#2563eb' : '#64748b';

  return (
    <div className="relative w-[236px]">
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        className="!top-1/2"
        aria-label="SC/UPC optical output"
        title="SC/UPC port cue — confirm the installed optic"
        style={{ right: -6, borderColor: '#2563eb', background: '#eff6ff' }}
      />
      <NodeShell
        eyebrow="Headend"
        title={data.portName}
        icon={<Radio size={14} />}
        thumbnail={{ src: hardware.thumbnailSvg, alt: `${hardware.modelName} illustration` }}
        accent={accent}
        selected={selected}
        ringClass={data.laserOn ? 'border-blue-300' : 'border-slate-300'}
        footer={
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide ${
                data.laserOn ? 'text-emerald-300' : 'text-noc-400'
              }`}
            >
              {data.laserOn ? <Power size={11} /> : <PowerOff size={11} />}
              Laser {data.laserOn ? 'On' : 'Off'}
            </span>
            <span className="font-mono text-[10px] text-noc-400">{data.wavelength} nm</span>
          </div>
        }
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Badge className="border-blue-200 bg-blue-50 text-blue-800">{ponStandard}</Badge>
          <Badge className="border-blue-200 bg-blue-50 text-blue-800">Class {data.oltClass}</Badge>
          <span className="truncate text-[10px] text-noc-400">{ponSpec.downstreamGbps.toFixed(3)} / {ponSpec.upstreamGbps.toFixed(3)} Gbps</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat
            label="Tx Power"
            value={`${data.txPowerDbm >= 0 ? '+' : ''}${data.txPowerDbm.toFixed(1)} dBm`}
            tone={data.laserOn ? 'text-sky-300' : 'text-noc-400'}
          />
          <Stat label="Rx Sens." value={`${spec.rxSensitivityDbm.toFixed(0)} dBm`} />
        </div>
      </NodeShell>
    </div>
  );
}

export default OLTNode;
