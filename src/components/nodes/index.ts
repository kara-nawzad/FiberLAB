import type { NodeTypes } from '@xyflow/react';
import { OLTNode } from './OLTNode';
import { SplitterNode } from './SplitterNode';
import { FiberNode } from './FiberNode';
import { ClosureNode } from './ClosureNode';
import { ONTNode } from './ONTNode';
import { ODFNode } from './ODFNode';
import { NAPNode } from './NAPNode';
import { GatewayNode } from './GatewayNode';
import { AttenuatorNode } from './AttenuatorNode';

/** Registry handed to <ReactFlow nodeTypes={...} />. Declared at module scope
 *  so React Flow never sees a new object identity between renders. */
export const nodeTypes = {
  olt: OLTNode,
  splitter: SplitterNode,
  fiber: FiberNode,
  closure: ClosureNode,
  ont: ONTNode,
  odf: ODFNode,
  nap: NAPNode,
  gateway: GatewayNode,
  attenuator: AttenuatorNode,
} satisfies NodeTypes;

export { OLTNode, SplitterNode, FiberNode, ClosureNode, ONTNode, ODFNode, NAPNode, GatewayNode, AttenuatorNode };
