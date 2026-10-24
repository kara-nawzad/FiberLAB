import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import type { SplitterNode as SplitterFlowNode } from '../../types';
import { splitterBranchPortCount } from '../../types';
import { computeSplitterLoss } from '../../engine/opticalSimulator';
import { HardwareArt } from '../hardware/HardwareArt';

/** Height the cassette artwork occupies at the node's rendered width. */
const ART_HEIGHT = 98;
/** Minimum vertical gap between two branch handles. */
const PORT_GAP = 15;
/** Handles start this far below the node's top edge. */
const PORT_TOP = 10;

/** PLC splitter — compact black cassette with a title card underneath. The node
 * exposes one right-edge handle per connectorised branch output, and grows when
 * the fan is taller than the artwork. */
export function SplitterNode({ id, data, selected }: NodeProps<SplitterFlowNode>) {
  const portCount = splitterBranchPortCount(data.ratio);
  const trunked = data.ratio > portCount;
  const lossDb = computeSplitterLoss(data);
  const activePorts = useStore((state) =>
    state.edges.reduce((count, edge) => (edge.source === id ? count + 1 : count), 0),
  );

  const fanHeight = Math.max(ART_HEIGHT - PORT_TOP * 2, (portCount - 1) * PORT_GAP);
  const nodeHeight = Math.max(ART_HEIGHT, fanHeight + PORT_TOP * 2);
  const portY = (index: number) =>
    portCount === 1 ? PORT_TOP + fanHeight / 2 : PORT_TOP + (index * fanHeight) / (portCount - 1);

  return (
    <div
      className="hw-spl"
      style={{
        minHeight: nodeHeight,
        ...(selected ? { outline: '2px solid var(--pu-pri)', outlineOffset: 4, borderRadius: 12 } : null),
      }}
    >
      <HardwareArt kind="splitter" width={104} ratio={data.ratio} />
      <div className="hw-label">
        <b>PLC Splitter 1:{data.ratio}</b>
        <small>
          Insertion Loss {lossDb.toFixed(1)} dB · {activePorts}/{portCount} ports
        </small>
        {trunked ? <small className="hw-label-note">{portCount} branch ports · rest trunked</small> : null}
        {data.excessLossDb > 0 ? (
          <small style={{ color: '#B36B00' }}>+{data.excessLossDb.toFixed(1)} dB excess</small>
        ) : null}
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        aria-label="SC/APC splitter input"
        title="SC/APC splitter input port — drag or drop to connect"
        style={{ left: -6, top: PORT_TOP + fanHeight / 2, borderColor: '#0D9F6E', background: '#34D399' }}
      />
      {Array.from({ length: portCount }, (_, index) => (
        <Handle
          key={`out-${index}`}
          id={`out-${index}`}
          type="source"
          position={Position.Right}
          aria-label={`SC/APC splitter output ${index + 1}`}
          title={`SC/APC output port OUT ${index + 1} — drag to connect`}
          style={{ right: -6, top: portY(index), borderColor: '#0D9F6E', background: '#34D399' }}
        />
      ))}
    </div>
  );
}

export default SplitterNode;
