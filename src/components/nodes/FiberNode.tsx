import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle } from 'lucide-react';
import type { FiberNode as FiberFlowNode } from '../../types';
import { computeFiberLoss } from '../../engine/opticalSimulator';
import { useSimulation } from '../../context/SimulationContext';

/**
 * Fiber span — an inline "20.4 km / −3.2 dB" pill that sits on the line between two devices,
 * exactly like the design image. Length, splices, connectors, wavelength and fault flags are
 * still real node data editable from the Inspector.
 */
export function FiberNode({ data, selected }: NodeProps<FiberFlowNode>) {
  const simulation = useSimulation();
  const blindFaultMode = Boolean(simulation?.blindFaultMode);
  const loss = computeFiberLoss(data);
  const faulted = !blindFaultMode && (loss.macroBendLossDb > 0 || loss.dirtyConnectorLossDb > 0);

  return (
    <div
      className="hw-fiber"
      style={selected ? { borderColor: 'var(--pu-pri)', boxShadow: '0 0 0 3px var(--pu-pri-soft)' } : undefined}
      title={`${data.cableType} cable · ${data.splices} splice · ${data.connectors} conn · ${loss.attenuationDbPerKm.toFixed(2)} dB/km @ ${data.wavelength} nm`}
    >
      {faulted ? <AlertTriangle size={11} className="fiber-fault-badge" style={{ display: 'inline', marginRight: 4, color: '#B36B00' }} /> : null}
      {data.lengthKm.toFixed(1)} km
      <span>−{loss.totalDb.toFixed(1)} dB</span>

      <Handle id="in" type="target" position={Position.Left} aria-label="SC/APC cable input" title="SC/APC input connector — drop patch cord here" style={{ left: -7, borderColor: '#0D9F6E', background: '#34D399' }} />
      <Handle id="out" type="source" position={Position.Right} aria-label="SC/APC cable output" title="SC/APC output connector — drag to connect" style={{ right: -7, borderColor: '#0D9F6E', background: '#34D399' }} />
    </div>
  );
}

export default FiberNode;
