import type { PonEdge, PonNode, SimulationResult } from '../types';
import type { NetworkCostBreakdown } from '../data/pricingCatalogue';
import { calculateNetworkCost } from '../data/pricingCatalogue';
import { DEFAULT_SAFETY_MARGIN_DB } from '../types';

/** Domain-friendly alias used by mission validators and the drawer. */
export type NetworkSimulationResult = SimulationResult;

export type MissionDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface MissionObjective {
  id: string;
  description: string;
  isMet: (
    simulation: NetworkSimulationResult,
    nodes: PonNode[],
    edges: PonEdge[],
    costBreakdown?: NetworkCostBreakdown,
  ) => boolean;
}

export interface MissionTopology {
  nodes: PonNode[];
  edges: PonEdge[];
}

export interface Mission {
  id: string;
  title: string;
  difficulty: MissionDifficulty;
  scenarioBrief: string;
  objectives: MissionObjective[];
  fieldHints: string[];
  /** Existing topology preset used as the mission's editable starting point. */
  presetId: string;
  safetyMarginDb: number;
  /** When true, fault badges and warning glyphs are hidden on the canvas. */
  blindFaultMode?: boolean;
  /** Optional scenario-specific setup applied to a fresh copy of the preset. */
  prepareTopology?: (topology: MissionTopology) => MissionTopology;
}

export interface MissionObjectiveProgress {
  objective: MissionObjective;
  isMet: boolean;
}

function isOnline(simulation: NetworkSimulationResult, ontId: string): boolean {
  const reading = simulation.ontTelemetry[ontId];
  return reading?.status === 'ONLINE' && reading.rxPowerDbm !== null;
}

function isFaultyOrSeveredSpan(node: PonNode): boolean {
  if (node.type !== 'fiber') return false;
  return Boolean(
    node.data.macroBendActive ||
    node.data.dirtyConnectorActive ||
    (node.data.attenuationOverrideDbPerKm !== null && node.data.attenuationOverrideDbPerKm > 1),
  );
}

const marginalVillaAudit: Mission = {
  id: 'marginal-villa',
  title: 'The Marginal Villa',
  difficulty: 'Intermediate',
  scenarioBrief:
    'A 1:32 GPON tree serves three villas. Villa 3 is receiving −24.3 dBm and has slipped into WARNING after a long drop with more connector loss than the other homes. Improve the route without breaking the design margin or overdriving the OLT.',
  presetId: 'standard-1x32',
  safetyMarginDb: DEFAULT_SAFETY_MARGIN_DB,
  objectives: [
    {
      id: 'villas-online',
      description: 'Bring all three connected ONTs into the ONLINE window (−24 to −8 dBm).',
      isMet: (simulation, nodes, edges) => {
        const onts = nodes.filter((node) => node.type === 'ont');
        return (
          onts.length === 3 &&
          onts.every((ont) => edges.some((edge) => edge.target === ont.id) && isOnline(simulation, ont.id))
        );
      },
    },
    {
      id: 'preserve-margin',
      description: 'Keep the global safety margin at exactly 2.0 dB.',
      isMet: (simulation) => Math.abs(simulation.safetyMarginDb - 2) < 0.0001,
    },
    {
      id: 'protect-olt-budget',
      description: 'Keep every OLT launch power at or below the Class B+ limit of +5.0 dBm.',
      isMet: (_simulation, nodes) => {
        const olts = nodes.filter((node) => node.type === 'olt');
        return olts.length > 0 && olts.every((olt) => olt.data.txPowerDbm <= 5.0);
      },
    },
  ],
  fieldHints: [
    'Compare Villa 3’s drop with the shorter drops. Its 6 km span and four SC/APC connector counts contribute much more loss.',
    'Select the affected fiber span and examine the per-span cable, splice, and connector losses before changing the design.',
    'Try correcting the plant (for example, shortening the route or reducing unnecessary connection points). Keep the safety margin at 2 dB and solve the budget without increasing OLT power.',
  ],
};

