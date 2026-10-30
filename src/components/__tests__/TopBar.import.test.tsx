import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { TopBar } from '../TopBar';

/**
 * Regression: the hidden import input used to live *inside* the More popover.
 * Picking "Import topology" closes that popover, React unmounted the input
 * before the operating system handed the chosen file back, and the change
 * event landed on a detached node — so the dialog opened, the reader pressed
 * Open, and absolutely nothing happened. The input must survive the menu
 * closing so its handler is still attached when the file arrives.
 */
describe('TopBar topology import', () => {
  const renderTopBar = (
    onImportTopology: (text: string, fileName?: string) => { ok: boolean; error?: string } = vi.fn(() => ({
      ok: true,
    })),
  ) => {
    render(
      <ReactFlowProvider>
        <TopBar
          projectName="Test network"
          stale={false}
          testing={false}
          onRunTest={() => {}}
          onOpenOverview={() => {}}
          onOpenSettings={() => {}}
          onImportTopology={onImportTopology}
        />
      </ReactFlowProvider>,
    );
    return onImportTopology;
  };

  it('keeps the file input mounted after the More menu closes', () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('button', { name: /Import topology/ }));

    // The popover closes as the action runs; the input must not go with it.
    expect(screen.getByLabelText('Import topology file')).toBeInTheDocument();
  });

  it('reads the chosen file even though the menu unmounted', async () => {
    const onImportTopology = vi.fn((_text: string, _fileName?: string) => ({ ok: true }));
    renderTopBar(onImportTopology);

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('button', { name: /Import topology/ }));

    const input = screen.getByLabelText('Import topology file') as HTMLInputElement;
    const file = new File(['{"format":"ftth-studio/topology","version":2}'], 'design.json', {
      type: 'application/json',
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onImportTopology).toHaveBeenCalledTimes(1));
    expect(onImportTopology.mock.calls[0][0]).toContain('ftth-studio/topology');
  });
});
