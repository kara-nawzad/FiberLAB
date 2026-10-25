import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OltNode as OltFlowNode } from '../../types';
import { OLT_CLASS_SPECS } from '../../types';
import { useSimulation } from '../../context/SimulationContext';
import { HardwareArt } from '../hardware/HardwareArt';

/** OLT — dark 1U chassis with PON port LEDs and an information card beneath (design-image style). */
export function OLTNode({ id, data, selected }: NodeProps<OltFlowNode>) {
  const simulation = useSimulation();
  const telemetry = simulation?.oltTelemetry?.[id];
  const spec = OLT_CLASS_SPECS[data.oltClass];
  const rx = telemetry?.maxRxPowerDbm ?? null;
  const online = data.laserOn;

  return (
    <div
      className="hw-olt"
      style={selected ? { outline: '2px solid var(--pu-pri)', outlineOffset: 4, borderRadius: 8 } : undefined}
    >
      <HardwareArt kind="olt" width={230} />

      <div className="hw-card">
        <b>OLT</b>
        <small>
          Class {data.oltClass} · {data.portName}
        </small>
        <div className="hw-kv">
          <span>TX Power</span>
          <b style={{ fontSize: 'var(--fs-2xs)' }}>
            {data.txPowerDbm >= 0 ? '+' : ''}
            {data.txPowerDbm.toFixed(1)} dBm
          </b>
        </div>
        {/* Upstream burst power at the headend receiver is not simulated, so this
            reports the strongest downstream subscriber reading, not an OLT Rx. */}
        <div
          className="hw-kv"
          title="Strongest downstream subscriber receive power on this PON port. Upstream burst power at the OLT receiver is not modelled."
        >
          <span>ONU Rx (max)</span>
          <b style={{ fontSize: 'var(--fs-2xs)' }}>
            {rx !== null ? `${rx.toFixed(1)} dBm` : `${spec.rxSensitivityDbm.toFixed(0)} dBm sens`}
          </b>
        </div>
        <div className="hw-kv">
          <span>PON Status</span>
          <b style={{ fontSize: 10.5, color: online ? 'var(--pu-ok)' : 'var(--pu-mut)' }}>
            ● {online ? 'ONLINE' : 'OFFLINE'}
          </b>
        </div>
        {telemetry?.upstreamDynamicRangeWarning ? (
          <div
            data-testid="olt-dynamic-range-warning"
            style={{
              marginTop: 6,
              padding: '4px 6px',
              borderRadius: 6,
              background: 'var(--pu-warn-soft)',
              color: 'var(--pu-warn-text)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 'var(--fw-semibold)',
            }}
          >
            ⚠ Dynamic range exceeded (Δ {telemetry.upstreamDeltaDb.toFixed(1)} dB &gt; 15 dB)
          </div>
        ) : null}
      </div>

      <Handle
        id="out"
        type="source"
        position={Position.Right}
        aria-label="SC/UPC optical output"
        title="SC/UPC OLT optical output port — drag to connect"
        style={{ right: -7, top: 35, borderColor: '#0D9F6E', background: '#34D399' }}
      />
    </div>
  );
}

export default OLTNode;