const silentOntAudit: Mission = {
  id: 'silent-ont',
  title: 'Diagnose the Silent ONT',
  difficulty: 'Advanced',
  scenarioBrief:
    'A subscriber reports a complete service loss. Audit the source laser, trace the feeder and patch path, then inspect the excessive 1:512 split cascade and long plant. Restore a real optical path and bring the target ONT back into the ONLINE receive window.',
  presetId: 'failing-long-haul',
  safetyMarginDb: DEFAULT_SAFETY_MARGIN_DB,
  prepareTopology: (topology) => ({
    ...topology,
    // Introduce a clear first checkpoint: the source is dark. Once corrected,
    // the learner still has to diagnose the long, high-loss optical plant.
    nodes: topology.nodes.map((node) =>
      node.type === 'olt' && node.id === 'olt-b' ? { ...node, data: { ...node.data, laserOn: false } } : node,
    ),
  }),
  objectives: [
    {
      id: 'source-laser',
      description: 'Confirm at least one OLT laser is enabled.',
      isMet: (_simulation, nodes) => nodes.some((node) => node.type === 'olt' && node.data.laserOn),
    },
    {
      id: 'restore-path',
      description: 'Restore an OLT-to-ONT optical path to Dukan Ridge — Tower 7.',
      isMet: (simulation, nodes, edges) => {
        const target = nodes.find((node) => node.type === 'ont' && node.id === 'ont-b1');
        if (!target) return false;
        const reading = simulation.ontTelemetry[target.id];
        return Boolean(
          reading?.sourceOltId && reading.rxPowerDbm !== null && edges.some((edge) => edge.target === target.id),
        );
      },
    },
    {
      id: 'target-online',
      description: 'Reduce the target path loss until the ONT is ONLINE (−24 to −8 dBm).',
      isMet: (simulation) => isOnline(simulation, 'ont-b1'),
    },
  ],
  fieldHints: [
    'Start at the headend: verify the OLT laser is on and the feeder is actually patched to its output.',
    'Follow the live path through each span and splitter. An idle edge means no active light reaches that point; a degraded edge means light is present but weak.',
    'The starting plant is about 28 km long with a 1:32 × 1:16 cascade (1:512 aggregate). Check the split stages and long spans in the ONT link-budget breakdown.',
    'Restore service by correcting the topology and loss budget—not by relying on transmit power outside the equipment limit.',
  ],
};

const unpatchedSubscriberAudit: Mission = {
  id: 'rescue-unpatched-subscriber',
  title: 'Rescue the Unpatched Subscriber',
  difficulty: 'Intermediate',
  scenarioBrief:
    'Dukan Ridge — Not Yet Wired has no optical reading because its drop has never been patched into the 1:512 cascade. Restore both connections, then reduce the split loss enough to bring the subscriber into the ONLINE window.',
  presetId: 'failing-long-haul',
  safetyMarginDb: DEFAULT_SAFETY_MARGIN_DB,
  objectives: [
    {
      id: 'patch-splitter-drop',
      description: 'Patch output 3 of the 1:16 splitter to the subscriber’s drop span.',
      isMet: (_simulation, _nodes, edges) =>
        edges.some(
          (edge) =>
            edge.source === 'splitter-1x16-b' && edge.sourceHandle === 'out-2' && edge.target === 'fiber-drop-b3',
        ),
    },
    {
      id: 'patch-drop-ont',
      description: 'Connect the drop span to Dukan Ridge — Not Yet Wired.',
      isMet: (_simulation, _nodes, edges) =>
        edges.some((edge) => edge.source === 'fiber-drop-b3' && edge.target === 'ont-b3'),
    },
    {
      id: 'rescue-subscriber-online',
      description: 'Reduce the cascaded split loss until the target ONT is ONLINE (−24 to −8 dBm).',
      isMet: (simulation) => isOnline(simulation, 'ont-b3'),
    },
  ],
  fieldHints: [
    'Start at the subscriber side: find the unpatched short drop and the ONT labelled “Dukan Ridge — Not Yet Wired.”',
    'Use output 3 (handle out-2) on the 1:16 splitter, then connect the other end of the drop to the ONT input.',
    'A connected edge does not guarantee service. The 1:32 × 1:16 cascade is 1:512; compare its insertion losses and reduce the split ratios while keeping the 2 dB safety margin.',
    'Verify the final receive reading is inside the −24 to −8 dBm ONLINE window. Optional macro-bend (+3.50 dB) and dirty-ferrule (+2.00 dB) switches add separate educational penalties to the path breakdown; clear them or account for them while troubleshooting.',
  ],
};

const budgetCrunchMission: Mission = {
  id: 'budget-crunch',
  title: 'The Budget Crunch: Cost vs. Performance',
  difficulty: 'Intermediate',
  scenarioBrief:
    'The ISP manager has capped this three-home FTTH build at $1,600. All three customers must land in the ONLINE receive window (−24 to −8 dBm) while the design keeps at least 2.0 dB of safety margin. Balance the material quote against the optical path budget.',
  presetId: 'standard-1x32',
  safetyMarginDb: 2.0,
  objectives: [
    {
      id: 'three-homes-online',
      description: 'Keep all 3 connected customer ONTs ONLINE (−24 to −8 dBm).',
      isMet: (simulation, nodes, edges) => {
        const onts = nodes.filter((node) => node.type === 'ont');
        return (
          onts.length === 3 &&
          onts.every(
            (ont) =>
              edges.some((edge) => edge.target === ont.id) && simulation.ontTelemetry[ont.id]?.status === 'ONLINE',
          )
        );
      },
    },
    {
      id: 'capex-under-budget',
      description: 'Keep the total reference CAPEX below $1,600.00.',
      isMet: (_simulation, nodes, edges, costBreakdown) =>
        (costBreakdown ?? calculateNetworkCost(nodes, edges)).totalCapex < 1600,
    },
    {
      id: 'budget-safety-margin',
      description: 'Maintain a global safety margin of at least 2.0 dB.',
      isMet: (simulation) => simulation.safetyMarginDb >= 2.0 - 0.0001,
    },
  ],
  fieldHints: [
    'Start with the CAPEX badge, then open Commercial Quotation & CAPEX to identify the largest deployed-material and labor line items.',
    'At the reference rates, feeder cable is $350/km, distribution cable is $250/km, and drop cable is $150/km. The long remote drop is the first place to review for both cost and loss.',
    'The starting 1:4 × 1:8 splitter path is still a 1:32 design. Shorten unnecessary routes while checking every ONT reading and keeping at least 2 dB of design margin.',
    'Local unit prices can be edited in the Inspector. This mission evaluates the current quotation, so custom local rates change the budget checkpoint but never change optical physics.',
  ],
};

