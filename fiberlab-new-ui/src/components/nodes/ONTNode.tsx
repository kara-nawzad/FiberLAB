import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OntNode as OntFlowNode, OntStatus } from '../../types';
import { STATUS_STYLES } from '../../types';
import { useSimulation } from '../../engine/SimulationContext';
import { HardwareArt } from '../hardware/HardwareArt';

/** ONU / ONT — white desktop terminal with a name / status / dBm label card (design-image style). */
export function ONTNode({ id, data, selected }: NodeProps<OntFlowNode>) {
  const simulation = useSimulation();
  const telemetry = simulation?.ontTelemetry[id];
  const status: OntStatus = telemetry?.status ?? 'DISCONNECTED';
  const style = STATUS_STYLES[status];
  const rx = telemetry?.rxPowerDbm ?? null;
  const tone = status === 'ONLINE' ? '' : status === 'WARNING' || status === 'OVERLOAD' ? 'warn' : status === 'LOS' ? 'bad' : '';

  return (
    <div className="hw-onu" style={selected ? { outline: '2px solid var(--pu-pri)', outlineOffset: 4, borderRadius: 12 } : undefined}>
      <HardwareArt kind="onu" width={100} />
      <div className={`tag ${tone}`}>
        <b>{data.subscriber}</b>
        <em style={{ color: style.hex }}>● {style.label}</em>
        <div style={{ color: 'var(--pu-mut)' }}>{rx === null ? '—' : `${rx >= 0 ? '+' : ''}${rx.toFixed(1)} dBm`}</div>
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        aria-label="SC/APC ONT optical input"
        title="SC/APC optical input receptacle"
        style={{ left: -4, borderColor: '#12A36B', background: '#D6F5E7' }}
      />
    </div>
  );
}

export default ONTNode;
