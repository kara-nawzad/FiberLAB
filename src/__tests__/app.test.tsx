import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';

async function renderStudio() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Launch Interactive Studio/i }));
  await screen.findByRole('button', { name: 'Bill of Materials' });
}

function openMoreTools() {
  fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
}

function getCanvasNodeByText(text: string | RegExp): HTMLElement {
  const matches = screen.getAllByText(text);
  for (const match of matches) {
    const node = match.closest('.react-flow__node');
    if (node) return node as HTMLElement;
  }
  throw new Error(`No .react-flow__node found containing text ${String(text)}`);
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

    fireEvent.click(screen.getByRole('button', { name: /Explore Guided Missions \(5 Scenarios\)/i }));
    expect(await screen.findByRole('dialog', { name: 'Field missions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Marginal Villa/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Diagnose the Silent ONT/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rescue the Unpatched Subscriber/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /The Budget Crunch: Cost vs. Performance/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Field missions' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: /Rescue the Unpatched Subscriber/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));
    expect(await screen.findByText('0/3 complete')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Field missions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview & Physics' })).toHaveFocus();

    openMoreTools();
    expect(
      screen.getByRole('button', { name: 'Missions, active: Rescue the Unpatched Subscriber' }),
    ).toBeInTheDocument();
  });

  it('quick-loads a preset and preserves the mounted studio state across the overview toggle', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Failing Link' }));
    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));

    const ontNode = getCanvasNodeByText('Dukan Ridge — Tower 7');
    fireEvent.click(ontNode);
    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(await screen.findByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Overview & Physics' }));
    expect(await screen.findByRole('heading', { name: /Shoot the laser\. Split the spectrum/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Launch Interactive Studio/i }));
    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));
    expect(screen.getByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
  });

  it('boots with the standard 1:32 tree and renders every element', async () => {
    await renderStudio();

    expect((await screen.findAllByText('Standard 1:32 GPON Tree')).length).toBeGreaterThan(0);
    expect(getCanvasNodeByText('OLT')).toBeInTheDocument();
    expect(getCanvasNodeByText('PLC Splitter 1:4')).toBeInTheDocument();
    expect(getCanvasNodeByText('PLC Splitter 1:8')).toBeInTheDocument();
    expect(getCanvasNodeByText('Al-Sulaymaniyah — Unit 12')).toBeInTheDocument();
    expect(getCanvasNodeByText('Al-Sulaymaniyah — Unit 14')).toBeInTheDocument();
    expect(getCanvasNodeByText('Tanaro Village — Remote')).toBeInTheDocument();
    const toolbox = screen.getByLabelText('Search components').closest('aside');
    expect(toolbox).not.toBeNull();
    const thumbnails = within(toolbox as HTMLElement).getAllByRole('img');
    expect(thumbnails).toHaveLength(8);
    thumbnails.forEach((thumbnail) => {
      expect(thumbnail).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
      expect(thumbnail.parentElement).toHaveClass('th');
    });
  });

  it('drags a toolbox component onto the React Flow canvas', async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Studio' }));
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

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

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    const hardwareCard = await screen.findByRole('region', { name: 'Field hardware reference' });
    expect(within(hardwareCard).getByText('2-pair ODF rack patch panel (reference)')).toBeInTheDocument();
  });

  it('quick-adds NAP and Wi-Fi gateway equipment from the toolbox into the hardware Inspector', async () => {
    await renderStudio();
    const napTool = screen.getByRole('button', { name: /Outdoor NAP \/ FAT/i });
    fireEvent.doubleClick(napTool);

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    const hardwareCard = await screen.findByRole('region', { name: 'Field hardware reference' });
    expect(within(hardwareCard).getByText('Outdoor NAP/FAT 1:8 terminal (reference)')).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole('button', { name: /Wi-Fi 6 Gateway/i }));
    expect(await screen.findByText('Dual-band Wi-Fi 6 GPON / XGS-PON gateway (reference)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Properties' }));
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

    const blueChannel = within(tray).getByRole('switch', { name: 'Channel 1 Blue splice' });
    expect(blueChannel).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(blueChannel);
    expect(blueChannel).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(screen.getAllByText(/48 single fusion splices/)).toHaveLength(2);

    expect(closureNode?.querySelectorAll('.react-flow__handle[data-handleid^="in-"]')).toHaveLength(2);
    expect(closureNode?.querySelectorAll('.react-flow__handle[data-handleid^="out-"]')).toHaveLength(4);
  });

  it('uses the OPM HUD to probe a span at selectable simulated wavelengths and exits on Escape', async () => {
    await renderStudio();
    openMoreTools();
    fireEvent.click(screen.getByRole('button', { name: 'OPM Tool' }));
    openMoreTools();
    expect(screen.getByRole('button', { name: 'Close OPM' })).toHaveAttribute('aria-pressed', 'true');

    const feeder = getCanvasNodeByText(/^5\.0 km$/);
    const outputPort = feeder.querySelector('.react-flow__handle[data-handleid="out"]');
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
  });

  it('applies field fault switches and shows the explicit penalties in the ONT loss breakdown', async () => {
    await renderStudio();
    const feeder = getCanvasNodeByText(/^5\.0 km$/);
    fireEvent.click(feeder);

    const macroBend = screen.getByRole('switch', { name: 'Macro-bend fault (<15 mm)' });
    const dirtyFerrule = screen.getByRole('switch', { name: 'Dirty SC/APC ferrule' });
    fireEvent.click(macroBend);
    fireEvent.click(dirtyFerrule);
    expect(macroBend).toHaveAttribute('aria-checked', 'true');
    expect(dirtyFerrule).toHaveAttribute('aria-checked', 'true');

    const subscriber = getCanvasNodeByText('Al-Sulaymaniyah — Unit 12');
    const subscriberShell = subscriber.querySelector('.hw-onu');
    expect(within(subscriberShell as HTMLElement).getByText(/WARNING/)).toBeInTheDocument();
    fireEvent.click(subscriber);
    expect(await screen.findByText('Fault Penalty: Macro-Bend (-3.50 dB)')).toBeInTheDocument();
    expect(screen.getByText('Fault Penalty: Dust Contamination (-2.00 dB)')).toBeInTheDocument();
  });

  it('connects and disconnects node pairs in Link nodes mode and deletes a selected span', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Studio' }));
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    expect(screen.getByLabelText('Network health: Marginal links detected')).toBeInTheDocument();

    const oltNode = getCanvasNodeByText('OLT');
    const feederNode = getCanvasNodeByText(/^5\.0 km$/);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    expect(screen.getByText(/Select a source node, then a destination/i)).toBeInTheDocument();
    fireEvent.click(oltNode);
    expect(screen.getByText(/Source: olt-a/)).toBeInTheDocument();
    fireEvent.click(feederNode);
    await waitFor(() => expect(screen.getByLabelText('Network health: Fault on the network')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(oltNode);
    fireEvent.click(feederNode);
    await waitFor(() => expect(screen.getByLabelText('Network health: Marginal links detected')).toBeInTheDocument());

    fireEvent.click(feederNode);
    const deleteButton = screen.getByRole('button', { name: 'Delete selected elements' });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    fireEvent.click(deleteButton);
    await waitFor(() => expect(screen.queryByText(/^5\.0 km$/)).not.toBeInTheDocument());
  });

  it('pushes live optical telemetry into the ONT node', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    const ont = getCanvasNodeByText('Al-Sulaymaniyah — Unit 12').querySelector('.hw-onu');
    expect(ont).not.toBeNull();
    expect(within(ont as HTMLElement).getByText('-21.6 dBm')).toBeInTheDocument();
    expect(within(ont as HTMLElement).getByText(/ONLINE/)).toBeInTheDocument();

    // The 6 km drop sits just past the −24 dBm optimal floor.
    const remote = getCanvasNodeByText('Tanaro Village — Remote').querySelector('.hw-onu');
    expect(within(remote as HTMLElement).getByText(/WARNING/)).toBeInTheDocument();
  });

  it('reports the deployed plant in the top bar health strip and bottom panel', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    expect(screen.getByLabelText('Network health: Marginal links detected')).toBeInTheDocument();
    expect(screen.getByText('13.5 km')).toBeInTheDocument();
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('CAPEX $3,747');
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('$1,249.00 / Home Passed');
  });

  it('opens the Bill of Materials with reconciling totals', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

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

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    fireEvent.click(screen.getByText('Local unit pricing'));
    const feederRate = screen.getByRole('spinbutton', { name: 'Feeder / OSP cable' });
    expect(feederRate).toHaveValue(350);
    fireEvent.change(feederRate, { target: { value: '500' } });

    expect(capexBadge).toHaveTextContent('$4,497');
    expect(capexBadge).toHaveTextContent('$1,499.00 / Home Passed');
    expect(screen.getByLabelText('Network health: Marginal links detected')).toBeInTheDocument();

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
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    const wrapper = getCanvasNodeByText('Al-Sulaymaniyah — Unit 12');
    fireEvent.click(wrapper);

    expect(await screen.findByText('Link budget breakdown')).toBeInTheDocument();
    expect(screen.getByText('P_rx = P_tx − ΣL − margin')).toBeInTheDocument();
    expect(screen.getByText(/System safety margin/)).toBeInTheDocument();
    expect(screen.getByText('ONT serial number')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(await screen.findByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
    expect(screen.getByText('Desktop GPON ONU / ONT (reference)')).toBeInTheDocument();
    expect(screen.getByText('Ports & interfaces')).toBeInTheDocument();
    expect(screen.getByText(/do not mate an APC connector with a UPC connector/i)).toBeInTheDocument();
  });

  it('clears the canvas and shows the empty-state hint', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    openMoreTools();
    fireEvent.click(screen.getByRole('button', { name: /Clear Canvas/i }));

    expect(screen.queryByText('Al-Sulaymaniyah — Unit 12')).not.toBeInTheDocument();
    expect(await screen.findByText('The canvas is empty')).toBeInTheDocument();
  });

  it('opens a field mission, loads its scenario, and tracks objectives live', async () => {
    await renderStudio();

    openMoreTools();
    const missionsButton = screen.getByRole('button', { name: /^Missions$/i });
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

    openMoreTools();
    expect(screen.getByRole('button', { name: 'Missions, active: The Marginal Villa' })).toBeInTheDocument();
  });

  it('tracks the Budget Crunch mission against the live CAPEX estimate', async () => {
    await renderStudio();
    openMoreTools();
    fireEvent.click(screen.getByRole('button', { name: /^Missions$/i }));
    await screen.findByRole('dialog', { name: 'Field missions' });
    fireEvent.click(screen.getByRole('button', { name: /The Budget Crunch: Cost vs. Performance/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByText('1/3 complete')).toBeInTheDocument();
    expect(screen.getByText(/Keep the total reference CAPEX below \$1,600\.00/)).toBeInTheDocument();
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('$3,747');
  });

  it('acquires an interactive OTDR trace from the studio and lists terminal Fresnel events', async () => {
    await renderStudio();
    openMoreTools();
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
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Failing Long-Distance Link/ }));

    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));
    expect(screen.getByLabelText('Network health: Fault on the network')).toBeInTheDocument();

    const ont = getCanvasNodeByText('Dukan Ridge — Tower 7').querySelector('.hw-onu');
    expect(within(ont as HTMLElement).getByText(/LOS/)).toBeInTheDocument();
    expect(within(ont as HTMLElement).getByText('-39.5 dBm')).toBeInTheDocument();
  });

  it('selects the modern XGS-PON suburb preset and exposes live gateway service and hardware details', async () => {
    await renderStudio();
    fireEvent.click(screen.getByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /MODERN 10G XGS-PON SUBURB/i }));

    await waitFor(() => expect(screen.getAllByText('Modern Suburb — Home 1').length).toBeGreaterThan(0));
    const gatewayNode = getCanvasNodeByText('Modern Suburb — Home 1');
    expect(within(gatewayNode).getAllByText('XGS-PON')).toHaveLength(2);
    expect(within(gatewayNode).getByText('XGS-PON 10G ACTIVE')).toBeInTheDocument();
    expect(within(gatewayNode).getByText('192.0.2.101')).toBeInTheDocument();
    expect(within(gatewayNode).getByText('↓ 1.24 Gbps · ↑ 1.24 Gbps')).toBeInTheDocument();
    expect(within(gatewayNode).getByText(/modeled XGS-PON receive-power window/)).toBeInTheDocument();

    fireEvent.click(gatewayNode);
    expect(screen.getByRole('textbox', { name: 'Wi-Fi SSID' })).toHaveValue('FiberLAB-XGS-01');
    expect(screen.getByText('1244 / 1244 Mbps')).toBeInTheDocument();
    expect(screen.getByText('Internet IP (simulated)')).toBeInTheDocument();
    expect(screen.getByText(/TEST-NET placeholder only/)).toBeInTheDocument();
    expect(screen.getByText(/Speed estimate divides the nominal shared PON line rate/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(await screen.findByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
    expect(screen.getByText('Dual-band Wi-Fi 6 GPON / XGS-PON gateway (reference)')).toBeInTheDocument();
  });

  it('switches an OLT between GPON and XGS-PON and updates the wavelength-dependent budget', async () => {
    await renderStudio();
    const oltNode = getCanvasNodeByText('OLT');
    fireEvent.click(oltNode);

    const standard = screen.getByRole('combobox', { name: 'PON standard' });
    expect(standard).toHaveValue('GPON');
    fireEvent.change(standard, { target: { value: 'XGS-PON' } });
    expect(standard).toHaveValue('XGS-PON');
    expect(screen.getByText(/0\.22 dB\/km/)).toBeInTheDocument();

    const subscriber = getCanvasNodeByText('Al-Sulaymaniyah — Unit 12');
    fireEvent.click(subscriber);
    expect(await screen.findByText(/Feeder cable — 5 km @ 0\.22 dB\/km @ 1577 nm/)).toBeInTheDocument();
  });

  it('displays upstream dynamic range warnings and hides canvas fault tags in the Blind Fault mission', async () => {
    await renderStudio();
    const dropSpan = getCanvasNodeByText(/^6\.0 km$/);
    fireEvent.click(dropSpan);

    fireEvent.click(screen.getByRole('switch', { name: 'Macro-bend fault (<15 mm)' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Dirty SC/APC ferrule' }));
    const lengthInputs = screen.getAllByDisplayValue('6');
    fireEvent.change(lengthInputs[0], { target: { value: '45' } });

    expect(await screen.findByTestId('olt-dynamic-range-warning')).toHaveTextContent(/Dynamic range exceeded/i);

    fireEvent.click(screen.getByRole('button', { name: /Bill of Materials/i }));
    expect(await screen.findByText('Upstream Δ')).toBeInTheDocument();
    expect(screen.getByText('0.00 dB')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close bill of materials' }));

    openMoreTools();
    fireEvent.click(screen.getByRole('button', { name: /^Missions$/i }));
    await screen.findByRole('dialog', { name: 'Field missions' });
    fireEvent.click(screen.getByRole('button', { name: /Blind Fault: The Cut in the Trunk/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByText('0/3 complete')).toBeInTheDocument();
    expect(screen.queryByText(/Macro-bend \+3\.50 dB/)).not.toBeInTheDocument();
    expect(screen.queryByText('custom α')).not.toBeInTheDocument();
  });

  it('renders physical telecom hardware faceplates, canvas workbench toolbar, and bottom panel tabs', async () => {
    await renderStudio();

    // Realistic OLT hardware card
    const oltNode = getCanvasNodeByText('OLT').querySelector('.hw-olt');
    expect(oltNode).not.toBeNull();
    expect(oltNode).toHaveTextContent('TX Power');
    expect(oltNode).toHaveTextContent('RX Power');
    expect(oltNode).toHaveTextContent('PON Status');

    // Realistic PLC Splitter hardware card
    const splitterNode = getCanvasNodeByText('PLC Splitter 1:8').querySelector('.hw-spl');
    expect(splitterNode).not.toBeNull();
    expect(splitterNode).toHaveTextContent('Insertion Loss 10.5 dB');

    // Floating canvas sub-toolbar
    const canvasToolbar = screen.getByRole('toolbar', { name: 'Canvas workbench tools' });
    expect(within(canvasToolbar).getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Pan' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Link nodes' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Add Node' })).toBeInTheDocument();

    // Bottom panel with Network Overview, Optical Budget, Components, and Topology tabs
    const bottomPanel = screen.getByTestId('network-summary-strip');
    expect(bottomPanel).toHaveTextContent('Total Distance');
    expect(bottomPanel).toHaveTextContent('13.5 km');
    expect(within(bottomPanel).getByText('OLT Launch')).toBeInTheDocument();
    expect(within(bottomPanel).getByText('After Splitter')).toBeInTheDocument();
    fireEvent.click(within(bottomPanel).getByRole('tab', { name: 'Optical Budget' }));
    expect(within(bottomPanel).getByText('Open full audit & quotation')).toBeInTheDocument();

    // Inspector tab navigation & collapsible panel
    fireEvent.click(oltNode as HTMLElement);
    const tabList = screen.getByRole('tablist', { name: 'Inspector sections' });
    fireEvent.click(within(tabList).getByRole('tab', { name: 'Optical Power' }));
    fireEvent.click(within(tabList).getByRole('tab', { name: 'Info' }));
    fireEvent.click(within(tabList).getByRole('tab', { name: 'Properties' }));

    // Collapse and re-expand Inspector
    fireEvent.click(screen.getByRole('button', { name: 'Collapse inspector' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand inspector' }));
  });
});