const blindFaultTrunkCutMission: Mission = {
  id: 'blind-fault',
  title: 'Blind Fault: The Cut in the Trunk',
  difficulty: 'Advanced',
  scenarioBrief:
    'A sudden outage has taken down all subscribers on a neighborhood distribution branch. Visual inspection tags are disabled. Use the handheld OPM probe and launch an OTDR laser trace from the Central Office to locate the exact break distance, replace the damaged span, and restore service.',
  presetId: 'standard-1x32',
  safetyMarginDb: DEFAULT_SAFETY_MARGIN_DB,
  blindFaultMode: true,
  prepareTopology: (topology) => ({
    ...topology,
    nodes: topology.nodes.map((node) => {
      if (node.type === 'fiber' && node.id === 'fiber-dist-a') {
        return {
          ...node,
          data: {
            ...node.data,
            macroBendActive: true,
            attenuationOverrideDbPerKm: 45,
          },
        };
      }
      if (node.type === 'fiber' && node.id === 'fiber-drop-a3') {
        return {
          ...node,
          data: {
            ...node.data,
            lengthKm: 0.8,
            splices: 1,
            connectors: 2,
          },
        };
      }
      return node;
    }),
  }),
  objectives: [
    {
      id: 'locate-remove-faulty-span',
      description: 'Locate and remove the faulty/severed fiber span.',
      isMet: (_simulation, nodes) => !nodes.some(isFaultyOrSeveredSpan),
    },
    {
      id: 'splice-healthy-distribution',
      description: 'Splice in a healthy replacement distribution span.',
      isMet: (_simulation, nodes, edges) =>
        nodes.some(
          (node) =>
            node.type === 'fiber' &&
            node.data.cableType === 'distribution' &&
            !isFaultyOrSeveredSpan(node) &&
            edges.some((edge) => edge.target === node.id) &&
            edges.some((edge) => edge.source === node.id),
        ),
    },
    {
      id: 'restore-subscribers-online',
      description: 'Restore all affected subscribers to ONLINE status (-8 to -24 dBm).',
      isMet: (simulation, nodes, edges) => {
        const onts = nodes.filter((node) => node.type === 'ont');
        return (
          onts.length === 3 &&
          onts.every((ont) => edges.some((edge) => edge.target === ont.id) && isOnline(simulation, ont.id))
        );
      },
    },
  ],
  fieldHints: [
    'Visual fault badges and patch-cord warning glyphs are hidden on the canvas in this mission.',
    'Open OTDR Trace in the TopBar, select a failing subscriber branch, and click Acquire Trace / Pulse Laser to inspect the backscatter curve.',
    'Notice where the trace drops to the -45 dB noise floor between 5.0 km and 6.0 km—right inside the 1.0 km neighborhood distribution span after the 1:4 splitter.',
    'Delete the severed distribution span, drag in a healthy replacement distribution cable span, and patch it between the 1:4 splitter (out-0) and the 1:8 splitter.',
  ],
};

export const MISSIONS: Mission[] = [
  marginalVillaAudit,
  silentOntAudit,
  unpatchedSubscriberAudit,
  budgetCrunchMission,
  blindFaultTrunkCutMission,
];

export function getMissionById(id: string): Mission | undefined {
  if (id === 'blind-fault-trunk-cut' || id === 'the-cut-in-the-trunk') {
    return blindFaultTrunkCutMission;
  }
  return MISSIONS.find((mission) => mission.id === id);
}

export function evaluateMissionObjectives(
  mission: Mission,
  simulation: NetworkSimulationResult,
  nodes: PonNode[],
  edges: PonEdge[],
  costBreakdown?: NetworkCostBreakdown,
): MissionObjectiveProgress[] {
  return mission.objectives.map((objective) => ({
    objective,
    isMet: objective.isMet(simulation, nodes, edges, costBreakdown),
  }));
}
