import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Link2, MousePointer2, X } from 'lucide-react';
import type {
  AnyNodeData,
  DesignSettings,
  MeterWavelength,
  PonEdge,
  PonNode,
  SimulationResult,
  SplitRatio,
} from './types';
import {
  CLOSURE_INPUT_PORTS,
  CLOSURE_OUTPUT_PORTS,
  DEFAULT_SETTINGS,
  NAP_OUTPUT_PORTS,
  ODF_INPUT_PORTS,
  ODF_OUTPUT_PORTS,
  SPLITTER_OUTPUT_PORTS,
} from './types';
import {
  createClosureNode,
  createFiberNode,
  createGatewayNode,
  createNapNode,
  createOdfNode,
  createOltNode,
  createOntNode,
  createSplitterNode,
  NODE_SIZES,
  nextId,
} from './engine/factories';
import { buildPreset, PRESETS } from './engine/presets';
import {
  isClosureNode,
  isFiberNode,
  isNapNode,
  isOdfNode,
  isOltNode,
  isSplitterNode,
  isSubscriberEndpointNode,
  simulateTopology,
} from './engine/opticalSimulator';
import { decorateEdges } from './engine/edgeDecoration';
import { SimulationContext } from './engine/SimulationContext';
import { readOpticalPowerAtProbe, sameProbeTarget, simulateAtMeterWavelength, type OpticalProbeTarget } from './engine/opticalProbe';
import { OpmMeterHud } from './components/OpmMeterHud';
import { OtdrModal } from './components/OtdrModal';
import { nodeTypes } from './components/nodes';
import { OpticalEdge } from './components/OpticalEdge';
import { Sidebar, DND_MIME, type ToolboxPayload } from './components/Sidebar';
import { Inspector } from './components/Inspector';
import { BOMModal } from './components/BOMModal';
import { TopBar } from './components/TopBar';
import { CanvasToolbar } from './components/CanvasToolbar';
import { BottomPanel } from './components/BottomPanel';
import { MissionDrawer } from './components/MissionDrawer';
import { LandingView } from './components/landing/LandingView';
import { getMissionById, type Mission } from './engine/missions';
import {
  calculateNetworkCost,
  DEFAULT_UNIT_COSTS,
  resolveUnitCosts,
  type UnitCostProfile,
} from './data/pricingCatalogue';

const edgeTypes = { optical: OpticalEdge };

type LandingCommandInput =
  | { kind: 'preset'; presetId: string }
  | { kind: 'mission'; missionId: string }
  | { kind: 'missions' };

type LandingCommand = LandingCommandInput & { requestId: number };

interface StudioWorkspaceProps {
  onOpenOverview: () => void;
  onSimulationChange: (simulation: SimulationResult, stale: boolean) => void;
  landingCommand: LandingCommand | null;
  isActive?: boolean;
}

const MINIMAP_COLORS: Record<string, string> = {
  olt: '#1E293B',
  splitter: '#7C3AED',
  fiber: '#FACC15',
  closure: '#334155',
  ont: '#16A34A',
  odf: '#0F766E',
  nap: '#EA580C',
  gateway: '#2563EB',
};

function resolveProbeTarget(target: EventTarget | null): OpticalProbeTarget | null {
  if (!(target instanceof Element)) return null;

  const handle = target.closest<HTMLElement>('.react-flow__handle');
  if (handle) {
    const nodeElement = handle.closest<HTMLElement>('.react-flow__node');
    const id = handle.dataset.nodeid ?? nodeElement?.dataset.id ?? nodeElement?.getAttribute('data-id');
    if (id) {
      const rawType = handle.dataset.handletype;
      const handleType = rawType === 'source' || rawType === 'target' ? rawType : null;
      return {
        kind: 'node',
        id,
        handleId: handle.dataset.handleid ?? null,
        handleType,
      };
    }
  }

  const edgeElement = target.closest<HTMLElement>('.react-flow__edge');
  if (edgeElement) {
    const id = edgeElement.dataset.id ?? edgeElement.getAttribute('data-id');
    if (id) return { kind: 'edge', id };
  }

  const nodeElement = target.closest<HTMLElement>('.react-flow__node');
  if (nodeElement) {
    const id = nodeElement.dataset.id ?? nodeElement.getAttribute('data-id');
    if (id) return { kind: 'node', id };
  }
  return null;
}

function initialTopology(): { nodes: PonNode[]; edges: PonEdge[] } {
  return buildPreset('standard-1x32') ?? { nodes: [], edges: [] };
}

/* ========================================================================== *
 * Studio workspace — canvas, drag & drop, selection and simulation wiring.
 * ========================================================================== */

