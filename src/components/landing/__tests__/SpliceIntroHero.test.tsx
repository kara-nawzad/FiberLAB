import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../types';
import { simulateTopology } from '../../../engine/opticalSimulator';
import { buildPreset } from '../../../engine/presets';
import { SpliceIntroHero } from '../SpliceIntroHero';

const standardSimulation = () => {
  const topology = buildPreset('standard-1x32');
  if (!topology) throw new Error('The standard reference topology is missing.');
  return simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);
};

const renderHero = (overrides: Partial<Parameters<typeof SpliceIntroHero>[0]> = {}) => {
  const onLaunchStudio = vi.fn();
  const onExploreMissions = vi.fn();
  render(
    <SpliceIntroHero
      simulation={standardSimulation()}
      simulationStale={false}
      onLaunchStudio={onLaunchStudio}
      onExploreMissions={onExploreMissions}
      {...overrides}
    />,
  );
  return { onLaunchStudio, onExploreMissions };
};

describe('SpliceIntroHero', () => {
  it('shows simulator-backed receive power and routes both calls to action', () => {
    const { onLaunchStudio, onExploreMissions } = renderHero();

    expect(screen.getByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    // The reference tree's weakest home is the 6 km Tanaro drop, not the first
    // ONLINE reading the telemetry map happens to hold.
    expect(screen.getByText('-24.30 dBm')).toBeInTheDocument();
    expect(screen.getByText('MARGINAL')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Launch Interactive Studio/i }));
    expect(onLaunchStudio).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: /Explore Guided Missions/i }));
    expect(onExploreMissions).toHaveBeenCalledOnce();
  });

  it('labels a reference-tree reading as a sample', () => {
    renderHero({ simulationIsReference: true });

    expect(screen.getByText('REFERENCE 1:32 TREE')).toBeInTheDocument();
    expect(screen.getByText(/Sample reading from the reference tree/i)).toBeInTheDocument();
  });

  it('reads a gateway-only network instead of falling back to the empty state', () => {
    const topology = buildPreset('modern-10g-xgs-pon-suburb');
    if (!topology) throw new Error('The XGS-PON reference topology is missing.');
    const simulation = simulateTopology(topology.nodes, topology.edges, DEFAULT_SETTINGS);

    renderHero({ simulation });

    // Three Wi-Fi gateways and no ONTs: the weakest home is still a real reading.
    expect(screen.getByText('-12.45 dBm')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
    expect(screen.queryByText('NO SIMULATED PATH')).not.toBeInTheDocument();
  });
});
