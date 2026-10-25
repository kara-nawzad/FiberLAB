import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
  type OnDelete,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Flag, Link2, Plus, X } from 'lucide-react';
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
  splitterBranchPortCount,
} from './types';
import {
  createAttenuatorNode,
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
  isAttenuatorNode,
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
import { SimulationContext } from './context/SimulationContext';
import {
  readOpticalPowerAtProbe,
  sameProbeTarget,
  simulateAtMeterWavelength,
  type OpticalProbeTarget,
} from './engine/opticalProbe';
import { OpmMeterHud } from './components/OpmMeterHud';

import { nodeTypes } from './components/nodes';
import { OpticalEdge } from './components/OpticalEdge';
import { Sidebar, DND_MIME, type ToolboxPayload } from './components/Sidebar';
import { Inspector } from './components/Inspector';

import { TopBar } from './components/TopBar';
import { DesignBar } from './components/DesignBar';
import { SectionRail, SectionTabBar, type SectionId } from './components/SectionNav';
import { useSectionFocus } from './hooks/useSectionFocus';
import { useSectionHistory } from './hooks/useSectionHistory';
import { SimulationScreen } from './components/SimulationScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { CanvasToolbar } from './components/CanvasToolbar';
import { StatusBar } from './components/StatusBar';

import { LandingView } from './components/landing/LandingView';
import { getMissionById, type Mission } from './engine/missions';
import {
  calculateNetworkCost,
  DEFAULT_UNIT_COSTS,
  resolveUnitCosts,
  type UnitCostProfile,
} from './data/pricingCatalogue';

const edgeTypes = { optical: OpticalEdge };

/* -------------------------------------------------------------------------- *
 * Deferred overlays.
 *
 * The OTDR analyser, the report screen and the mission drawer are large and are
 * only needed on demand, so each ships as its own chunk and is fetched the first
 * time the student opens it. The rest of the workbench stays in the entry chunk.
 * -------------------------------------------------------------------------- */
const BOMModal = lazy(() => import('./components/BOMModal').then((module) => ({ default: module.BOMModal })));
const OtdrModal = lazy(() => import('./components/OtdrModal').then((module) => ({ default: module.OtdrModal })));
const MissionDrawer = lazy(() =>
  import('./components/MissionDrawer').then((module) => ({ default: module.MissionDrawer })),
);

/**
 * Per-overlay suspense fallback. It keeps the same footprint as the panel it
 * replaces so the canvas does not jump, and announces itself once for screen
 * readers without stealing focus from whatever opened it.
 */
function OverlayLoading({ label, variant }: { label: string; variant: 'screen' | 'dialog' }) {
  return (
    <div className={`pu-overlay-loading is-${variant}`} role="status" aria-live="polite">
      <span className="pu-overlay-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

type LandingCommandInput =
  { kind: 'preset'; presetId: string } | { kind: 'mission'; missionId: string } | { kind: 'missions' };

type LandingCommand = LandingCommandInput & { requestId: number };

interface StudioWorkspaceProps {
  onOpenOverview: () => void;
  landingCommand: LandingCommand | null;
  isActive?: boolean;
}

/** Matches the canvas-first breakpoint in photo-ui.css. */
const NARROW_VIEWPORT_QUERY = '(max-width: 900px)';
/** Touch hardware drags the plane with one finger; a mouse keeps its buttons. */
const isCoarsePointer = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

const isNarrowViewport = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(NARROW_VIEWPORT_QUERY).matches
    : false;

const MINIMAP_COLORS: Record<string, string> = {
  olt: '#1E293B',
  splitter: '#7C3AED',
  fiber: '#FACC15',
  closure: '#334155',
  ont: '#16A34A',
  odf: '#0F766E',
  nap: '#EA580C',
  gateway: '#2563EB',
  attenuator: '#D97706',
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

/* The workbench opens on an empty canvas: pick a topology from the preset
 * picker, load one from the overview page, or follow a guided mission. */
function initialTopology(): { nodes: PonNode[]; edges: PonEdge[] } {
  return { nodes: [], edges: [] };
}

/* ========================================================================== *
 * Studio workspace — canvas, drag & drop, selection and simulation wiring.
 * ========================================================================== */

function StudioWorkspace({ onOpenOverview, landingCommand, isActive = true }: StudioWorkspaceProps) {
  const seeded = useMemo(initialTopology, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<PonNode>(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<PonEdge>(seeded.edges);
  const [settings, setSettings] = useState<DesignSettings>(DEFAULT_SETTINGS);
  const [unitCosts, setUnitCosts] = useState<UnitCostProfile>(() => resolveUnitCosts(DEFAULT_UNIT_COSTS));
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetEdited, setPresetEdited] = useState(false);
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
  const [activeSection, setActiveSection] = useState<SectionId>('design');
  const [otdrOpen, setOtdrOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [committedSim, setCommittedSim] = useState<SimulationResult | null>(null);
  const [canvasTool, setCanvasTool] = useState<'select' | 'pan'>('select');
  const [toolsOpen, setToolsOpen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  /* Read once: a phone does not become a desktop mid-session. */
  const [coarsePointer] = useState(isCoarsePointer);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [emptyHintDismissed, setEmptyHintDismissed] = useState(false);

  const { screenToFlowPosition, deleteElements, fitView, getNodes, getEdges, zoomIn, zoomOut, zoomTo } = useReactFlow<
    PonNode,
    PonEdge
  >();

  /* --------------------------- Simulation core --------------------------- */

  const liveSimulation = useMemo(() => simulateTopology(nodes, edges, settings, 0), [nodes, edges, settings]);

  const activeMission = useMemo(
    () => (activeMissionId ? (getMissionById(activeMissionId) ?? null) : null),
    [activeMissionId],
  );
  const blindFaultMode = Boolean(activeMission?.blindFaultMode);

  const simulation = useMemo(() => {
    const base = settings.autoRun ? liveSimulation : (committedSim ?? liveSimulation);
    return blindFaultMode ? { ...base, blindFaultMode: true } : base;
  }, [settings.autoRun, liveSimulation, committedSim, blindFaultMode]);

  const costBreakdown = useMemo(() => calculateNetworkCost(nodes, edges, unitCosts), [nodes, edges, unitCosts]);
  const opmSimulation = useMemo(
    () => (opmActive ? simulateAtMeterWavelength(nodes, edges, settings, meterWavelength) : null),
    [opmActive, nodes, edges, settings, meterWavelength],
  );
  const opmReading =
    opmActive && opmProbe && opmSimulation ? readOpticalPowerAtProbe(opmProbe, nodes, edges, opmSimulation) : null;

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

  const updateOpmProbeFromEvent = useCallback(
    (event: { target: EventTarget | null; clientX: number; clientY: number }) => {
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
    },
    [opmActive],
  );

  const handleOpmPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => updateOpmProbeFromEvent(event),
    [updateOpmProbeFromEvent],
  );
  const handleOpmClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!opmActive || (event.target instanceof Element && event.target.closest('.opm-meter-hud, .pu-toolbar')))
        return;
      updateOpmProbeFromEvent(event);
      event.preventDefault();
      event.stopPropagation();
    },
    [opmActive, updateOpmProbeFromEvent],
  );
  const handleOpmPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (
        !opmActive ||
        (event.relatedTarget instanceof Element && event.relatedTarget.closest('.opm-meter-hud, .pu-toolbar'))
      )
        return;
      opmProbeRef.current = null;
      setOpmProbe(null);
    },
    [opmActive],
  );

  /* ------------------------------ Mutations ------------------------------ */

  // Any edit both stales the committed run and distances the canvas from the
  // preset it was loaded from, so the document tab can say so.
  const markDirty = useCallback(() => {
    setDirty(true);
    setPresetEdited(true);
  }, []);

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
        const portCount = splitterBranchPortCount(ratio as SplitRatio);
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

  // Backspace/Delete on the canvas bypasses the toolbar, so it needs the same
  // bookkeeping: stale the committed run and drop deleted rows from the inspector.
  const handleCanvasDelete = useCallback<OnDelete<PonNode, PonEdge>>(
    ({ nodes: deletedNodes, edges: deletedEdges }) => {
      if (deletedNodes.length === 0 && deletedEdges.length === 0) return;
      const deletedNodeIds = new Set(deletedNodes.map((node) => node.id));
      const deletedEdgeIds = new Set(deletedEdges.map((edge) => edge.id));
      setSelectedNodeId((current) => (current !== null && deletedNodeIds.has(current) ? null : current));
      setSelectedEdgeId((current) => (current !== null && deletedEdgeIds.has(current) ? null : current));
      markDirty();
    },
    [markDirty],
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
        node = createFiberNode(
          payload.cableType ?? 'distribution',
          { position: centered },
          payload.fiberProfile ?? 'singlemode',
        );
      } else if (kind === 'closure') {
        node = createClosureNode({ position: centered });
      } else if (kind === 'odf') {
        node = createOdfNode({ position: centered });
      } else if (kind === 'nap') {
        node = createNapNode({ position: centered });
      } else if (kind === 'gateway') {
        node = createGatewayNode({ position: centered });
      } else if (kind === 'attenuator') {
        node = createAttenuatorNode(payload.attenuationDb, { position: centered });
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
      // Double-click placement: drop the element around the visible canvas centre,
      // cascading slightly per existing element so repeats do not stack exactly.
      const bounds = studioMainRef.current?.getBoundingClientRect();
      const centre = bounds
        ? screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
        : { x: 420, y: 300 };
      const cascade = (nodes.length % 5) * 28;
      addComponent(payload, { x: centre.x + cascade, y: centre.y + cascade });
      // On narrow screens the library floats over the canvas; get out of the way
      // once the component has landed.
      if (isNarrowViewport()) setSidebarCollapsed(true);
    },
    [addComponent, nodes.length, screenToFlowPosition],
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
      if (sourceNode && isSplitterNode(sourceNode)) {
        const handleIndex = Number((connection.sourceHandle ?? '').replace(/^out-/, ''));
        if (
          !Number.isInteger(handleIndex) ||
          handleIndex < 0 ||
          handleIndex >= splitterBranchPortCount(sourceNode.data.ratio)
        ) {
          return;
        }
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
          targetHandle:
            connection.targetHandle ??
            (targetNode && (isClosureNode(targetNode) || isOdfNode(targetNode)) ? 'in-0' : 'in'),
          type: 'optical',
        };

        let filtered = currentEdges;
        // Subscriber terminals and NAP/FAT each have one optical input.
        if (
          targetNode &&
          (isSubscriberEndpointNode(targetNode) || isNapNode(targetNode) || isAttenuatorNode(targetNode))
        ) {
          filtered = filtered.filter((edge) => edge.target !== target);
        }
        // Multi-input hardware replaces only the patch on the selected port.
        if (targetNode && (isClosureNode(targetNode) || isOdfNode(targetNode))) {
          const targetHandle = connection.targetHandle ?? 'in-0';
          filtered = filtered.filter((edge) => edge.target !== target || edge.targetHandle !== targetHandle);
        }
        // An OLT port or a cable span has a single output.
        if (sourceNode && (isOltNode(sourceNode) || isFiberNode(sourceNode) || isAttenuatorNode(sourceNode))) {
          filtered = filtered.filter((edge) => edge.source !== source);
        }
        // Each physical output on a passive branching/patch component is single-cord.
        if (
          sourceNode &&
          (isSplitterNode(sourceNode) || isClosureNode(sourceNode) || isOdfNode(sourceNode) || isNapNode(sourceNode))
        ) {
          const sourceHandle = connection.sourceHandle;
          filtered = filtered.filter((edge) => edge.source !== source || edge.sourceHandle !== sourceHandle);
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
      // One sheet at a time on phones: opening the properties sheet closes the status sheet.
      if (isNarrowViewport()) setStatusExpanded(false);
    }
    setSelection({
      nodeIds: params.nodes.map((node) => node.id),
      edgeIds: params.edges.map((edge) => edge.id),
    });
  }, []);

  const selectionCount = selection.nodeIds.length + selection.edgeIds.length;

  /* Design → Simulation → Reports → Settings. Leaving Design folds every
   * design-only affordance so the next screen is clean. `applySection` is the
   * pure state move; `handleSectionChange` adds the history bookkeeping so the
   * browser Back button walks the same path. */
  const applySection = useCallback((section: SectionId) => {
    setActiveSection(section);
    setToolsOpen(false);
    setStatusExpanded(false);
    setOpmActive(false);
    setOpmProbe(null);
    opmProbeRef.current = null;
    setLinkMode(false);
    setLinkStartNodeId(null);
    /* Phones summon the library from its own pill, so only a docked desktop
     * column is restored here; leaving Design folds the phone sheet away. */
    if (section === 'design') {
      if (!isNarrowViewport()) setSidebarCollapsed(false);
    } else if (isNarrowViewport()) {
      setSidebarCollapsed(true);
    }
  }, []);

  const { push: pushSection } = useSectionHistory(applySection);

  const handleSectionChange = useCallback(
    (section: SectionId) => {
      if (section !== activeSection) pushSection(section);
      applySection(section);
    },
    [activeSection, applySection, pushSection],
  );

  /** Every "get me back to the canvas" affordance moves through the same path. */
  const goToDesign = useCallback(() => handleSectionChange('design'), [handleSectionChange]);

  /* Design is a canvas, not a document, so its focus target is a hidden heading
   * that names the screen for assistive tech. */
  const designHeadingRef = useSectionFocus<HTMLHeadingElement>();

  /* The status bar is the third phone sheet, so opening it folds the others. */
  const handleStatusExpandedChange = useCallback((open: boolean) => {
    setStatusExpanded(open);
    if (open && isNarrowViewport()) {
      setSidebarCollapsed(true);
      setInspectorCollapsed(true);
    }
  }, []);

  /* A warning in the Events list jumps to the component it belongs to. */
  const handleFocusNode = useCallback(
    (nodeId: string) => {
      goToDesign();
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setInspectorCollapsed(false);
      setSelection({ nodeIds: [nodeId], edgeIds: [] });
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === nodeId })));
      if (isNarrowViewport()) setStatusExpanded(false);
      void fitView({ nodes: [{ id: nodeId }], duration: 320, padding: 2.4, maxZoom: 1.15 });
    },
    [fitView, goToDesign, setNodes],
  );

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

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, clickedNode: PonNode) => {
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
      const existingEdge = currentEdges.find((edge) => edge.source === sourceNode.id && edge.target === targetNode.id);
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
          currentEdges.filter((edge) => edge.source === sourceNode.id).map((edge) => edge.sourceHandle),
        );
        const outputCount = splitterBranchPortCount(sourceNode.data.ratio);
        sourceHandle = Array.from({ length: outputCount }, (_, index) => `out-${index}`).find(
          (handle) => !usedHandles.has(handle),
        );
        if (!sourceHandle) {
          setLinkMessage(`All 1:${sourceNode.data.ratio} splitter outputs are already patched.`);
          return;
        }
      } else if (isClosureNode(sourceNode)) {
        const usedHandles = new Set(
          currentEdges.filter((edge) => edge.source === sourceNode.id).map((edge) => edge.sourceHandle),
        );
        sourceHandle = Array.from({ length: CLOSURE_OUTPUT_PORTS }, (_, index) => `out-${index}`).find(
          (handle, index) => sourceNode.data.activeSpliceChannels[index] && !usedHandles.has(handle),
        );
        if (!sourceHandle) {
          setLinkMessage('No active, unpatched closure branch is available. Splice a tray channel first.');
          return;
        }
      } else if (isOdfNode(sourceNode)) {
        const usedHandles = new Set(
          currentEdges.filter((edge) => edge.source === sourceNode.id).map((edge) => edge.sourceHandle),
        );
        sourceHandle = Array.from({ length: ODF_OUTPUT_PORTS }, (_, index) => `out-${index}`).find(
          (handle) => !usedHandles.has(handle),
        );
        if (!sourceHandle) {
          setLinkMessage('Both ODF through-pair outputs are already patched.');
          return;
        }
      } else if (isNapNode(sourceNode)) {
        const usedHandles = new Set(
          currentEdges.filter((edge) => edge.source === sourceNode.id).map((edge) => edge.sourceHandle),
        );
        sourceHandle = Array.from({ length: NAP_OUTPUT_PORTS }, (_, index) => `out-${index}`).find(
          (handle) => !usedHandles.has(handle),
        );
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
        const availableInput = Array.from({ length: inputCount }, (_, index) => `in-${index}`).find(
          (handle) => !usedInputs.has(handle),
        );
        if (!availableInput) {
          setLinkMessage(
            isClosureNode(targetNode)
              ? 'Both closure feeder entries are already patched.'
              : 'Both ODF input pairs are already patched.',
          );
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
    },
    [getEdges, getNodes, handleConnect, handleDeleteEdge, linkMode, linkStartNodeId],
  );

  /* Only one overlay owns the keyboard at a time: opening one closes the others. */
  const closeBom = useCallback(() => goToDesign(), [goToDesign]);
  /** Reports is a section now, not a dialog. */
  const openBom = useCallback(() => {
    setMissionsOpen(false);
    setOtdrOpen(false);
    handleSectionChange('reports');
  }, [handleSectionChange]);
  /* Reports is a reading screen; Escape is the keyboard's Back to Design. */
  useEffect(() => {
    if (activeSection !== 'reports') return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      closeBom();
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [activeSection, closeBom]);

  const closeMissions = useCallback(() => setMissionsOpen(false), []);
  const openMissions = useCallback(() => {
    setOtdrOpen(false);
    setMissionsOpen(true);
  }, []);
  const closeOtdr = useCallback(() => setOtdrOpen(false), []);
  const handleOpenOtdr = useCallback(() => {
    setMissionsOpen(false);
    setOtdrOpen(true);
    setOpmActive(false);
    setOpmProbe(null);
    opmProbeRef.current = null;
    setLinkMode(false);
    setLinkStartNodeId(null);
  }, []);
  const handleOpenOverview = useCallback(() => {
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
      setPresetEdited(false);
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
      setPresetEdited(false);
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
      setOtdrOpen(false);
      goToDesign();
      window.requestAnimationFrame(() => {
        void fitView({ padding: 0.08, maxZoom: 1.15, duration: 350 });
      });
    },
    [setNodes, setEdges, fitView, goToDesign],
  );

  useEffect(() => {
    if (!landingCommand) return;
    if (landingCommand.kind === 'preset') {
      applyPreset(landingCommand.presetId);
    } else if (landingCommand.kind === 'mission') {
      const mission = getMissionById(landingCommand.missionId);
      if (mission) startMission(mission);
    } else {
      openMissions();
    }
  }, [landingCommand, applyPreset, startMission, openMissions]);

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
    setPresetEdited(false);
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

  const handleInit = useCallback((instance: ReactFlowInstance<PonNode, PonEdge>) => {
    void instance.fitView({ padding: 0.08, maxZoom: 1.15 });
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.08, maxZoom: 1.15, duration: 200 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isActive, sidebarCollapsed, inspectorCollapsed, fitView]);

  // Canvas-first on small screens: start with the component library and the
  // inspector collapsed so the canvas is usable, then re-collapse them if the
  // window shrinks to that size. Selecting a node or an edge re-opens the
  // inspector as an overlay sheet.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(NARROW_VIEWPORT_QUERY);
    const sync = () => {
      if (!query.matches) return;
      setSidebarCollapsed(true);
      setInspectorCollapsed(true);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /* -------------------------------- Selection ---------------------------- */

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  const selectedEdge = useMemo(() => edges.find((edge) => edge.id === selectedEdgeId) ?? null, [edges, selectedEdgeId]);

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
    const splitterDropDbm = splitterOutReadings.length > 0 ? Math.max(...splitterOutReadings) : null;

    const allEndpointTelemetries = [
      ...Object.values(simulation.ontTelemetry),
      ...Object.values(simulation.gatewayTelemetry),
    ];
    const subscriberReadings = allEndpointTelemetries.map((t) => t.rxPowerDbm).filter((v): v is number => v !== null);
    const activeLosses = allEndpointTelemetries.filter((t) => t.rxPowerDbm !== null).map((t) => t.totalLossDb);

    const bestRxDbm = subscriberReadings.length > 0 ? Math.max(...subscriberReadings) : null;
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
    <div className={`fiberlab-studio pu-shell ${testing ? 'is-simulating-pulse' : ''}`}>
      <TopBar
        projectName={PRESETS.find((preset) => preset.id === activePresetId)?.name ?? 'FTTH Network Design'}
        presetEdited={presetEdited}
        onRunTest={runLightTest}
        onOpenOverview={handleOpenOverview}
        testing={testing}
        stale={!settings.autoRun && dirty}
      />

      <div className="fiberlab-studio__body pu-body">
        <SectionRail active={activeSection} onChange={handleSectionChange} />

        {activeSection === 'design' ? (
          <>
            <h1 ref={designHeadingRef} tabIndex={-1} className="sr-only">
              Design canvas
            </h1>
            <Sidebar
              onQuickAdd={handleQuickAdd}
              onToggleOpm={handleToggleOpm}
              onOpenOtdr={handleOpenOtdr}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => {
                const next = !sidebarCollapsed;
                setSidebarCollapsed(next);
                if (next && isNarrowViewport()) setStatusExpanded(false);
              }}
            />

            <div className="pu-center">
              <DesignBar
                activePresetId={activePresetId}
                presetEdited={presetEdited}
                stale={!settings.autoRun && dirty}
                onPreset={applyPreset}
              />
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
                  selectionCount={selectionCount}
                  toolsOpen={toolsOpen}
                  onToolsOpenChange={setToolsOpen}
                  snapToGrid={snapToGrid}
                  onToggleSnap={() => setSnapToGrid((value) => !value)}
                  onSelectTool={() => {
                    setCanvasTool('select');
                    if (linkMode) handleToggleLink();
                  }}
                  onPanTool={() => {
                    setCanvasTool('pan');
                    if (linkMode) handleToggleLink();
                  }}
                  onToggleLink={handleToggleLink}
                  onDelete={handleDeleteSelection}
                  onFit={() => void fitView({ padding: 0.16, duration: 350 })}
                  onZoomIn={() => void zoomIn({ duration: 180 })}
                  onZoomOut={() => void zoomOut({ duration: 180 })}
                  onZoomReset={() => void zoomTo(1, { duration: 200 })}
                />
                {/* Phones have no room for a permanent library column, so the
                component sheet is summoned from here. */}
                {sidebarCollapsed ? (
                  <button
                    type="button"
                    className="pu-fab-components"
                    onClick={() => {
                      setSidebarCollapsed(false);
                      if (isNarrowViewport()) setStatusExpanded(false);
                    }}
                    aria-label="Open component library"
                  >
                    <Plus size={16} aria-hidden="true" /> Components
                  </button>
                ) : null}
                <SimulationContext.Provider value={simulation}>
                  <ReactFlow<PonNode, PonEdge>
                    nodes={nodes}
                    edges={flowEdges}
                    snapToGrid={snapToGrid}
                    snapGrid={[16, 16]}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={handleConnect}
                    onNodeClick={(event, clickedNode) => {
                      // Clicking a part always brings the panel back, even if it was closed.
                      setInspectorCollapsed(false);
                      handleNodeClick(event, clickedNode);
                    }}
                    onEdgeClick={() => setInspectorCollapsed(false)}
                    onSelectionChange={handleSelectionChange}
                    onDelete={handleCanvasDelete}
                    onInit={handleInit}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    nodesDraggable={!opmActive && canvasTool === 'select'}
                    nodesConnectable={!opmActive}
                    elementsSelectable={!opmActive}
                    selectionOnDrag={!opmActive && canvasTool === 'select'}
                    /* Select mode pans with middle/right drag on a mouse, but a
                     * finger drag on empty canvas must pan too (nodes still drag). */
                    panOnDrag={canvasTool === 'pan' || coarsePointer ? true : [1, 2]}
                    deleteKeyCode={['Backspace', 'Delete']}
                    minZoom={0.2}
                    maxZoom={2.2}
                    fitView
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background variant={BackgroundVariant.Dots} gap={17} size={1.6} color="#DCC4AC" />
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
                      <Panel position="bottom-center" className="pu-link-panel !m-3">
                        <div
                          className="link-mode-panel panel flex max-w-[min(420px,calc(100vw-28px))] items-center gap-3 rounded-xl px-3 py-2 shadow-panel"
                          role="status"
                          aria-live="polite"
                        >
                          <span className="link-mode-panel-icon">
                            <Link2 size={16} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong>{linkStartNodeId ? 'Choose a destination' : 'Link nodes'}</strong>
                            <small>{linkMessage}</small>
                          </span>
                          <button type="button" className="btn-ghost !min-h-8 !px-2" onClick={handleToggleLink}>
                            <X size={14} aria-hidden="true" /> Cancel
                          </button>
                        </div>
                      </Panel>
                    ) : null}

                    {nodes.length === 0 && !emptyHintDismissed ? (
                      <Panel position="top-center" className="pu-empty-panel !m-2">
                        <div className="pu-empty-note">
                          <span className="pu-empty-title">The canvas is empty</span>
                          <span className="pu-empty-hint">Drag in an OLT, or let a mission walk you through it.</span>
                          <button type="button" className="pu-empty-action" onClick={openMissions}>
                            <Flag size={11} aria-hidden="true" />
                            Open the mission
                          </button>
                          <button
                            type="button"
                            className="pu-empty-dismiss"
                            onClick={() => setEmptyHintDismissed(true)}
                            aria-label="Dismiss canvas hint"
                            title="Dismiss"
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
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
              <StatusBar
                summary={summary}
                simulation={simulation}
                nodes={nodes}
                powerBars={powerBars}
                worstLossDb={worstLossDb}
                expanded={statusExpanded}
                onExpandedChange={handleStatusExpandedChange}
                onOpenReports={openBom}
                onFocusNode={handleFocusNode}
              />
            </div>

            {/* The panel only exists while a component is selected (and not closed),
            so the canvas keeps the width the rest of the time. */}
            {(selectedNode || selectedEdge) && !inspectorCollapsed ? (
              <Inspector
                key={selectedNode?.id ?? selectedEdge?.id ?? 'selection'}
                node={selectedNode}
                edge={selectedEdge}
                simulation={simulation}
                onPatchNode={handlePatchNode}
                onDeleteNode={handleDeleteNode}
                onDeleteEdge={handleDeleteEdge}
                onClose={() => setInspectorCollapsed(true)}
              />
            ) : null}
          </>
        ) : null}

        {activeSection === 'simulation' ? (
          <SimulationScreen
            summary={summary}
            simulation={simulation}
            nodes={nodes}
            powerBars={powerBars}
            worstLossDb={worstLossDb}
            testing={testing}
            stale={!settings.autoRun && dirty}
            autoRun={settings.autoRun}
            onRun={runLightTest}
            onFocusNode={handleFocusNode}
            onOpenReports={openBom}
          />
        ) : null}

        {activeSection === 'reports' ? (
          <Suspense fallback={<OverlayLoading label="Loading the bill of materials…" variant="screen" />}>
            <BOMModal
              open
              onClose={closeBom}
              nodes={nodes}
              edges={flowEdges}
              simulation={simulation}
              settings={settings}
              unitCosts={unitCosts}
              onUnitCostsChange={handleUnitCostsChange}
              onResetUnitCosts={resetUnitCosts}
              costBreakdown={costBreakdown}
            />
          </Suspense>
        ) : null}

        {activeSection === 'settings' ? (
          <SettingsScreen
            settings={settings}
            onSettingsChange={handleSettingsChange}
            opmActive={opmActive}
            activeMissionTitle={activeMission?.title ?? null}
            onToggleOpm={() => {
              goToDesign();
              handleToggleOpm();
            }}
            onOpenOtdr={() => {
              goToDesign();
              handleOpenOtdr();
            }}
            onOpenMissions={() => {
              goToDesign();
              openMissions();
            }}
            onClear={() => {
              goToDesign();
              clearCanvas();
            }}
            onOpenOverview={handleOpenOverview}
          />
        ) : null}
      </div>
      <SectionTabBar active={activeSection} onChange={handleSectionChange} />

      {otdrOpen ? (
        <Suspense fallback={<OverlayLoading label="Loading the OTDR trace analyser…" variant="dialog" />}>
          <OtdrModal open onClose={closeOtdr} nodes={nodes} edges={edges} />
        </Suspense>
      ) : null}
      {missionsOpen ? (
        <Suspense fallback={<OverlayLoading label="Loading the mission brief…" variant="dialog" />}>
          <MissionDrawer
            open
            activeMissionId={activeMissionId}
            nodes={nodes}
            edges={edges}
            simulation={simulation}
            costBreakdown={costBreakdown}
            onClose={closeMissions}
            onStartMission={startMission}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'studio'>('landing');
  const [landingCommand, setLandingCommand] = useState<LandingCommand | null>(null);
  const commandSequence = useRef(0);
  const hasEnteredStudio = useRef(false);
  const studioViewportRef = useRef<HTMLDivElement>(null);
  const landingViewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    studioViewportRef.current?.toggleAttribute('inert', viewMode !== 'studio');
    landingViewportRef.current?.toggleAttribute('inert', viewMode !== 'landing');
  }, [viewMode]);

  const sendLandingCommand = useCallback((command: LandingCommandInput) => {
    const requestId = ++commandSequence.current;
    setLandingCommand({ ...command, requestId } as LandingCommand);
    setViewMode('studio');
  }, []);
  const launchStudio = useCallback(() => setViewMode('studio'), []);
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
      const missionHeading =
        landingCommand?.kind === 'missions' ? document.getElementById('mission-drawer-title') : null;
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
            onLaunchStudio={launchStudio}
            onLoadPreset={loadPreset}
            onStartVillaMission={startVillaMission}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export { StudioWorkspace };
