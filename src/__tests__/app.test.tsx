import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';

async function renderStudio() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Launch Interactive Studio/i }));
  await screen.findByRole('button', { name: 'Bill of Materials' });
}

/**
 * End-to-end smoke test of the studio shell: it mounts the whole app, proves the
 * preset topology renders onto the canvas, proves the simulator's telemetry
 * reaches the ONT node, and proves the BOM modal reports the same plant.
 */
describe('FiberLAB application shell', () => {
  it('presents the living waveguide and routes the three-mission CTA into the studio', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Shoot the laser\. Split the spectrum/i })).toBeInTheDocument();
    expect(await screen.findByText('-21.57 dBm')).toBeInTheDocument();
    const launchSlider = screen.getByLabelText(/Optical Launch Power/i);
    expect(launchSlider).toHaveValue('5');
    fireEvent.change(launchSlider, { target: { value: '6.4' } });
    expect(launchSlider).toHaveValue('6.4');

    const upstreamChip = screen.getByRole('button', {
      name: /1310 nm \(Upstream - 0\.35 dB\/km\)/i,
    });
    fireEvent.click(upstreamChip);
    expect(upstreamChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /1490 nm \(Downstream - 0\.25 dB\/km\)/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: /Explore Guided Missions \(3 Scenarios\)/i }));
    expect(await screen.findByRole('dialog', { name: 'Field missions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Marginal Villa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Diagnose the Silent ONT/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rescue the Unpatched Subscriber/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Field missions' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: /Rescue the Unpatched Subscriber/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));
    expect(await screen.findByText('0/3 complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Missions, active: Rescue the Unpatched Subscriber' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Field missions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview & Physics' })).toHaveFocus();
  });

  it('quick-loads a preset and preserves the mounted studio state across the overview toggle', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Failing Link' }));
    expect(await screen.findByText('Dukan Ridge — Tower 7')).toBeInTheDocument();

    const ontLabel = screen.getByText('Dukan Ridge — Tower 7');
    fireEvent.click(ontLabel.closest('.react-flow__node') as HTMLElement);
    expect(await screen.findByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Overview & Physics' }));
    expect(await screen.findByRole('heading', { name: /Shoot the laser\. Split the spectrum/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Launch Interactive Studio/i }));
    expect(await screen.findByText('Dukan Ridge — Tower 7')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
  });

  it('boots with the standard 1:32 tree and renders every element', async () => {
    await renderStudio();

    expect(await screen.findByText(/FTTH/)).toBeInTheDocument();
    expect(screen.getByText('PON 0/1/0')).toBeInTheDocument();
    expect(screen.getByText('1:4 PLC Splitter')).toBeInTheDocument();
    expect(screen.getByText('1:8 PLC Splitter')).toBeInTheDocument();
    expect(screen.getByText('Al-Sulaymaniyah — Unit 12')).toBeInTheDocument();
    expect(screen.getByText('Al-Sulaymaniyah — Unit 14')).toBeInTheDocument();
    expect(screen.getByText('Tanaro Village — Remote')).toBeInTheDocument();
    const toolbox = screen.getByText('Component Toolbox').closest('aside');
    expect(toolbox).not.toBeNull();
    const thumbnails = within(toolbox as HTMLElement).getAllByRole('img');
    expect(thumbnails).toHaveLength(4);
    thumbnails.forEach((thumbnail) => {
      expect(thumbnail).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
      expect(thumbnail.parentElement).toHaveClass('h-10', 'w-10');
    });
  });

  it('drags a toolbox component onto the React Flow canvas', async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Studio' }));
    await screen.findByText('Al-Sulaymaniyah — Unit 12');

    const values = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, value: string) => values.set(type, value),
      getData: (type: string) => values.get(type) ?? '',
    } as unknown as DataTransfer;
    const oltTool = screen.getByRole('button', { name: /OLT Transceiver/i });
    const canvas = container.querySelector('.react-flow');
    expect(canvas).not.toBeNull();

    fireEvent.dragStart(oltTool, { dataTransfer });
    expect(JSON.parse(values.get('application/x-ftth-component') ?? 'null')).toEqual({ component: 'olt' });
    fireEvent.dragOver(canvas as Element, { dataTransfer, clientX: 980, clientY: 460 });
    fireEvent.drop(canvas as Element, { dataTransfer, clientX: 980, clientY: 460 });

    expect(await screen.findAllByText('PON 0/1/0')).toHaveLength(2);
  });

  it('connects and disconnects node pairs in Link nodes mode and deletes a selected span', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Studio' }));
    await screen.findByText('Al-Sulaymaniyah — Unit 12');

    expect(screen.getByText('Marginal links detected')).toBeInTheDocument();

    const oltNode = screen.getByText('PON 0/1/0').closest('.react-flow__node');
    const feederNode = screen.getByText('5.000 km span').closest('.react-flow__node');
    expect(oltNode).not.toBeNull();
    expect(feederNode).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    expect(screen.getByRole('status')).toHaveTextContent('Select a source node');
    fireEvent.click(oltNode as HTMLElement);
    expect(screen.getByRole('status')).toHaveTextContent('Source: olt-a');
    fireEvent.click(feederNode as HTMLElement);
    await waitFor(() => expect(screen.getByText('Fault on the network')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(oltNode as HTMLElement);
    fireEvent.click(feederNode as HTMLElement);
    await waitFor(() => expect(screen.getByText('Marginal links detected')).toBeInTheDocument());

    fireEvent.click(feederNode as HTMLElement);
    const deleteButton = screen.getByRole('button', { name: 'Delete selected elements' });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    fireEvent.click(deleteButton);
    await waitFor(() => expect(screen.queryByText('5.000 km span')).not.toBeInTheDocument());
  });

  it('pushes live optical telemetry into the ONT node', async () => {
    await renderStudio();

    const ont = (await screen.findByText('Al-Sulaymaniyah — Unit 12')).closest('.node-shell');
    expect(ont).not.toBeNull();
    expect(within(ont as HTMLElement).getByText('-21.57')).toBeInTheDocument();
    expect(within(ont as HTMLElement).getByText('ONLINE')).toBeInTheDocument();

    // The 6 km drop sits just past the −24 dBm optimal floor.
    const remote = screen.getByText('Tanaro Village — Remote').closest('.node-shell');
    expect(within(remote as HTMLElement).getByText('WARNING')).toBeInTheDocument();
  });

  it('reports the deployed plant in the top bar health strip', async () => {
    await renderStudio();
    await screen.findByText('Al-Sulaymaniyah — Unit 12');

    expect(screen.getByText('Marginal links detected')).toBeInTheDocument();
    expect(screen.getByText('13.50 km')).toBeInTheDocument();
  });

  it('opens the Bill of Materials with reconciling totals', async () => {
    await renderStudio();
    await screen.findByText('Al-Sulaymaniyah — Unit 12');

    fireEvent.click(screen.getByRole('button', { name: /Bill of Materials/i }));

    expect(await screen.findByText('Deployment summary & per-subscriber optical budget')).toBeInTheDocument();
    // 5 + 1 + 0.3 + 1.2 + 6 km of plant on the canvas.
    expect(screen.getByText('13.50')).toBeInTheDocument();
    // Two wired-optimal + one marginal = 3 online, 0 offline.
    expect(screen.getByText('ONTs provisioned')).toBeInTheDocument();
    expect(screen.queryByText('Dukan Ridge — Tower 7')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close bill of materials' }));
    expect(screen.queryByText('Deployment summary & per-subscriber optical budget')).not.toBeInTheDocument();
  });

  it('opens the inspector for a selected ONT with its full link budget', async () => {
    await renderStudio();
    const label = await screen.findByText('Al-Sulaymaniyah — Unit 12');

    const wrapper = label.closest('.react-flow__node');
    expect(wrapper).not.toBeNull();
    fireEvent.click(wrapper as HTMLElement);

    expect(await screen.findByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
    expect(screen.getByText('Desktop GPON ONU / ONT (reference)')).toBeInTheDocument();
    expect(screen.getByText('Ports & interfaces')).toBeInTheDocument();
    expect(screen.getByText(/do not mate an APC connector with a UPC connector/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /representative hardware and port-layout illustration/ })).toHaveAttribute(
      'src',
      expect.stringContaining('data:image/svg+xml'),
    );
    expect(await screen.findByText('Link budget breakdown')).toBeInTheDocument();
    expect(screen.getByText('P_rx = P_tx − ΣL − margin')).toBeInTheDocument();
    expect(screen.getByText(/System safety margin/)).toBeInTheDocument();
    expect(screen.getByText('ONT serial number')).toBeInTheDocument();
  });

  it('clears the canvas and shows the empty-state hint', async () => {
    await renderStudio();
    await screen.findByText('Al-Sulaymaniyah — Unit 12');

    fireEvent.click(screen.getByRole('button', { name: /Clear Canvas/i }));

    expect(screen.queryByText('Al-Sulaymaniyah — Unit 12')).not.toBeInTheDocument();
    expect(await screen.findByText('The canvas is empty')).toBeInTheDocument();
  });

  it('opens a field mission, loads its scenario, and tracks objectives live', async () => {
    await renderStudio();

    const missionsButton = screen.getByRole('button', { name: /^Missions$/i });
    missionsButton.focus();
    fireEvent.click(missionsButton);
    expect(await screen.findByRole('dialog', { name: 'Field missions' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByText('2/3 complete')).toBeInTheDocument();
    expect(screen.getByText(/Bring all three connected ONTs into the ONLINE window/)).toBeInTheDocument();
    expect(screen.getByText('Mission active')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Mission objective progress' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Field missions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Missions, active: The Marginal Villa' })).toHaveFocus();
  });

  it('loads the failing long-haul preset and turns the health strip red', async () => {
    await renderStudio();
    await screen.findByText('Al-Sulaymaniyah — Unit 12');

    fireEvent.click(screen.getByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Failing Long-Distance Link/ }));

    expect(await screen.findByText('Dukan Ridge — Tower 7')).toBeInTheDocument();
    expect(await screen.findByText('Fault on the network')).toBeInTheDocument();

    const ont = screen.getByText('Dukan Ridge — Tower 7').closest('.node-shell');
    expect(within(ont as HTMLElement).getByText('LOS')).toBeInTheDocument();
    expect(within(ont as HTMLElement).getByText('-39.47')).toBeInTheDocument();
  });
});
