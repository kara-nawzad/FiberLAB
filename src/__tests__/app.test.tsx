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
  it('presents the living waveguide and routes the guided-mission CTA into the studio', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Explore Guided Missions \(4 Scenarios\)/i }));
    expect(await screen.findByRole('dialog', { name: 'Field missions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Marginal Villa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Diagnose the Silent ONT/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rescue the Unpatched Subscriber/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Budget Crunch: Cost vs. Performance/ })).toBeInTheDocument();
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
    expect(thumbnails).toHaveLength(8);
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
    const odfTool = screen.getByRole('button', { name: /ODF Rack Panel/i });
    const canvas = container.querySelector('.react-flow');
    expect(canvas).not.toBeNull();

    fireEvent.dragStart(odfTool, { dataTransfer });
    expect(JSON.parse(values.get('application/x-ftth-component') ?? 'null')).toEqual({ component: 'odf' });
    fireEvent.dragOver(canvas as Element, { dataTransfer, clientX: 980, clientY: 460 });
    fireEvent.drop(canvas as Element, { dataTransfer, clientX: 980, clientY: 460 });

    const hardwareCard = await screen.findByRole('region', { name: 'Field hardware reference' });
    expect(within(hardwareCard).getByText('2-pair ODF rack patch panel (reference)')).toBeInTheDocument();
  });

  it('quick-adds NAP and Wi-Fi gateway equipment from the toolbox into the hardware Inspector', async () => {
    await renderStudio();
    const napTool = screen.getByRole('button', { name: /Outdoor NAP \/ FAT/i });
    fireEvent.doubleClick(napTool);

    const hardwareCard = await screen.findByRole('region', { name: 'Field hardware reference' });
    expect(within(hardwareCard).getByText('Outdoor NAP/FAT 1:8 terminal (reference)')).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole('button', { name: /Wi-Fi 6 PON Gateway/i }));
    expect(await screen.findByText('Dual-band Wi-Fi 6 GPON / XGS-PON gateway (reference)')).toBeInTheDocument();
    expect((screen.getByRole('textbox', { name: 'Wi-Fi SSID' }) as HTMLInputElement).value).toMatch(/^FiberLAB-/);
  });

  it('adds an OSP dome closure and toggles color-coded tray splices in the Inspector', async () => {
    await renderStudio();
    fireEvent.doubleClick(screen.getByRole('button', { name: /Dome Splice Closure/i }));

    const closureTitle = await screen.findByText('Dome splice closure');
    const closureNode = closureTitle.closest('.react-flow__node');
    expect(closureNode).not.toBeNull();
    fireEvent.click(closureNode as HTMLElement);

    const tray = await screen.findByRole('region', { name: 'Interactive splice organizer tray' });
    expect(within(tray).getByText('Splice organizer · 12F')).toBeInTheDocument();
    expect(within(tray).getByText('Blue')).toBeInTheDocument();
    expect(within(tray).getByText('Aqua')).toBeInTheDocument();
    expect(screen.getAllByText(/48 single fusion splices/)).toHaveLength(2);

    const blueChannel = within(tray).getByRole('switch', { name: 'Channel 1 Blue splice' });
    expect(blueChannel).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(blueChannel);
    expect(blueChannel).toHaveAttribute('aria-checked', 'false');

    expect(closureNode?.querySelectorAll('.react-flow__handle[data-handleid^="in-"]')).toHaveLength(2);
    expect(closureNode?.querySelectorAll('.react-flow__handle[data-handleid^="out-"]')).toHaveLength(4);
  });

  it('uses the OPM HUD to probe a span at selectable simulated wavelengths and exits on Escape', async () => {
    await renderStudio();
    fireEvent.click(screen.getByRole('button', { name: 'OPM Tool' }));
    expect(screen.getByRole('button', { name: 'Close OPM' })).toHaveAttribute('aria-pressed', 'true');

    const feeder = screen.getByText('5.000 km span').closest('.react-flow__node');
    expect(feeder).not.toBeNull();
    const outputPort = feeder?.querySelector('.react-flow__handle[data-handleid="out"]');
    expect(outputPort).not.toBeNull();
    fireEvent.pointerMove(outputPort as HTMLElement, { clientX: 540, clientY: 300 });

    const meter = await screen.findByRole('region', { name: 'Optical Power Meter' });
    const reading = within(meter).getByLabelText('Optical power reading');
    expect(reading).toHaveTextContent('+0.75');
    fireEvent.click(within(meter).getByRole('button', { name: 'Use OPM wavelength 1310 nm' }));
    expect(reading).toHaveTextContent('+0.25');
    fireEvent.click(within(meter).getByRole('button', { name: 'Use OPM wavelength 1550 nm' }));
    expect(reading).toHaveTextContent('+1.00');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('opm-meter-hud')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OPM Tool' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies field fault switches and shows the explicit penalties in the ONT loss breakdown', async () => {
    await renderStudio();
    const feeder = screen.getByText('5.000 km span').closest('.react-flow__node');
    fireEvent.click(feeder as HTMLElement);

    const macroBend = screen.getByRole('switch', { name: 'Macro-bend fault (<15 mm)' });
    const dirtyFerrule = screen.getByRole('switch', { name: 'Dirty SC/APC ferrule' });
    fireEvent.click(macroBend);
    fireEvent.click(dirtyFerrule);
    expect(macroBend).toHaveAttribute('aria-checked', 'true');
    expect(dirtyFerrule).toHaveAttribute('aria-checked', 'true');

    const subscriber = screen.getByText('Al-Sulaymaniyah — Unit 12').closest('.react-flow__node');
    expect(subscriber).not.toBeNull();
    const subscriberShell = subscriber?.querySelector('.node-shell');
    expect(within(subscriberShell as HTMLElement).getByText('WARNING')).toBeInTheDocument();
    fireEvent.click(subscriber as HTMLElement);
    expect(await screen.findByText('Fault Penalty: Macro-Bend (-3.50 dB)')).toBeInTheDocument();
    expect(screen.getByText('Fault Penalty: Dust Contamination (-2.00 dB)')).toBeInTheDocument();
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
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('CAPEX$3,747');
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('$1,249.00 / Home Passed');
  });

  it('opens the Bill of Materials with reconciling totals', async () => {
    await renderStudio();
    await screen.findByText('Al-Sulaymaniyah — Unit 12');

    fireEvent.click(screen.getByRole('button', { name: /Bill of Materials/i }));

    expect(await screen.findByText('Optical audit & commercial CAPEX quotation')).toBeInTheDocument();
    // 5 + 1 + 0.3 + 1.2 + 6 km of plant on the canvas.
    expect(screen.getByText('13.50')).toBeInTheDocument();
    // Two wired-optimal + one marginal = 3 online, 0 offline.
    expect(screen.getByText('ONTs provisioned')).toBeInTheDocument();
    expect(screen.queryByText('Dukan Ridge — Tower 7')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close bill of materials' }));
    expect(screen.queryByText('Optical audit & commercial CAPEX quotation')).not.toBeInTheDocument();
  });

  it('edits local USD pricing in the Inspector without changing optical status', async () => {
    await renderStudio();
    const capexBadge = screen.getByTestId('capex-telemetry');
    expect(capexBadge).toHaveTextContent('$3,747');

    fireEvent.click(screen.getByText('Local unit pricing'));
    const feederRate = screen.getByRole('spinbutton', { name: 'Feeder / OSP cable' });
    expect(feederRate).toHaveValue(350);
    fireEvent.change(feederRate, { target: { value: '500' } });

    expect(capexBadge).toHaveTextContent('$4,497');
    expect(capexBadge).toHaveTextContent('$1,499.00 / Home Passed');
    expect(screen.getByText('Marginal links detected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore reference pricing' }));
    expect(capexBadge).toHaveTextContent('$3,747');
  });

  it('shows a commercial quotation tab with reconciling material and labor totals', async () => {
    await renderStudio();
    fireEvent.click(screen.getByRole('button', { name: /Bill of Materials/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Commercial Quotation & CAPEX' }));

    expect(await screen.findByRole('region', { name: 'Commercial quotation and CAPEX' })).toBeInTheDocument();
    expect(screen.getByText('Total Materials Cost')).toBeInTheDocument();
    expect(screen.getByText('$3,574.00')).toBeInTheDocument();
    expect(screen.getByText('Total Labor & Splicing Cost')).toBeInTheDocument();
    expect(screen.getByText('$173.00')).toBeInTheDocument();
    expect(screen.getByText('Total Project CAPEX')).toBeInTheDocument();
    expect(screen.getAllByText('$3,747.00').length).toBeGreaterThan(0);
    const quotationTable = within(screen.getByTestId('quotation-line-items'));
    expect(quotationTable.getByText('Feeder / OSP cable')).toBeInTheDocument();
    expect(quotationTable.getByText('Fusion splice labor')).toBeInTheDocument();
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

  it('tracks the Budget Crunch mission against the live CAPEX estimate', async () => {
    await renderStudio();
    fireEvent.click(screen.getByRole('button', { name: /^Missions$/i }));
    await screen.findByRole('dialog', { name: 'Field missions' });
    fireEvent.click(screen.getByRole('button', { name: /The Budget Crunch: Cost vs. Performance/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByText('1/3 complete')).toBeInTheDocument();
    expect(screen.getByText(/Keep the total reference CAPEX below \$1,600\.00/)).toBeInTheDocument();
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('$3,747');
  });

  it('acquires an interactive OTDR trace from the TopBar and lists terminal Fresnel events', async () => {
    await renderStudio();
    fireEvent.click(screen.getByRole('button', { name: 'OTDR Trace' }));
    expect(screen.getByRole('dialog', { name: 'OTDR Trace Analyzer' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'OTDR source node' })).toHaveValue('olt-a');
    expect(screen.getByRole('combobox', { name: 'OTDR target subscriber' })).toHaveValue('ont-a1');

    fireEvent.click(screen.getByRole('button', { name: /ACQUIRE TRACE \/ PULSE LASER/ }));
    expect(screen.getByRole('button', { name: /PULSING FIBER/ })).toBeDisabled();
    const eventTable = screen.getByRole('table', { name: 'OTDR detected events' });
    await waitFor(() => expect(within(eventTable).getByText('End of fiber')).toBeInTheDocument(), { timeout: 2000 });
    expect(within(eventTable).getByText('+4.00 dB')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /OTDR backscatter trace/ })).toBeInTheDocument();
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

  it('selects the modern XGS-PON suburb preset and exposes live gateway service and hardware details', async () => {
    await renderStudio();
    fireEvent.click(screen.getByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /MODERN 10G XGS-PON SUBURB/i }));

    const homeLabel = await screen.findByText('Modern Suburb — Home 1');
    const gatewayNode = homeLabel.closest('.react-flow__node');
    expect(gatewayNode).not.toBeNull();
    expect(within(gatewayNode as HTMLElement).getAllByText('XGS-PON')).toHaveLength(2);
    expect(within(gatewayNode as HTMLElement).getByText('XGS-PON 10G ACTIVE')).toBeInTheDocument();
    expect(within(gatewayNode as HTMLElement).getByText('192.0.2.101')).toBeInTheDocument();
    expect(within(gatewayNode as HTMLElement).getByText('↓ 1.24 Gbps · ↑ 1.24 Gbps')).toBeInTheDocument();
    expect(within(gatewayNode as HTMLElement).getByText(/modeled XGS-PON receive-power window/)).toBeInTheDocument();

    fireEvent.click(gatewayNode as HTMLElement);
    expect(await screen.findByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
    expect(screen.getByText('Dual-band Wi-Fi 6 GPON / XGS-PON gateway (reference)')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Wi-Fi SSID' })).toHaveValue('FiberLAB-XGS-01');
    expect(screen.getByText('1244 / 1244 Mbps')).toBeInTheDocument();
    expect(screen.getByText('Internet IP (simulated)')).toBeInTheDocument();
    expect(screen.getByText(/TEST-NET placeholder only/)).toBeInTheDocument();
    expect(screen.getByText(/A radio link rate or shared PON line-rate share is not a measured/)).toBeInTheDocument();
  });

  it('switches an OLT between GPON and XGS-PON and updates the wavelength-dependent budget', async () => {
    await renderStudio();
    const oltLabel = await screen.findByText('PON 0/1/0');
    fireEvent.click(oltLabel.closest('.react-flow__node') as HTMLElement);

    const standard = screen.getByRole('combobox', { name: 'PON standard' });
    expect(standard).toHaveValue('GPON');
    fireEvent.change(standard, { target: { value: 'XGS-PON' } });
    expect(standard).toHaveValue('XGS-PON');
    expect(screen.getByText(/0\.22 dB\/km/)).toBeInTheDocument();

    const subscriber = screen.getByText('Al-Sulaymaniyah — Unit 12');
    fireEvent.click(subscriber.closest('.react-flow__node') as HTMLElement);
    expect(await screen.findByText(/Feeder cable — 5 km @ 0\.22 dB\/km @ 1577 nm/)).toBeInTheDocument();
  });
});
