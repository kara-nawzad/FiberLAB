import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Wifi } from 'lucide-react';
import type { GatewayNode as GatewayFlowNode, OntStatus } from '../../types';
import { STATUS_STYLES } from '../../types';
import { describeStatus } from '../../engine/opticalSimulator';
import { useSimulation } from '../../engine/SimulationContext';
import { Badge, Led, Stat } from './nodeShared';

function formatMbps(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} Gbps` : `${Math.round(value)} Mbps`;
}

/**
 * Integrated PON + Wi-Fi 6 Gateway — rendered as a clean white desktop
 * multi-antenna residential optical router with a green SC/APC PON input port
 * on the left, top dual-band dipole antennas, status LEDs, and service telemetry.
 */
export function GatewayNode({ id, data, selected }: NodeProps<GatewayFlowNode>) {
  const simulation = useSimulation();
  const telemetry = simulation?.gatewayTelemetry[id];
  const status: OntStatus = telemetry?.status ?? 'DISCONNECTED';
  const style = STATUS_STYLES[status];
  const rx = telemetry?.rxPowerDbm ?? null;
  const standard = telemetry?.ponStandard ?? null;
  const speedLabel =
    !telemetry || telemetry.estimatedDownMbps === null || telemetry.estimatedUpMbps === null
      ? 'No active service estimate'
      : `↓ ${formatMbps(telemetry.estimatedDownMbps)} · ↑ ${formatMbps(telemetry.estimatedUpMbps)}`;

  return (
    <div className="relative w-[224px] pt-3">
      {/* Dual-Band Wi-Fi 6 Dipole Antennas along Top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-7 right-7 flex justify-between px-2"
      >
        <span className="h-3.5 w-2 rounded-t-full border border-slate-300 bg-slate-200" />
        <span className="h-4 w-2 rounded-t-full border border-slate-300 bg-slate-200" />
        <span className="h-4 w-2 rounded-t-full border border-slate-300 bg-slate-200" />
        <span className="h-3.5 w-2 rounded-t-full border border-slate-300 bg-slate-200" />
      </div>

      {/* Left Green SC/APC Optical Input Receptacle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-2.5 top-1/2 -translate-y-1/2 flex items-center"
      >
        <span className="h-4 w-3 rounded-l border border-emerald-500 bg-emerald-600 shadow-sm" />
      </div>

      <div
        className={`node-shell relative overflow-hidden rounded-xl border bg-white p-3 shadow-md transition-all duration-150 ${
          selected ? 'border-violet-600' : style.ring || 'border-slate-200'
        }`}
      >
        {/* Top Gateway Header */}
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="min-w-0">
            <div className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
              OPTICAL WI-FI 6 GATEWAY
            </div>
            <div className="truncate font-sans text-[13px] font-bold leading-snug text-slate-900">
              {data.subscriber}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Led color={style.hex} pulse={status === 'ONLINE' || status === 'LOS'} size={9} />
            <Badge className={style.badge}>{style.label}</Badge>
          </div>
        </div>

        {/* Status Badges & Live RX Reading */}
        <div className="my-2 flex flex-wrap items-center gap-1.5">
          <Badge className="border-blue-200 bg-blue-50 text-blue-800">Wi-Fi 6</Badge>
          {standard === 'XGS-PON' ? (
            <Badge className="border-sky-200 bg-sky-50 text-sky-900">XGS-PON 10G ACTIVE</Badge>
          ) : null}
          <span
            className="ml-auto font-mono text-[13px] font-bold"
            style={{ color: style.hex }}
          >
            {rx === null ? '—' : rx.toFixed(2)}
          </span>
          <span className="font-mono text-[9.5px] text-slate-500">dBm</span>
        </div>

        {/* Service Telemetry Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <Stat
            label="PON standard"
            value={standard ?? 'Awaiting link'}
            tone={standard === 'XGS-PON' ? 'text-blue-700' : 'text-slate-800'}
          />
          <Stat
            label="Optical margin"
            value={rx === null ? '—' : `${telemetry?.marginDb.toFixed(2)} dB`}
          />
          <Stat label="Est. down / up" value={speedLabel} tone="text-emerald-700" />
          <Stat
            label="Simulated IPv4"
            value={telemetry?.status === 'ONLINE' ? data.serviceIpAddress : 'Unassigned'}
            tone="text-slate-800"
          />
        </div>

        {telemetry ? (
          <div className="mt-1.5 text-[9px] leading-snug text-slate-500">
            {describeStatus(telemetry.status, telemetry.ponStandard ?? undefined)} · shared line-rate estimate, not a measured speed test.
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-500">
            <Wifi size={10} /> Dual-band gateway; connect its PON input to simulate service.
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
          <span className="truncate font-mono text-[9px] text-slate-500" title={data.ssid}>
            SSID · {data.ssid}
          </span>
          <span className="shrink-0 font-mono text-[9px] font-semibold text-slate-600">
            {standard ?? 'GPON / XGS'}
          </span>
        </div>
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!top-1/2"
        aria-label="Wi-Fi gateway optical input"
        title="SC/APC PON optical input"
        style={{ left: -10, borderColor: '#16A34A', background: '#DCFCE7' }}
      />
    </div>
  );
}

export default GatewayNode;
