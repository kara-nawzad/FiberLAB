import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type PonEdge } from '../../types';
import { buildPreset } from '../presets';
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
      node.type === 'fiber' && node.id === 'fiber-drop-a3'
        ? { ...node, data: { ...node.data, lengthKm: 4 } }
        : node,
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
    expect(evaluateMissionObjectives(mission, initialSimulation, preset.nodes, preset.edges).map((item) => item.isMet))
      .toEqual([false, false, false]);

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
    expect(evaluateMissionObjectives(mission, connectedSimulation, preset.nodes, connectedEdges).map((item) => item.isMet))
      .toEqual([true, true, false]);

    const lowerSplitNodes = preset.nodes.map((node) =>
      node.type === 'splitter' && ['splitter-1x32-b', 'splitter-1x16-b'].includes(node.id)
        ? { ...node, data: { ...node.data, ratio: 4 as const } }
        : node,
    );
    const recoveredSimulation = simulateTopology(lowerSplitNodes, connectedEdges, DEFAULT_SETTINGS);
    expect(evaluateMissionObjectives(mission, recoveredSimulation, lowerSplitNodes, connectedEdges).every((item) => item.isMet))
      .toBe(true);
  });

  it('starts the silent ONT audit with a dark OLT, then advances when the laser is restored', () => {
    const mission = getMissionById('silent-ont');
    const preset = buildPreset(mission?.presetId ?? 'failing-long-haul');
    expect(mission).toBeDefined();
    expect(preset).not.toBeNull();
    if (!mission || !preset) return;

    const topology = mission.prepareTopology?.(preset) ?? preset;
    const darkSimulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
    expect(evaluateMissionObjectives(mission, darkSimulation, topology.nodes, topology.edges).map((item) => item.isMet)).toEqual([
      false,
      false,
      false,
    ]);

    const litNodes = topology.nodes.map((node) =>
      node.type === 'olt' ? { ...node, data: { ...node.data, laserOn: true } } : node,
    );
    const litSimulation = simulateTopology(litNodes, topology.edges, DEFAULT_SETTINGS);
    expect(evaluateMissionObjectives(mission, litSimulation, litNodes, topology.edges).map((item) => item.isMet)).toEqual([
      true,
      true,
      false,
    ]);
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
    expect(evaluateMissionObjectives(mission, initialSimulation, topology.nodes, topology.edges, initialCost).map((item) => item.isMet))
      .toEqual([false, false, true]);

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
    expect(evaluateMissionObjectives(mission, optimizedSimulation, optimizedNodes, topology.edges, optimizedCost).every((item) => item.isMet))
      .toBe(true);

    const localMarketQuote = calculateNetworkCost(optimizedNodes, topology.edges, {
      cablePerKm: { feeder: 1200 },
    });
    expect(evaluateMissionObjectives(mission, optimizedSimulation, optimizedNodes, topology.edges, localMarketQuote)[1].isMet)
      .toBe(false);
  });
});
