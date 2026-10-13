import type { PonEdge, PonNode, SimulationResult } from '../types';
import { DEFAULT_SAFETY_MARGIN_DB } from '../types';

/** Domain-friendly alias used by mission validators and the drawer. */
export type NetworkSimulationResult = SimulationResult;

export type MissionDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface MissionObjective {
  id: string;
  description: string;
  isMet: (simulation: NetworkSimulationResult, nodes: PonNode[], edges: PonEdge[]) => boolean;
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
          onts.every(
            (ont) =>
              edges.some((edge) => edge.target === ont.id) &&
              isOnline(simulation, ont.id),
          )
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
      node.type === 'olt' && node.id === 'olt-b'
        ? { ...node, data: { ...node.data, laserOn: false } }
        : node,
    ),
  }),
  objectives: [
    {
      id: 'source-laser',
      description: 'Confirm at least one OLT laser is enabled.',
      isMet: (_simulation, nodes) =>
        nodes.some((node) => node.type === 'olt' && node.data.laserOn),
    },
    {
      id: 'restore-path',
      description: 'Restore an OLT-to-ONT optical path to Dukan Ridge — Tower 7.',
      isMet: (simulation, nodes, edges) => {
        const target = nodes.find(
          (node) => node.type === 'ont' && node.id === 'ont-b1',
        );
        if (!target) return false;
        const reading = simulation.ontTelemetry[target.id];
        return Boolean(
          reading?.sourceOltId &&
            reading.rxPowerDbm !== null &&
            edges.some((edge) => edge.target === target.id),
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
            edge.source === 'splitter-1x16-b' &&
            edge.sourceHandle === 'out-2' &&
            edge.target === 'fiber-drop-b3',
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
    'Verify the final receive reading is inside the −24 to −8 dBm ONLINE window; the simulator does not model dirty-end-face or macro-bend penalties separately.',
  ],
};

export const MISSIONS: Mission[] = [marginalVillaAudit, silentOntAudit, unpatchedSubscriberAudit];

export function getMissionById(id: string): Mission | undefined {
  return MISSIONS.find((mission) => mission.id === id);
}

export function evaluateMissionObjectives(
  mission: Mission,
  simulation: NetworkSimulationResult,
  nodes: PonNode[],
  edges: PonEdge[],
): MissionObjectiveProgress[] {
  return mission.objectives.map((objective) => ({
    objective,
    isMet: objective.isMet(simulation, nodes, edges),
  }));
}
