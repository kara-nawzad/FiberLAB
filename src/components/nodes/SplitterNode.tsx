import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import type { SplitterNode as SplitterFlowNode } from '../../types';
import { SPLITTER_OUTPUT_PORTS } from '../../types';
import { computeSplitterLoss } from '../../engine/opticalSimulator';
import { HardwareArt } from '../hardware/HardwareArt';
import { splitterOutputY } from '../../data/hardwareArtwork';

/** PLC splitter — compact black cassette with a title card underneath. Handles sit on the real ports. */
export function SplitterNode({ id, data, selected }: NodeProps<SplitterFlowNode>) {
  const portCount = SPLITTER_OUTPUT_PORTS[data.ratio];
  const lossDb = computeSplitterLoss(data);
  const activePorts = useStore((state) => state.edges.reduce((count, edge) => (edge.source === id ? count + 1 : count), 0));
  const scale = 104 / 130;
  const outY = splitterOutputY(portCount);

  return (
    <div className="hw-spl" style={selected ? { outline: '2px solid var(--pu-pri)', outlineOffset: 4, borderRadius: 12 } : undefined}>
      <HardwareArt kind="splitter" width={104} ratio={data.ratio} />
      <div className="hw-label">
        <b>PLC Splitter 1:{data.ratio}</b>
        <small>Insertion Loss {lossDb.toFixed(1)} dB · {activePorts}/{portCount} ports</small>
        {data.excessLossDb > 0 ? <small style={{ color: '#B36B00' }}>+{data.excessLossDb.toFixed(1)} dB excess</small> : null}
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        aria-label="SC/APC splitter input"
        title="SC/APC splitter input port — drag or drop to connect"
        style={{ left: -6, top: 60 * scale, borderColor: '#0D9F6E', background: '#34D399' }}
      />
      {Array.from({ length: portCount }, (_, index) => (
        <Handle
          key={`out-${index}`}
          id={`out-${index}`}
          type="source"
          position={Position.Right}
          aria-label={`SC/APC splitter output ${index + 1}`}
          title={`SC/APC output port OUT ${index + 1} — drag to connect`}
          style={{ right: -6, top: outY[index] * scale, borderColor: '#0D9F6E', background: '#34D399' }}
        />
      ))}
    </div>
  );
}

export default SplitterNode;
