import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type PonEdge } from '../../types';
import { buildPreset } from '../presets';
import { decorateEdges } from '../edgeDecoration';
import { createFiberNode } from '../factories';
import { generateOtdrTrace } from '../otdrSimulator';
import { simulateTopology } from '../opticalSimulator';
import { evaluateMissionObjectives, getMissionById } from '../missions';
import { calculateNetworkCost } from '../../data/pricingCatalogue';

describe('guided troubleshooting missions', () => {
  it('loads the villa audit with its warning checkpoint and protected settings', () => {
    const mission = getMissionById('marginal-villa');
    const topology = buildPreset(mission?.presetId ?? 'standard-1x32');
    expect(mission).toBeDefined();
    expect(topology).not.toBeNull();
    if (!mission || !topology) return;

    const simulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
    const progress = evaluateMissionObjectives(mission, simulation, topology.nodes, topology.edges);
    expect(progress.map((item) => item.isMet)).toEqual([false, true, true]);
    expect(simulation.ontTelemetry['ont-a3'].rxPowerDbm).toBeCloseTo(-24.3, 1);
  });

  it('completes the villa audit after correcting the long drop without changing constraints', () => {
    const mission = getMissionById('marginal-villa');
    const topology = buildPreset('standard-1x32');
    expect(mission).toBeDefined();
    expect(topology).not.toBeNull();
    if (!mission || !topology) return;

    const nodes = topology.nodes.map((node) =>
      node.type === 'fiber' && node.id === 'fiber-drop-a3' ? { ...node, data: { ...node.data, lengthKm: 4 } } : node,
    );
    const simulation = simulateTopology(nodes, topology.edges, DEFAULT_SETTINGS);
    const progress = evaluateMissionObjectives(mission, simulation, nodes, topology.edges);
    expect(progress.every((item) => item.isMet)).toBe(true);
  });

  it('guides a learner to patch and recover the disconnected long-haul subscriber', () => {
    const mission = getMissionById('rescue-unpatched-subscriber');
    const preset = buildPreset(mission?.presetId ?? 'failing-long-haul');
    expect(mission).toBeDefined();
    expect(preset).not.toBeNull();
    if (!mission || !preset) return;

    const initialSimulation = simulateTopology(preset.nodes, preset.edges, DEFAULT_SETTINGS);
    expect(
      evaluateMissionObjectives(mission, initialSimulation, preset.nodes, preset.edges).map((item) => item.isMet),
    ).toEqual([false, false, false]);

    const patchEdges: PonEdge[] = [
      {
        id: 'mission-b3-splitter-drop',
        source: 'splitter-1x16-b',
        sourceHandle: 'out-2',
        target: 'fiber-drop-b3',
        targetHandle: 'in',
        type: 'optical',
      },
      {
        id: 'mission-b3-drop-ont',
        source: 'fiber-drop-b3',
        sourceHandle: 'out',
        target: 'ont-b3',
        targetHandle: 'in',
        type: 'optical',
      },
    ];
    const connectedEdges = [...preset.edges, ...patchEdges];
    const connectedSimulation = simulateTopology(preset.nodes, connectedEdges, DEFAULT_SETTINGS);
    expect(
      evaluateMissionObjectives(mission, connectedSimulation, preset.nodes, connectedEdges).map((item) => item.isMet),
    ).toEqual([true, true, false]);

    const lowerSplitNodes = preset.nodes.map((node) =>
      node.type === 'splitter' && ['splitter-1x32-b', 'splitter-1x16-b'].includes(node.id)
        ? { ...node, data: { ...node.data, ratio: 4 as const } }
        : node,
    );
    const recoveredSimulation = simulateTopology(lowerSplitNodes, connectedEdges, DEFAULT_SETTINGS);
    expect(
      evaluateMissionObjectives(mission, recoveredSimulation, lowerSplitNodes, connectedEdges).every(
        (item) => item.isMet,
      ),
    ).toBe(true);
  });

  it('starts the silent ONT audit with a dark OLT, then advances when the laser is restored', () => {
    const mission = getMissionById('silent-ont');
    const preset = buildPreset(mission?.presetId ?? 'failing-long-haul');
    expect(mission).toBeDefined();
    expect(preset).not.toBeNull();
    if (!mission || !preset) return;

    const topology = mission.prepareTopology?.(preset) ?? preset;
    const darkSimulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
    expect(
      evaluateMissionObjectives(mission, darkSimulation, topology.nodes, topology.edges).map((item) => item.isMet),
    ).toEqual([false, false, false]);

    const litNodes = topology.nodes.map((node) =>
      node.type === 'olt' ? { ...node, data: { ...node.data, laserOn: true } } : node,
    );
    const litSimulation = simulateTopology(litNodes, topology.edges, DEFAULT_SETTINGS);
    expect(
      evaluateMissionObjectives(mission, litSimulation, litNodes, topology.edges).map((item) => item.isMet),
    ).toEqual([true, true, false]);
  });

  it('balances online receive power with the $1,600 CAPEX ceiling in Budget Crunch', () => {
    const mission = getMissionById('budget-crunch');
    const topology = buildPreset(mission?.presetId ?? 'standard-1x32');
    expect(mission?.title).toBe('The Budget Crunch: Cost vs. Performance');
    expect(topology).not.toBeNull();
    if (!mission || !topology) return;

    const initialSimulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
    const initialCost = calculateNetworkCost(topology.nodes, topology.edges);
    expect(initialCost.totalCapex).toBe(3747);
    expect(
      evaluateMissionObjectives(mission, initialSimulation, topology.nodes, topology.edges, initialCost).map(
        (item) => item.isMet,
      ),
    ).toEqual([false, false, true]);

    const optimizedNodes = topology.nodes.map((node) => {
      if (node.type !== 'fiber') return node;
      if (node.id === 'fiber-feeder-a') return { ...node, data: { ...node.data, lengthKm: 0.5 } };
      if (node.id === 'fiber-dist-a') return { ...node, data: { ...node.data, lengthKm: 0.5 } };
      if (node.id === 'fiber-drop-a3') return { ...node, data: { ...node.data, lengthKm: 1.5 } };
      return node;
    });
    const optimizedSimulation = simulateTopology(optimizedNodes, topology.edges, DEFAULT_SETTINGS);
    const optimizedCost = calculateNetworkCost(optimizedNodes, topology.edges);
    expect(optimizedCost.totalCapex).toBe(1372);
    expect(
      evaluateMissionObjectives(mission, optimizedSimulation, optimizedNodes, topology.edges, optimizedCost).every(
        (item) => item.isMet,
      ),
    ).toBe(true);

    const localMarketQuote = calculateNetworkCost(optimizedNodes, topology.edges, {
      cablePerKm: { feeder: 1200 },
    });
    expect(
      evaluateMissionObjectives(mission, optimizedSimulation, optimizedNodes, topology.edges, localMarketQuote)[1]
        .isMet,
    ).toBe(false);
  });

  it('runs the Blind Fault mission with hidden visual fault tags, OTDR break detection, and span replacement', () => {
    const mission = getMissionById('blind-fault');
    const preset = buildPreset(mission?.presetId ?? 'standard-1x32');
    expect(mission).toBeDefined();
    expect(mission?.title).toBe('Blind Fault: The Cut in the Trunk');
    expect(mission?.blindFaultMode).toBe(true);
    expect(preset).not.toBeNull();
    if (!mission || !preset) return;

    const topology = mission.prepareTopology?.(preset) ?? preset;
    const initialSimulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);

    // All three neighborhood subscribers start in outage (LOS)
    expect(initialSimulation.summary.byStatus.LOS).toBe(3);
    expect(
      evaluateMissionObjectives(mission, initialSimulation, topology.nodes, topology.edges).map((item) => item.isMet),
    ).toEqual([false, false, false]);

    // Visual fault tags are hidden on edges in blindFaultMode
    const decorated = decorateEdges(topology.edges, initialSimulation.edgeTelemetry, topology.nodes, {
      hideFaults: Boolean(mission.blindFaultMode),
    });
    expect(decorated.every((edge) => (edge.data?.faultLabels ?? []).length === 0)).toBe(true);

    // OTDR trace identifies the break dropping to the -45 dB noise floor in the distribution span
    const trace = generateOtdrTrace(topology.nodes, topology.edges, 'olt-a', 'ont-a1', 1490, 100);
    expect(trace.events.some((event) => event.type === 'fault_bend' && event.passFail === 'FAIL')).toBe(true);
    expect(trace.tracePoints.some((point) => point.distanceKm <= 6.0 && point.powerDb === -45)).toBe(true);

    // Step 1: Remove the severed distribution span
    const nodesAfterRemoval = topology.nodes.filter((node) => node.id !== 'fiber-dist-a');
    const edgesAfterRemoval = topology.edges.filter(
      (edge) => edge.source !== 'fiber-dist-a' && edge.target !== 'fiber-dist-a',
    );
    const removedSimulation = simulateTopology(nodesAfterRemoval, edgesAfterRemoval, DEFAULT_SETTINGS);
    expect(
      evaluateMissionObjectives(mission, removedSimulation, nodesAfterRemoval, edgesAfterRemoval).map(
        (item) => item.isMet,
      ),
    ).toEqual([true, false, false]);

    // Step 2 & 3: Splice in a healthy replacement distribution span and restore all subscribers to ONLINE
    const replacementDist = createFiberNode('distribution', { id: 'fiber-dist-replacement' });
    const repairedNodes = [...nodesAfterRemoval, replacementDist];
    const repairedEdges: PonEdge[] = [
      ...edgesAfterRemoval,
      {
        id: 'e-repair-in',
        source: 'splitter-1x4-a',
        sourceHandle: 'out-0',
        target: replacementDist.id,
        targetHandle: 'in',
        type: 'optical',
      },
      {
        id: 'e-repair-out',
        source: replacementDist.id,
        sourceHandle: 'out',
        target: 'splitter-1x8-a',
        targetHandle: 'in',
        type: 'optical',
      },
    ];
    const repairedSimulation = simulateTopology(repairedNodes, repairedEdges, DEFAULT_SETTINGS);
    expect(repairedSimulation.summary.byStatus.ONLINE).toBe(3);
    expect(
      evaluateMissionObjectives(mission, repairedSimulation, repairedNodes, repairedEdges).every((item) => item.isMet),
    ).toBe(true);
  });
});
