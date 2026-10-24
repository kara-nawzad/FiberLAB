import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import type { SplitterNode as SplitterFlowNode } from '../../types';
import { splitterBranchPortCount } from '../../types';
import { computeSplitterLoss } from '../../engine/opticalSimulator';
import { HardwareArt } from '../hardware/HardwareArt';

/** Height of the 130×122 cassette artwork after it is scaled to 104 px wide. */
const ART_WIDTH = 104;
const ART_HEIGHT = Math.round((122 * ART_WIDTH) / 130);
/** Shortest distance that keeps neighbouring SC/APC handles individually clickable. */
const PORT_SPACING = 15;
const PORT_MARGIN = 10;

/**
 * PLC splitter — compact black cassette with a title card underneath. Every
 * split output gets its own SC/APC handle, so a 1:8 can serve eight drops; the
 * cassette grows downwards when the port fan is taller than the artwork.
 * Handles sit on the real ports.
 */
export function SplitterNode({ id, data, selected }: NodeProps<SplitterFlowNode>) {
  const portCount = splitterBranchPortCount(data.ratio);
  const lossDb = computeSplitterLoss(data);
  const activePorts = useStore((state) =>
    state.edges.reduce(
      (count, edge) => (edge.source === id && (edge.sourceHandle ?? '').startsWith('out-') ? count + 1 : count),
      0,
    ),
  );

  // Lay the handles out down the right edge, widening the node only when the
  // port fan needs more room than the artwork itself.
  const stripHeight = Math.max(ART_HEIGHT - PORT_MARGIN * 2, (portCount - 1) * PORT_SPACING);
  const portY = (index: number) =>
    PORT_MARGIN + (portCount === 1 ? stripHeight / 2 : (index * stripHeight) / (portCount - 1));
  const nodeMinHeight = stripHeight + PORT_MARGIN * 2;
  const inputY = PORT_MARGIN + stripHeight / 2;
  const truncated = portCount < data.ratio;

  return (
    <div
      className="hw-spl"
      style={selected ? { outline: '2px solid var(--pu-pri)', outlineOffset: 4, borderRadius: 12 } : undefined}
    >
      <div style={{ minHeight: nodeMinHeight }}>
        <HardwareArt kind="splitter" width={ART_WIDTH} ratio={data.ratio} />
        <div className="hw-label">
          <b>PLC Splitter 1:{data.ratio}</b>
          <small>
            Insertion Loss {lossDb.toFixed(1)} dB · {Math.min(activePorts, portCount)}/{portCount} ports
          </small>
          {data.excessLossDb > 0 ? (
            <small style={{ color: '#B36B00' }}>+{data.excessLossDb.toFixed(1)} dB excess</small>
          ) : null}
          {truncated ? (
            <small title="Outputs above 16 are spliced into distribution fiber rather than terminated on the cassette">
              16 branch ports · 1:{data.ratio} ribbon trunk
            </small>
          ) : null}
        </div>
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        aria-label="SC/APC splitter input"
        title="SC/APC splitter input port — drag or drop to connect"
        style={{ left: -6, top: inputY, borderColor: '#0D9F6E', background: '#34D399' }}
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
