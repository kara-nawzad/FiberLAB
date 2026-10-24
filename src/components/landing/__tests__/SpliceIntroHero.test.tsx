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
    expect(screen.getByText('-21.57 dBm')).toBeInTheDocument();
    expect(screen.getByText('ONLINE')).toBeInTheDocument();

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
});