function StudioWorkspace({ onOpenOverview, onSimulationChange, landingCommand, isActive = true }: StudioWorkspaceProps) {
  const seeded = useMemo(initialTopology, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<PonNode>(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PonEdge>(seeded.edges);
  const [settings, setSettings] = useState<DesignSettings>(DEFAULT_SETTINGS);
  const [unitCosts, setUnitCosts] = useState<UnitCostProfile>(() => resolveUnitCosts(DEFAULT_UNIT_COSTS));
  const [activePresetId, setActivePresetId] = useState<string | null>('standard-1x32');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selection, setSelection] = useState<{ nodeIds: string[]; edgeIds: string[] }>({ nodeIds: [], edgeIds: [] });
  const [linkMode, setLinkMode] = useState(false);
  const [linkStartNodeId, setLinkStartNodeId] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState('Select a source node, then a destination.');
  const [opmActive, setOpmActive] = useState(false);
  const [opmProbe, setOpmProbe] = useState<OpticalProbeTarget | null>(null);
  const opmProbeRef = useRef<OpticalProbeTarget | null>(null);
  const [meterWavelength, setMeterWavelength] = useState<MeterWavelength>(1490);
  const [opmAnchor, setOpmAnchor] = useState({ x: 18, y: 18 });
  const opmHudRef = useRef<HTMLElement | null>(null);
  const studioMainRef = useRef<HTMLElement | null>(null);
  const [bomOpen, setBomOpen] = useState(false);
  const [otdrOpen, setOtdrOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [committedSim, setCommittedSim] = useState<SimulationResult | null>(null);
  const [canvasTool, setCanvasTool] = useState<'select' | 'pan'>('select');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  const { screenToFlowPosition, deleteElements, fitView, getNodes, getEdges } = useReactFlow<PonNode, PonEdge>();

  /* --------------------------- Simulation core --------------------------- */

  const liveSimulation = useMemo(
    () => simulateTopology(nodes, edges, settings, 0),
    [nodes, edges, settings],
  );

  const activeMission = useMemo(
    () => (activeMissionId ? getMissionById(activeMissionId) ?? null : null),
    [activeMissionId],
  );
  const blindFaultMode = Boolean(activeMission?.blindFaultMode);

  const simulation = useMemo(() => {
    const base = settings.autoRun ? liveSimulation : (committedSim ?? liveSimulation);
    return blindFaultMode ? { ...base, blindFaultMode: true } : base;
  }, [settings.autoRun, liveSimulation, committedSim, blindFaultMode]);

  const simulationStale = !settings.autoRun && dirty;
  const costBreakdown = useMemo(
    () => calculateNetworkCost(nodes, edges, unitCosts),
    [nodes, edges, unitCosts],
  );
  const opmSimulation = useMemo(
    () => (opmActive ? simulateAtMeterWavelength(nodes, edges, settings, meterWavelength) : null),
    [opmActive, nodes, edges, settings, meterWavelength],
  );
  const opmReading = opmActive && opmProbe && opmSimulation
    ? readOpticalPowerAtProbe(opmProbe, nodes, edges, opmSimulation)
    : null;

  useEffect(() => {
    onSimulationChange(simulation, simulationStale);
  }, [simulation, simulationStale, onSimulationChange]);

  const highlightedEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedNodeId) return ids;
    const bestPath = simulation.bestPaths[selectedNodeId];
    if (bestPath && bestPath.nodeIds.length > 1) {
      for (let i = 0; i < bestPath.nodeIds.length - 1; i += 1) {
        const u = bestPath.nodeIds[i];
        const v = bestPath.nodeIds[i + 1];
        for (const edge of edges) {
          if (edge.source === u && edge.target === v) {
            ids.add(edge.id);
          }
        }
      }
      return ids;
    }
    for (const edge of edges) {
      if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
        ids.add(edge.id);
      }
    }
    return ids;
  }, [selectedNodeId, simulation.bestPaths, edges]);

  const flowEdges = useMemo(
    () =>
      decorateEdges(edges, simulation.edgeTelemetry, nodes, {
        hideFaults: blindFaultMode,
        highlightedEdgeIds,
      }),
    [edges, nodes, simulation, blindFaultMode, highlightedEdgeIds],
  );

  const runLightTest = useCallback(() => {
    setTesting(true);
    const result = simulateTopology(nodes, edges, settings, Date.now());
    setCommittedSim(result);
    setDirty(false);
    window.setTimeout(() => setTesting(false), 700);
  }, [nodes, edges, settings]);

  const updateOpmProbeFromEvent = useCallback((event: {
    target: EventTarget | null;
    clientX: number;
    clientY: number;
  }) => {
    if (!opmActive) return;
    if (event.target instanceof Element && event.target.closest('.opm-meter-hud')) return;

    const target = resolveProbeTarget(event.target);
    if (!target) {
      if (opmProbeRef.current !== null) {
        opmProbeRef.current = null;
        setOpmProbe(null);
      }
      return;
    }

    const changed = !sameProbeTarget(opmProbeRef.current, target);
    if (changed) {
      opmProbeRef.current = target;
      setOpmProbe(target);
    }

    const bounds = studioMainRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const hudWidth = opmHudRef.current?.offsetWidth || 288;
    const hudHeight = opmHudRef.current?.offsetHeight || 230;
    const clientX = Number.isFinite(event.clientX) ? event.clientX : bounds.left + 18;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : bounds.top + 18;
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    let x = localX + 18;
    let y = localY + 18;
    if (x + hudWidth > bounds.width - 8) x = localX - hudWidth - 18;
    if (y + hudHeight > bounds.height - 8) y = localY - hudHeight - 18;
    x = Math.max(8, Math.min(x, Math.max(8, bounds.width - hudWidth - 8)));
    y = Math.max(8, Math.min(y, Math.max(8, bounds.height - hudHeight - 8)));

    if (opmHudRef.current) {
      // Move the small HUD imperatively; don't schedule a React Flow tree render
      // on every pointer frame while the canvas is being panned.
      opmHudRef.current.style.left = `${x}px`;
      opmHudRef.current.style.top = `${y}px`;
    }
    if (changed) setOpmAnchor({ x, y });
  }, [opmActive]);

  const handleOpmPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => updateOpmProbeFromEvent(event),
    [updateOpmProbeFromEvent],
  );
  const handleOpmClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!opmActive || (event.target instanceof Element && event.target.closest('.opm-meter-hud, .pu-toolbar'))) return;
    updateOpmProbeFromEvent(event);
    event.preventDefault();
    event.stopPropagation();
  }, [opmActive, updateOpmProbeFromEvent]);
  const handleOpmPointerLeave = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!opmActive || (event.relatedTarget instanceof Element && event.relatedTarget.closest('.opm-meter-hud, .pu-toolbar'))) return;
    opmProbeRef.current = null;
    setOpmProbe(null);
  }, [opmActive]);

  /* ------------------------------ Mutations ------------------------------ */

  const markDirty = useCallback(() => setDirty(true), []);

  const handlePatchNode = useCallback(
    (nodeId: string, patch: Partial<AnyNodeData>) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const nextData = {
            ...(node.data as Record<string, unknown>),
            ...(patch as Record<string, unknown>),
          };
          return { ...node, data: nextData } as PonNode;
        }),
      );

      // Shrinking a splitter removes physical ports — prune dangling patch cords.
      const ratio = patch.ratio;
      if (typeof ratio === 'number') {
        const portCount = SPLITTER_OUTPUT_PORTS[ratio as SplitRatio];
        setEdges((current) =>
          current.filter((edge) => {
            if (edge.source !== nodeId) return true;
            const handle = edge.sourceHandle ?? '';
            if (!handle.startsWith('out-')) return true;
            const index = Number(handle.slice(4));
            return !Number.isFinite(index) || index < portCount;
          }),
        );
      }
      markDirty();
    },
    [setNodes, setEdges, markDirty],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      void deleteElements({ nodes: [{ id: nodeId }] });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelection({ nodeIds: [], edgeIds: [] });
      markDirty();
    },
    [deleteElements, markDirty],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      void deleteElements({ edges: [{ id: edgeId }] });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelection({ nodeIds: [], edgeIds: [] });
      markDirty();
    },
    [deleteElements, markDirty],
  );

  const addComponent = useCallback(
    (payload: ToolboxPayload, position: { x: number; y: number }) => {
      const kind = payload.component;
      const size = NODE_SIZES[kind];
      const centered = {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      };

      let node: PonNode;
      if (kind === 'olt') {
        node = createOltNode({ position: centered });
      } else if (kind === 'splitter') {
        node = createSplitterNode(payload.ratio ?? 8, { position: centered });
      } else if (kind === 'fiber') {
        node = createFiberNode(payload.cableType ?? 'distribution', { position: centered });
      } else if (kind === 'closure') {
        node = createClosureNode({ position: centered });
      } else if (kind === 'odf') {
        node = createOdfNode({ position: centered });
      } else if (kind === 'nap') {
        node = createNapNode({ position: centered });
      } else if (kind === 'gateway') {
        node = createGatewayNode({ position: centered });
      } else {
        node = createOntNode({ position: centered });
      }

      setNodes((current) => [...current, node]);
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setSelection({ nodeIds: [node.id], edgeIds: [] });
      setActivePresetId(null);
      markDirty();
    },
    [setNodes, markDirty],
  );

  const handleQuickAdd = useCallback(
    (payload: ToolboxPayload) => {
      // Double-click placement: drop the element to the right of the current view centre.
      const spread = Math.random() * 120 - 60;
      addComponent(payload, { x: 420 + spread, y: 300 + spread });
    },
    [addComponent],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const source = connection.source;
      const target = connection.target;
      if (!source || !target || source === target) return;

      const currentNodes = getNodes();
      const targetNode = currentNodes.find((node) => node.id === target);
      const sourceNode = currentNodes.find((node) => node.id === source);

      if (sourceNode && isClosureNode(sourceNode)) {
        const handleIndex = Number((connection.sourceHandle ?? 'out-0').replace(/^out-/, ''));
        if (!Number.isInteger(handleIndex) || !sourceNode.data.activeSpliceChannels[handleIndex]) return;
      }
      if (sourceNode && isOdfNode(sourceNode) && !['out-0', 'out-1'].includes(connection.sourceHandle ?? '')) return;
      if (sourceNode && isNapNode(sourceNode)) {
        const handleIndex = Number((connection.sourceHandle ?? '').replace(/^out-/, ''));
        if (!Number.isInteger(handleIndex) || handleIndex < 0 || handleIndex >= NAP_OUTPUT_PORTS) return;
      }

      setEdges((currentEdges) => {
        // Never duplicate an identical patch cord.
        if (
          currentEdges.some(
            (edge) =>
              edge.source === source &&
              edge.target === target &&
              edge.sourceHandle === connection.sourceHandle &&
              edge.targetHandle === connection.targetHandle,
          )
        ) {
          return currentEdges;
        }

        const nextEdge: PonEdge = {
          id: nextId('patch'),
          source,
          target,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? (targetNode && (isClosureNode(targetNode) || isOdfNode(targetNode)) ? 'in-0' : 'in'),
          type: 'optical',
        };

        let filtered = currentEdges;
        // Subscriber terminals and NAP/FAT each have one optical input.
        if (targetNode && (isSubscriberEndpointNode(targetNode) || isNapNode(targetNode))) {
          filtered = filtered.filter((edge) => edge.target !== target);
        }
        // Multi-input hardware replaces only the patch on the selected port.
        if (targetNode && (isClosureNode(targetNode) || isOdfNode(targetNode))) {
          const targetHandle = connection.targetHandle ?? 'in-0';
          filtered = filtered.filter(
            (edge) => edge.target !== target || edge.targetHandle !== targetHandle,
          );
        }
        // An OLT port or a cable span has a single output.
        if (sourceNode && (isOltNode(sourceNode) || isFiberNode(sourceNode))) {
          filtered = filtered.filter((edge) => edge.source !== source);
        }
        // Each physical output on a passive branching/patch component is single-cord.
        if (sourceNode && (isSplitterNode(sourceNode) || isClosureNode(sourceNode) || isOdfNode(sourceNode) || isNapNode(sourceNode))) {
          const sourceHandle = connection.sourceHandle;
          filtered = filtered.filter(
            (edge) => edge.source !== source || edge.sourceHandle !== sourceHandle,
          );
        }
        return [...filtered, nextEdge];
      });
      markDirty();
    },
    [getNodes, setEdges, markDirty],
  );

  const handleSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const nextNodeId = params.nodes.length === 1 ? params.nodes[0].id : null;
    const nextEdgeId = params.edges.length === 1 ? params.edges[0].id : null;
    setSelectedNodeId(nextNodeId);
    setSelectedEdgeId(nextEdgeId);
    if (nextNodeId || nextEdgeId) {
      setInspectorCollapsed(false);
    }
    setSelection({
      nodeIds: params.nodes.map((node) => node.id),
      edgeIds: params.edges.map((edge) => edge.id),
    });
  }, []);

  const selectionCount = selection.nodeIds.length + selection.edgeIds.length;

  const handleDeleteSelection = useCallback(() => {
    if (selectionCount === 0) return;
    void deleteElements({
      nodes: selection.nodeIds.map((id) => ({ id })),
      edges: selection.edgeIds.map((id) => ({ id })),
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelection({ nodeIds: [], edgeIds: [] });
    markDirty();
  }, [deleteElements, markDirty, selection, selectionCount]);

  const handleToggleLink = useCallback(() => {
    const nextActive = !linkMode;
    setLinkMode(nextActive);
    setLinkStartNodeId(null);
    setLinkMessage(nextActive ? 'Select a source node, then a destination.' : 'Link mode closed.');
    if (nextActive) {
      setOpmActive(false);
      setOpmProbe(null);
      opmProbeRef.current = null;
    }
  }, [linkMode]);

  const handleToggleOpm = useCallback(() => {
    const nextActive = !opmActive;
    setOpmActive(nextActive);
    setOpmProbe(null);
    opmProbeRef.current = null;
    if (nextActive) {
      setLinkMode(false);
      setLinkStartNodeId(null);
      setLinkMessage('Link mode closed.');
      setSelection({ nodeIds: [], edgeIds: [] });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [opmActive]);

  useEffect(() => {
    if (!opmActive) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpmActive(false);
      setOpmProbe(null);
      opmProbeRef.current = null;
    };
    document.addEventListener('keydown', cancelOnEscape);
    return () => document.removeEventListener('keydown', cancelOnEscape);
  }, [opmActive]);

  useEffect(() => {
    if (!linkMode) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setLinkMode(false);
      setLinkStartNodeId(null);
      setLinkMessage('Link mode closed.');
    };
    document.addEventListener('keydown', cancelOnEscape);
    return () => document.removeEventListener('keydown', cancelOnEscape);
  }, [linkMode]);

  const handleNodeClick = useCallback((
    _event: ReactMouseEvent,
    clickedNode: PonNode,
  ) => {
    if (!linkMode) return;

    if (linkStartNodeId === null) {
      if (isSubscriberEndpointNode(clickedNode)) {
        setLinkMessage('Subscriber endpoints are destinations; choose a source component.');
        return;
      }
      setLinkStartNodeId(clickedNode.id);
      setLinkMessage(`Source: ${clickedNode.id}. Now choose a destination node.`);
      return;
    }

    if (clickedNode.id === linkStartNodeId) {
      setLinkStartNodeId(null);
      setLinkMessage('Source cleared. Choose a source node, then a destination.');
      return;
    }

    const currentNodes = getNodes();
    const sourceNode = currentNodes.find((node) => node.id === linkStartNodeId);
    const targetNode = currentNodes.find((node) => node.id === clickedNode.id);
    if (!sourceNode || !targetNode) {
      setLinkStartNodeId(null);
      setLinkMessage('A node changed. Choose a source node, then a destination.');
      return;
    }
    if (isSubscriberEndpointNode(sourceNode)) {
      setLinkStartNodeId(null);
      setLinkMessage('Subscriber endpoints are destination nodes. Choose another source.');
      return;
    }
    if (isOltNode(targetNode)) {
      setLinkMessage('An OLT has no optical input. Choose another destination.');
      return;
    }

    const currentEdges = getEdges();
    const existingEdge = currentEdges.find(
      (edge) => edge.source === sourceNode.id && edge.target === targetNode.id,
    );
    if (existingEdge) {
      handleDeleteEdge(existingEdge.id);
      setLinkMode(false);
      setLinkStartNodeId(null);
      setLinkMessage(`Removed the patch cord from ${sourceNode.id} to ${targetNode.id}.`);
      return;
    }

    let sourceHandle: string | undefined = 'out';
    if (isSplitterNode(sourceNode)) {
      const usedHandles = new Set(
        currentEdges
          .filter((edge) => edge.source === sourceNode.id)
          .map((edge) => edge.sourceHandle),
      );
      const outputCount = SPLITTER_OUTPUT_PORTS[sourceNode.data.ratio];
      sourceHandle = Array.from({ length: outputCount }, (_, index) => `out-${index}`)
        .find((handle) => !usedHandles.has(handle));
      if (!sourceHandle) {
        setLinkMessage(`All 1:${sourceNode.data.ratio} splitter outputs are already patched.`);
        return;
      }
    } else if (isClosureNode(sourceNode)) {
      const usedHandles = new Set(
        currentEdges.filter((edge) => edge.source === sourceNode.id).map((edge) => edge.sourceHandle),
      );
      sourceHandle = Array.from({ length: CLOSURE_OUTPUT_PORTS }, (_, index) => `out-${index}`)
        .find((handle, index) => sourceNode.data.activeSpliceChannels[index] && !usedHandles.has(handle));
      if (!sourceHandle) {
        setLinkMessage('No active, unpatched closure branch is available. Splice a tray channel first.');
        return;
      }
    } else if (isOdfNode(sourceNode)) {
      const usedHandles = new Set(
        currentEdges.filter((edge) => edge.source === sourceNode.id).map((edge) => edge.sourceHandle),
      );
      sourceHandle = Array.from({ length: ODF_OUTPUT_PORTS }, (_, index) => `out-${index}`)
        .find((handle) => !usedHandles.has(handle));
      if (!sourceHandle) {
        setLinkMessage('Both ODF through-pair outputs are already patched.');
        return;
      }
    } else if (isNapNode(sourceNode)) {
      const usedHandles = new Set(
        currentEdges.filter((edge) => edge.source === sourceNode.id).map((edge) => edge.sourceHandle),
      );
      sourceHandle = Array.from({ length: NAP_OUTPUT_PORTS }, (_, index) => `out-${index}`)
        .find((handle) => !usedHandles.has(handle));
      if (!sourceHandle) {
        setLinkMessage('All eight NAP drop outputs are already patched.');
        return;
      }
    }

    let targetHandle = 'in';
    if (isClosureNode(targetNode) || isOdfNode(targetNode)) {
      const usedInputs = new Set(
        currentEdges.filter((edge) => edge.target === targetNode.id).map((edge) => edge.targetHandle),
      );
      const inputCount = isClosureNode(targetNode) ? CLOSURE_INPUT_PORTS : ODF_INPUT_PORTS;
      const availableInput = Array.from({ length: inputCount }, (_, index) => `in-${index}`)
        .find((handle) => !usedInputs.has(handle));
      if (!availableInput) {
        setLinkMessage(isClosureNode(targetNode)
          ? 'Both closure feeder entries are already patched.'
          : 'Both ODF input pairs are already patched.');
        return;
      }
      targetHandle = availableInput;
    }

    handleConnect({
      source: sourceNode.id,
      target: targetNode.id,
      sourceHandle,
      targetHandle,
    });
    setLinkMode(false);
    setLinkStartNodeId(null);
    setLinkMessage(`Connected ${sourceNode.id} to ${targetNode.id}.`);
  }, [getEdges, getNodes, handleConnect, handleDeleteEdge, linkMode, linkStartNodeId]);

  const closeMissions = useCallback(() => setMissionsOpen(false), []);
  const closeOtdr = useCallback(() => setOtdrOpen(false), []);
  const handleOpenOtdr = useCallback(() => {
    setBomOpen(false);
    setMissionsOpen(false);
    setOtdrOpen(true);
    setOpmActive(false);
    setOpmProbe(null);
    opmProbeRef.current = null;
    setLinkMode(false);
    setLinkStartNodeId(null);
  }, []);
  const handleOpenOverview = useCallback(() => {
    setBomOpen(false);
    setOtdrOpen(false);
    setMissionsOpen(false);
    setOpmActive(false);
    setOpmProbe(null);
    opmProbeRef.current = null;
    onOpenOverview();
  }, [onOpenOverview]);

  const applyPreset = useCallback(
    (presetId: string) => {
      const built = buildPreset(presetId);
      if (!built) return;
      setNodes(built.nodes);
      setEdges(built.edges);
      setCommittedSim(null);
      setOtdrOpen(false);
      setActivePresetId(presetId);
      setActiveMissionId(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelection({ nodeIds: [], edgeIds: [] });
      setLinkMode(false);
      setLinkStartNodeId(null);
      setOpmActive(false);
      setOpmProbe(null);
      opmProbeRef.current = null;
      setDirty(false);
      window.requestAnimationFrame(() => {
        void fitView({ padding: 0.08, maxZoom: 1.15, duration: 350 });
      });
    },
    [setNodes, setEdges, fitView],
  );

  const startMission = useCallback(
    (mission: Mission) => {
      const presetTopology = buildPreset(mission.presetId);
      if (!presetTopology) return;
      const topology = mission.prepareTopology?.(presetTopology) ?? presetTopology;
      setNodes(topology.nodes);
      setEdges(topology.edges);
      setSettings((current) => ({
        ...current,
        safetyMarginDb: mission.safetyMarginDb,
        autoRun: true,
      }));
      setCommittedSim(null);
      setDirty(false);
      setActivePresetId(mission.presetId);
      setActiveMissionId(mission.id);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelection({ nodeIds: [], edgeIds: [] });
      setLinkMode(false);
      setLinkStartNodeId(null);
      setOpmActive(false);
      setOpmProbe(null);
      opmProbeRef.current = null;
      setBomOpen(false);
      setOtdrOpen(false);
      window.requestAnimationFrame(() => {
        void fitView({ padding: 0.08, maxZoom: 1.15, duration: 350 });
      });
    },
    [setNodes, setEdges, fitView],
  );

  useEffect(() => {
    if (!landingCommand) return;
    if (landingCommand.kind === 'preset') {
      applyPreset(landingCommand.presetId);
    } else if (landingCommand.kind === 'mission') {
      const mission = getMissionById(landingCommand.missionId);
      if (mission) startMission(mission);
    } else {
      setMissionsOpen(true);
    }
  }, [landingCommand, applyPreset, startMission]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setOtdrOpen(false);
    setActivePresetId(null);
    setActiveMissionId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelection({ nodeIds: [], edgeIds: [] });
    setLinkMode(false);
    setLinkStartNodeId(null);
    setOpmActive(false);
    setOpmProbe(null);
    opmProbeRef.current = null;
    markDirty();
  }, [setNodes, setEdges, markDirty]);

  const handleSettingsChange = useCallback(
    (patch: Partial<DesignSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
      markDirty();
    },
    [markDirty],
  );

  const handleUnitCostsChange = useCallback((nextCosts: UnitCostProfile) => {
    setUnitCosts(resolveUnitCosts(nextCosts));
  }, []);
  const resetUnitCosts = useCallback(() => {
    setUnitCosts(resolveUnitCosts(DEFAULT_UNIT_COSTS));
  }, []);

  /* ------------------------------ Drag & drop ---------------------------- */

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(DND_MIME) || event.dataTransfer.getData('text/plain');
      if (!raw) return;

      let payload: ToolboxPayload;
      try {
        payload = JSON.parse(raw) as ToolboxPayload;
      } catch {
        return;
      }

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addComponent(payload, position);
    },
    [screenToFlowPosition, addComponent],
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance<PonNode, PonEdge>) => {
      void instance.fitView({ padding: 0.08, maxZoom: 1.15 });
    },
    [],
  );

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.08, maxZoom: 1.15, duration: 200 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isActive, sidebarCollapsed, inspectorCollapsed, fitView]);

  /* -------------------------------- Selection ---------------------------- */

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const summary = simulation.summary;

  const { powerBars, worstLossDb } = useMemo(() => {
    const oltNodes = nodes.filter(isOltNode);
    const oltTxDbm = oltNodes.length > 0 ? Math.max(...oltNodes.map((n) => n.data.txPowerDbm)) : 3.0;
    const splitterOutReadings = edges
      .filter((e) => {
        const src = nodes.find((n) => n.id === e.source);
        return src && (isSplitterNode(src) || isNapNode(src));
      })
      .map((e) => simulation.edgeTelemetry[e.id]?.powerDbm ?? null)
      .filter((v): v is number => v !== null);
    const splitterDropDbm =
      splitterOutReadings.length > 0 ? Math.max(...splitterOutReadings) : null;

    const allEndpointTelemetries = [
      ...Object.values(simulation.ontTelemetry),
      ...Object.values(simulation.gatewayTelemetry),
    ];
    const subscriberReadings = allEndpointTelemetries
      .map((t) => t.rxPowerDbm)
      .filter((v): v is number => v !== null);
    const activeLosses = allEndpointTelemetries
      .filter((t) => t.rxPowerDbm !== null)
      .map((t) => t.totalLossDb);

    const bestRxDbm =
      subscriberReadings.length > 0 ? Math.max(...subscriberReadings) : null;
    const worstRxDbm = summary.worstRxDbm;
    const maxLoss = activeLosses.length > 0 ? Math.max(...activeLosses) : null;

    return {
      worstLossDb: maxLoss,
      powerBars: [
        { label: 'OLT Launch', valueDbm: oltTxDbm, color: '#2563EB' },
        { label: 'After Splitter', valueDbm: splitterDropDbm, color: '#7C3AED' },
        { label: 'Closest ONT', valueDbm: bestRxDbm, color: '#16A34A' },
        {
          label: 'Farthest ONT',
          valueDbm: worstRxDbm,
          color: worstRxDbm !== null && worstRxDbm < -28 ? '#DC2626' : '#059669',
        },
      ],
    };
  }, [nodes, edges, simulation, summary.worstRxDbm]);

  return (
    <div
      className={`fiberlab-studio pu-shell ${
        testing ? 'is-simulating-pulse' : ''
      }`}
    >
      <TopBar
        summary={summary}
        costBreakdown={costBreakdown}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onPreset={applyPreset}
        onRunTest={runLightTest}
        onOpenBOM={() => setBomOpen(true)}
        onOpenOtdr={handleOpenOtdr}
        onOpenMissions={() => setMissionsOpen(true)}
        onOpenOverview={handleOpenOverview}
        onToggleLink={handleToggleLink}
        onToggleOpm={handleToggleOpm}
        onDeleteSelection={handleDeleteSelection}
        linkMode={linkMode}
        opmActive={opmActive}
        selectionCount={selectionCount}
        activeMissionTitle={activeMissionId ? getMissionById(activeMissionId)?.title ?? null : null}
        onClear={clearCanvas}
        testing={testing}
        stale={!settings.autoRun && dirty}
        activePresetId={activePresetId}
      />

      <div className="fiberlab-studio__body pu-body">
        <Sidebar
          onQuickAdd={handleQuickAdd}
          onToggleOpm={handleToggleOpm}
          onOpenOtdr={handleOpenOtdr}
          onRunSimulation={runLightTest}
          onOpenReports={() => setBomOpen(true)}
          onOpenSettings={() => setToolsOpen(true)}
          onOpenOverview={handleOpenOverview}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />

        <div className="pu-center">
        <div className="pu-tabstrip">
          <span className="pu-doc-tab">{PRESETS.find((preset) => preset.id === activePresetId)?.name ?? 'FTTH Network Design'}</span>
        </div>
        <main
          ref={studioMainRef}
          className={`fiberlab-studio-main pu-canvas relative min-w-0 flex-1 ${opmActive ? 'opm-probe-mode' : ''}`}
          onPointerMoveCapture={handleOpmPointerMove}
          onClickCapture={handleOpmClickCapture}
          onPointerLeave={handleOpmPointerLeave}
        >
          <CanvasToolbar
            canvasTool={canvasTool}
            linkMode={linkMode}
            opmActive={opmActive}
            selectionCount={selectionCount}
            activeMissionTitle={activeMissionId ? getMissionById(activeMissionId)?.title ?? null : null}
            settings={settings}
            toolsOpen={toolsOpen}
            onToolsOpenChange={setToolsOpen}
            onSettingsChange={handleSettingsChange}
            onSelectTool={() => {
              setCanvasTool('select');
              if (linkMode) handleToggleLink();
            }}
            onPanTool={() => {
              setCanvasTool('pan');
              if (linkMode) handleToggleLink();
            }}
            onToggleLink={handleToggleLink}
            onAddNode={() => handleQuickAdd({ component: 'ont' })}
            onDelete={handleDeleteSelection}
            onFit={() => void fitView({ padding: 0.16, duration: 350 })}
            onOpenOverview={handleOpenOverview}
            onToggleOpm={handleToggleOpm}
            onOpenOtdr={handleOpenOtdr}
            onOpenMissions={() => setMissionsOpen(true)}
            onClear={clearCanvas}
          />
          <SimulationContext.Provider value={simulation}>
            <ReactFlow<PonNode, PonEdge>
              nodes={nodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onSelectionChange={handleSelectionChange}
              onInit={handleInit}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              nodesDraggable={!opmActive && canvasTool === 'select'}
              nodesConnectable={!opmActive}
              elementsSelectable={!opmActive}
              selectionOnDrag={!opmActive && canvasTool === 'select'}
              panOnDrag={canvasTool === 'pan' ? true : [1, 2]}
              deleteKeyCode={['Backspace', 'Delete']}
              minZoom={0.2}
              maxZoom={2.2}
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.3} color="#E6D5C3" />
              <Controls position="bottom-right" showInteractive={false} />
              <MiniMap
                position="top-right"
                pannable
                zoomable
                className="!h-[116px] !w-[176px]"
                nodeColor={(node) => MINIMAP_COLORS[node.type ?? ''] ?? '#64748B'}
                nodeStrokeColor="#475569"
                nodeStrokeWidth={1.5}
                maskColor="rgba(248,250,252,0.75)"
              />

              {linkMode ? (
                <Panel position="top-left" className="!m-3 !mt-14">
                  <div className="link-mode-panel panel flex max-w-[min(420px,calc(100vw-28px))] items-center gap-3 rounded-xl px-3 py-2.5 shadow-panel" role="status" aria-live="polite">
                    <span className="link-mode-panel-icon"><Link2 size={16} aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <strong>{linkStartNodeId ? 'Choose a destination' : 'Link nodes'}</strong>
                      <small>{linkMessage}</small>
                    </span>
                    <button type="button" className="btn-ghost !min-h-8 !px-2" onClick={handleToggleLink}>
                      <X size={13} aria-hidden="true" /> Cancel
                    </button>
                  </div>
                </Panel>
              ) : null}

              <Panel position="bottom-left" className="!m-3">
                <span
                  className="pu-chip"
                  style={{ position: 'static' }}
                  role="status"
                  aria-label={`Network ${summary.byStatus.LOS > 0 || summary.byStatus.DISCONNECTED > 0 ? 'fault' : summary.byStatus.WARNING > 0 ? 'marginal' : 'healthy'}`}
                >
                  <span
                    className={`pu-health ${
                      summary.byStatus.LOS > 0 || summary.byStatus.DISCONNECTED > 0
                        ? 'red'
                        : summary.byStatus.WARNING > 0 || summary.byStatus.OVERLOAD > 0
                          ? 'amber'
                          : ''
                    }`}
                  >
                    ●{' '}
                    {summary.byStatus.LOS > 0 || summary.byStatus.DISCONNECTED > 0
                      ? 'Network Fault'
                      : summary.byStatus.WARNING > 0 || summary.byStatus.OVERLOAD > 0
                        ? 'Network Marginal'
                        : 'Network Healthy'}
                  </span>
                </span>
              </Panel>

              {nodes.length === 0 ? (
                <Panel position="top-center" className="!mt-16">
                  <div className="panel flex items-center gap-2.5 rounded-lg px-4 py-3 shadow-panel">
                    <MousePointer2 size={16} className="text-[#E4673F]" />
                    <div>
                      <div className="text-[12px] font-semibold text-slate-900">
                        The canvas is empty
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Drag an OLT from the Component Library to start designing your PON.
                      </div>
                    </div>
                  </div>
                </Panel>
              ) : null}
            </ReactFlow>
          </SimulationContext.Provider>
          {opmActive && opmProbe ? (
            <OpmMeterHud
              ref={opmHudRef}
              target={opmProbe}
              position={opmAnchor}
              readingDbm={opmReading}
              wavelength={meterWavelength}
              onWavelengthChange={setMeterWavelength}
              onClose={handleToggleOpm}
            />
          ) : null}
        </main>
        <BottomPanel
          summary={summary}
          simulation={simulation}
          nodes={nodes}
          edgeCount={edges.length}
          powerBars={powerBars}
          worstLossDb={worstLossDb}
          onOpenReports={() => setBomOpen(true)}
          onSelectNode={(nodeId) => {
            setSelectedNodeId(nodeId);
            setSelectedEdgeId(null);
            setSelection({ nodeIds: [nodeId], edgeIds: [] });
            setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
          }}
        />
        </div>

        <Inspector
          node={selectedNode}
          edge={selectedEdge}
          simulation={simulation}
          unitCosts={unitCosts}
          onUnitCostsChange={handleUnitCostsChange}
          onResetUnitCosts={resetUnitCosts}
          onPatchNode={handlePatchNode}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          collapsed={inspectorCollapsed}
          onToggleCollapse={() => setInspectorCollapsed((prev) => !prev)}
          onClose={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setSelection({ nodeIds: [], edgeIds: [] });
            setNodes((current) => current.map((node) => ({ ...node, selected: false })));
            setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
          }}
        />
      </div>

      <BOMModal
        open={bomOpen}
        onClose={() => setBomOpen(false)}
        nodes={nodes}
        edges={flowEdges}
        simulation={simulation}
        settings={settings}
        unitCosts={unitCosts}
        costBreakdown={costBreakdown}
      />
      <OtdrModal open={otdrOpen} onClose={closeOtdr} nodes={nodes} edges={edges} />
      <MissionDrawer
        open={missionsOpen}
        activeMissionId={activeMissionId}
        nodes={nodes}
        edges={edges}
        simulation={simulation}
        costBreakdown={costBreakdown}
        onClose={closeMissions}
        onStartMission={startMission}
      />
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'studio'>('landing');
  const [landingCommand, setLandingCommand] = useState<LandingCommand | null>(null);
  const [landingSnapshot, setLandingSnapshot] = useState<{ simulation: SimulationResult; stale: boolean } | null>(null);
  const commandSequence = useRef(0);
  const hasEnteredStudio = useRef(false);
  const studioViewportRef = useRef<HTMLDivElement>(null);
  const landingViewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    studioViewportRef.current?.toggleAttribute('inert', viewMode !== 'studio');
    landingViewportRef.current?.toggleAttribute('inert', viewMode !== 'landing');
  }, [viewMode]);

  const updateLandingSimulation = useCallback(
    (simulation: SimulationResult, stale: boolean) => setLandingSnapshot({ simulation, stale }),
    [],
  );

  const sendLandingCommand = useCallback((command: LandingCommandInput) => {
    const requestId = ++commandSequence.current;
    setLandingCommand({ ...command, requestId } as LandingCommand);
    setViewMode('studio');
  }, []);
  const launchStudio = useCallback(() => setViewMode('studio'), []);
  const openMissions = useCallback(() => sendLandingCommand({ kind: 'missions' }), [sendLandingCommand]);
  const loadPreset = useCallback(
    (presetId: string) => sendLandingCommand({ kind: 'preset', presetId }),
    [sendLandingCommand],
  );
  const startVillaMission = useCallback(
    () => sendLandingCommand({ kind: 'mission', missionId: 'marginal-villa' }),
    [sendLandingCommand],
  );
  const returnToOverview = useCallback(() => setViewMode('landing'), []);

  useEffect(() => {
    if (viewMode === 'studio') {
      hasEnteredStudio.current = true;
      const missionHeading = landingCommand?.kind === 'missions'
        ? document.getElementById('mission-drawer-title')
        : null;
      (missionHeading ?? document.getElementById('studio-overview-toggle'))?.focus({ preventScroll: true });
    } else if (hasEnteredStudio.current) {
      document.getElementById('landing-overview-link')?.focus({ preventScroll: true });
    }
  }, [viewMode, landingCommand]);

  return (
    <ReactFlowProvider>
      <div className="fiberlab-app-shell">
        <div
          ref={studioViewportRef}
          className={`studio-viewport ${viewMode === 'studio' ? 'is-active' : 'is-staged'}`}
          aria-hidden={viewMode !== 'studio'}
        >
          <StudioWorkspace
            onOpenOverview={returnToOverview}
            onSimulationChange={updateLandingSimulation}
            landingCommand={landingCommand}
            isActive={viewMode === 'studio'}
          />
        </div>
        <div
          ref={landingViewportRef}
          className={`landing-viewport ${viewMode === 'landing' ? 'is-active' : 'is-staged'}`}
          aria-hidden={viewMode !== 'landing'}
        >
          <LandingView
            simulation={landingSnapshot?.simulation ?? null}
            simulationStale={landingSnapshot?.stale ?? false}
            onLaunchStudio={launchStudio}
            onExploreMissions={openMissions}
            onLoadPreset={loadPreset}
            onStartVillaMission={startVillaMission}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export { StudioWorkspace };
