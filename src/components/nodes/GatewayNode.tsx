import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Router, Wifi, WifiOff } from 'lucide-react';
import type { GatewayNode as GatewayFlowNode, OntStatus } from '../../types';
import { STATUS_STYLES } from '../../types';
import { describeStatus } from '../../engine/opticalSimulator';
import { useSimulation } from '../../engine/SimulationContext';
import { getHardwareProfileForNode } from '../../data/componentCatalogue';
import { Badge, Led, NodeShell, Stat } from './nodeShared';

function formatMbps(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} Gbps` : `${Math.round(value)} Mbps`;
}

/** Integrated PON termination and Wi-Fi 6 gateway with live simulated service data. */
export function GatewayNode({ id, data, selected }: NodeProps<GatewayFlowNode>) {
  const simulation = useSimulation();
  const telemetry = simulation?.gatewayTelemetry[id];
  const hardware = getHardwareProfileForNode('gateway');
  const status: OntStatus = telemetry?.status ?? 'DISCONNECTED';
  const style = STATUS_STYLES[status];
  const rx = telemetry?.rxPowerDbm ?? null;
  const standard = telemetry?.ponStandard ?? null;
  const speedLabel = !telemetry || telemetry.estimatedDownMbps === null || telemetry.estimatedUpMbps === null
    ? 'No active service estimate'
    : `↓ ${formatMbps(telemetry.estimatedDownMbps)} · ↑ ${formatMbps(telemetry.estimatedUpMbps)}`;

  return (
    <div className="relative w-[252px]">
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!top-1/2"
        aria-label="Wi-Fi gateway optical input"
        title="SC/APC PON optical input; connector type is SKU-dependent"
        style={{ left: -6, borderColor: '#16a34a', background: '#f0fdf4' }}
      />
      <NodeShell
        eyebrow="SUBSCRIBER SERVICE"
        title={data.subscriber}
        icon={rx === null ? <WifiOff size={14} /> : <Router size={14} />}
        thumbnail={{ src: hardware.thumbnailSvg, alt: `${hardware.modelName} illustration` }}
        accent={style.hex}
        selected={selected}
        ringClass={style.ring}
        footer={
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[9px] text-noc-400" title={data.ssid}>SSID · {data.ssid}</span>
            <span className="shrink-0 font-mono text-[9px] text-noc-400">{standard ?? 'GPON / XGS'}</span>
          </div>
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Led color={style.hex} pulse={status === 'ONLINE' || status === 'LOS'} size={9} />
          <Badge className={style.badge}>{style.label}</Badge>
          <Badge className="border-blue-200 bg-blue-50 text-blue-800">Wi-Fi 6</Badge>
          {standard === 'XGS-PON' ? (
            <Badge className="border-sky-200 bg-sky-50 text-sky-900">XGS-PON 10G ACTIVE</Badge>
          ) : null}
          <span className="ml-auto font-mono text-[12px] font-bold" style={{ color: style.hex }}>
            {rx === null ? '—' : rx.toFixed(2)}
          </span>
          <span className="font-mono text-[9px] text-noc-400">dBm</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="PON standard" value={standard ?? 'Awaiting link'} tone={standard === 'XGS-PON' ? 'text-sky-200' : 'text-noc-200'} />
          <Stat label="Optical margin" value={rx === null ? '—' : `${telemetry?.marginDb.toFixed(2)} dB`} />
          <Stat label="Est. down / up" value={speedLabel} tone="text-emerald-200" />
          <Stat label="Optical route" value={rx === null ? '—' : `${telemetry?.fiberKm.toFixed(2)} km · 1:${telemetry?.cumulativeSplitRatio}`} />
          <Stat
            label="Simulated IPv4"
            value={telemetry?.status === 'ONLINE' ? data.serviceIpAddress : 'Unassigned'}
            tone="text-noc-200"
          />
        </div>
        {telemetry ? (
          <div className="mt-1.5 text-[9px] leading-snug text-noc-500">
            {describeStatus(telemetry.status, telemetry.ponStandard ?? undefined)} · shared line-rate estimate, not a measured speed test.
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-1 text-[9px] text-noc-500">
            <Wifi size={10} /> Dual-band gateway; connect its PON input to simulate service.
          </div>
        )}
      </NodeShell>
    </div>
  );
}

export default GatewayNode;
