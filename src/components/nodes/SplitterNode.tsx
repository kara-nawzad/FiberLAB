import { Handle, Position, useStore, type NodeProps } from '@xyflow/react';
import type { SplitterNode as SplitterFlowNode } from '../../types';
import { splitterBranchPortCount } from '../../types';
import { HardwareArt } from '../hardware/HardwareArt';

/**
 * Cassette geometry, in px. The artwork is 130 × 122 viewBox rendered 104 px
 * wide, so it is 98 px tall and its own port axis sits at the vertical centre
 * (~49.6 % of the height) — every handle below is derived from that axis.
 */
const ART_WIDTH = 104;
const ART_HEIGHT = Math.round((ART_WIDTH * 122) / 130);
/** Minimum gap between two branch handles; matches the 14 px handle size. */
const PORT_GAP = 15;
/** Breathing room above the first and below the last branch handle. */
const PORT_PAD = 9;
/** Room reserved under the port block for the single title line. */
const LABEL_HEIGHT = 26;

/**
 * PLC splitter — black cassette with one right-edge handle per connectorised
 * branch. The artwork is centred on the same vertical axis as the port fan, so
 * the input, every output and the cassette's own stubs all sit on one line and
 * a patch cord lands where the eye expects it. Measurements and trunking notes
 * live in the Inspector, not on the canvas.
 */
export function SplitterNode({ id, data, selected }: NodeProps<SplitterFlowNode>) {
  const portCount = splitterBranchPortCount(data.ratio);
  const activePorts = useStore((state) =>
    state.edges.reduce((count, edge) => (edge.source === id ? count + 1 : count), 0),
  );

  const fanHeight = portCount > 1 ? (portCount - 1) * PORT_GAP : 0;
  // The block grows only when the fan no longer fits beside the artwork.
  const portBlockHeight = Math.max(ART_HEIGHT, fanHeight + PORT_PAD * 2);
  const axisY = portBlockHeight / 2;
  const nodeHeight = portBlockHeight + LABEL_HEIGHT;

  const portTop = (index: number) =>
    portCount > 1 ? axisY - fanHeight / 2 + (index * fanHeight) / (portCount - 1) : axisY;

  return (
    <div
      className="hw-spl"
      style={{
        width: ART_WIDTH,
        minHeight: nodeHeight,
        ...(selected ? { outline: '2px solid var(--pu-pri)', outlineOffset: 4, borderRadius: 12 } : null),
      }}
      data-port-count={portCount}
      aria-label={`PLC splitter 1:${data.ratio}, ${activePorts} of ${portCount} branch ports patched`}
    >
      <div className="hw-spl-art" style={{ height: portBlockHeight }}>
        <HardwareArt kind="splitter" width={ART_WIDTH} ratio={data.ratio} />
        {fanHeight > 0 ? (
          <span className="hw-spl-rail" aria-hidden="true" style={{ top: axisY - fanHeight / 2, height: fanHeight }} />
        ) : null}
      </div>

      <div className="hw-label">
        <b>PLC Splitter 1:{data.ratio}</b>
      </div>

      <Handle
        id="in"
        type="target"
        position={Position.Left}
        aria-label="SC/APC splitter input"
        title="SC/APC splitter input port — drag or drop to connect"
        style={{ left: -7, top: axisY, borderColor: '#0D9F6E', background: '#34D399' }}
      />
      {Array.from({ length: portCount }, (_, index) => (
        <Handle
          key={`out-${index}`}
          id={`out-${index}`}
          type="source"
          position={Position.Right}
          aria-label={`SC/APC splitter output ${index + 1}`}
          title={`SC/APC output port OUT ${index + 1} — drag to connect`}
          style={{ right: -7, top: portTop(index), borderColor: '#0D9F6E', background: '#34D399' }}
        />
      ))}
    </div>
  );
}

export default SplitterNode;
