import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';

// jsdom ships no PointerEvent, but the component sheets are pointer-driven, so
// give the environment a minimal MouseEvent-backed shim (clientY and all).
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventShim;
}

async function renderStudio() {
  const result = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /Launch Interactive Studio/i }));
  await screen.findByRole('button', { name: 'Run Simulation' });
  // The workbench opens on an empty canvas, so load the reference tree the
  // assertions below are written against.
  fireEvent.click(screen.getByRole('button', { name: /Preset Topologies/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Standard 1:32 GPON Tree/i }));
  await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));
  return result;
}

const rail = () => screen.getByRole('navigation', { name: 'Workbench sections' });

/** The landing view stays mounted (inert) behind the studio, so scope to the workbench header. */
const workbenchTopBar = () =>
  screen.getAllByRole('banner').find((element) => element.classList.contains('fiberlab-topbar')) as HTMLElement;

/** Sections are screens: switching one unmounts the previous step. */
function openSection(name: 'Design' | 'Simulation' | 'Reports' | 'Settings') {
  fireEvent.click(within(rail()).getByRole('button', { name }));
}

function openMoreTools() {
  fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
}

/**
 * The canvas ⋯ menu only holds canvas actions. App-level actions (test gear,
 * missions, safety margin, Auto-run, Clear, help) live in Settings, so tests
 * that need one of those walk there first.
 */
function useSettingsAction(name: string | RegExp) {
  openSection('Settings');
  fireEvent.click(screen.getByRole('button', { name }));
}

/** Detailed values (loss tables, fault switches) hide behind one disclosure. */
function expandAdvanced() {
  fireEvent.click(screen.getByRole('button', { name: /^Advanced/ }));
}

/** The library is an accordion, so a category must be opened before its cards exist. */
function openLibraryCategory(label: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
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

    expect(await screen.findByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    expect(await screen.findByText('-24.30 dBm')).toBeInTheDocument();

    // One interactive control, and the reference numbers an engineer will check.
    const launchSlider = screen.getByLabelText(/Laser launch power/i);
    expect(launchSlider).toHaveValue('5');
    fireEvent.change(launchSlider, { target: { value: '6.4' } });
    expect(launchSlider).toHaveValue('6.4');
    expect(screen.getByText('0.25 dB/km')).toBeInTheDocument();
    expect(screen.getByText('Splitter 1:4')).toBeInTheDocument();
    expect(screen.getAllByText('−7.20 dB').length).toBeGreaterThan(0);

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

    // The ⋯ menu is canvas-only; the mission state is reported in Settings.
    openMoreTools();
    expect(screen.getByRole('button', { name: 'Fit view to screen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Missions/ })).not.toBeInTheDocument();
    openSection('Settings');
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
    expect(await screen.findByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Launch Interactive Studio/i }));
    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));
    expect(screen.getByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
  });

  it('opens the workbench on an empty canvas with a friendly mission hint', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Launch Interactive Studio/i }));
    await screen.findByRole('button', { name: 'Run Simulation' });

    expect(await screen.findByText('The canvas is empty')).toBeInTheDocument();
    expect(screen.queryByText('Al-Sulaymaniyah — Unit 12')).not.toBeInTheDocument();
    expect(screen.getByText('Drag in an OLT, or let a mission walk you through it.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open the mission' }));
    expect(await screen.findByRole('dialog', { name: 'Field missions' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Field missions' })).not.toBeInTheDocument());

    // The hint is a nudge, not furniture: it can be dismissed.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss canvas hint' }));
    expect(screen.queryByText('The canvas is empty')).not.toBeInTheDocument();
  });

  it('loads the standard 1:32 tree and renders every element', async () => {
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

    // The library is an accordion: one category open at a time, each with a
    // count badge. Every category still shows its hardware artwork.
    let thumbnails = 0;
    for (const label of [
      'OLT / Headend',
      'Fiber Cables',
      'Splitters',
      'Splices & Closures',
      'Customer / ONT',
      'Tools',
    ]) {
      const header = within(toolbox as HTMLElement).getByRole('button', { name: new RegExp(`^${label}`) });
      // One category is open by default; opening another closes it.
      if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'true');
      const openHeaders = within(toolbox as HTMLElement)
        .getAllByRole('button')
        .filter((button) => button.getAttribute('aria-expanded') === 'true');
      expect(openHeaders).toHaveLength(1);

      const images = within(toolbox as HTMLElement).queryAllByRole('img');
      images.forEach((thumbnail) => {
        expect(thumbnail).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
        expect(thumbnail.parentElement).toHaveClass('th');
      });
      thumbnails += images.length;
    }
    // OLT + ODF, one cable card, one splitter card, closure + NAP, ONT + gateway.
    expect(thumbnails).toBe(8);
  });

  it('drags a toolbox component onto the React Flow canvas', async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Studio' }));
    fireEvent.click(await screen.findByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Standard 1:32 GPON Tree/i }));
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

  it('quick-adds NAP and Wi-Fi gateway equipment from the component library into the hardware Inspector', async () => {
    await renderStudio();
    openLibraryCategory('Splices & Closures');
    fireEvent.click(screen.getByRole('button', { name: /Outdoor NAP \/ FAT/i }));

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    const hardwareCard = await screen.findByRole('region', { name: 'Field hardware reference' });
    expect(within(hardwareCard).getByText('Outdoor NAP/FAT 1:8 terminal (reference)')).toBeInTheDocument();

    openLibraryCategory('Customer / ONT');
    fireEvent.click(screen.getByRole('button', { name: /Wi-Fi 6 Gateway/i }));
    // A new selection reopens the panel on Properties.
    expect(await screen.findByRole('textbox', { name: 'Wi-Fi SSID' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(await screen.findByText('Dual-band Wi-Fi 6 GPON / XGS-PON gateway (reference)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Properties' }));
    expect((screen.getByRole('textbox', { name: 'Wi-Fi SSID' }) as HTMLInputElement).value).toMatch(/^FiberLAB-/);
  });

  it('adds an OSP dome closure and toggles color-coded tray splices in the Inspector', async () => {
    await renderStudio();
    openLibraryCategory('Splices & Closures');
    fireEvent.click(screen.getByRole('button', { name: /Dome Splice Closure/i }));

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
    useSettingsAction('OPM Tool');
    // The tool arms the canvas, so Settings hands the screen back to Design.
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(document.querySelector('.pu-canvas.opm-probe-mode')).not.toBeNull();

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
    expandAdvanced();

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
    fireEvent.click(screen.getByRole('tab', { name: 'Optical Power' }));
    expect(await screen.findByText('Fault Penalty: Macro-Bend (-3.50 dB)')).toBeInTheDocument();
    expect(screen.getByText('Fault Penalty: Dust Contamination (-2.00 dB)')).toBeInTheDocument();
  });

  const statusBar = () => screen.getByTestId('network-status-bar');
  const statusToggle = () => within(statusBar()).getByRole('button', { name: /^Network status:/ });

  it('connects and disconnects node pairs in Link nodes mode and deletes a selected span', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch Studio' }));
    fireEvent.click(await screen.findByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Standard 1:32 GPON Tree/i }));
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    expect(statusToggle()).toHaveAccessibleName(/Network status: Marginal\./);

    const oltNode = getCanvasNodeByText('OLT');
    const feederNode = getCanvasNodeByText(/^5\.0 km$/);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    expect(screen.getByText(/Select a source node, then a destination/i)).toBeInTheDocument();
    fireEvent.click(oltNode);
    expect(screen.getByText(/Source: olt-a/)).toBeInTheDocument();
    fireEvent.click(feederNode);
    await waitFor(() =>
      expect(within(statusBar()).getByRole('button', { name: /Network status: Fail\./ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(oltNode);
    fireEvent.click(feederNode);
    await waitFor(() =>
      expect(within(statusBar()).getByRole('button', { name: /Network status: Marginal\./ })).toBeInTheDocument(),
    );

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

  it('reports the deployed plant in the bottom status bar and the optical budget sheet', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    // Four values, no more: status, total loss, total distance, subscribers OK.
    const bar = statusBar();
    expect(within(bar).getByText('Marginal')).toBeInTheDocument();
    expect(within(bar).getByText('Total loss')).toBeInTheDocument();
    expect(within(bar).getByText('Total distance')).toBeInTheDocument();
    expect(within(bar).getByText('13.5 km')).toBeInTheDocument();
    const subscribers = within(bar).getByText('Subscribers OK').closest('.pu-sb-item') as HTMLElement;
    expect(subscribers).toHaveTextContent(/\d+ \/ 3/);
    expect(statusToggle()).toHaveAttribute('aria-expanded', 'false');

    // Expanding shows only the optical budget and the events.
    fireEvent.click(statusToggle());
    expect(statusToggle()).toHaveAttribute('aria-expanded', 'true');
    const detail = document.getElementById('status-bar-detail') as HTMLElement;
    expect(within(detail).getByRole('tablist', { name: 'Network detail views' })).toBeInTheDocument();
    expect(
      within(detail)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Optical Budget', 'Events1']);
    expect(within(detail).getByRole('tab', { name: 'Optical Budget' })).toHaveAttribute('aria-selected', 'true');
    for (const label of ['OLT Launch', 'After Splitter', 'Closest ONT', 'Farthest ONT']) {
      expect(within(detail).getByText(label)).toBeInTheDocument();
    }
    expect(within(detail).getByRole('button', { name: 'Open full audit & quotation' })).toBeInTheDocument();

    // Events describe the faults and pick the affected component on the canvas.
    fireEvent.click(within(detail).getByRole('tab', { name: /Events/ }));
    expect(within(detail).getByRole('tab', { name: /Events/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(detail).getByText(/^WARNING · /)).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: /Tanaro Village — Remote/ }));
    await waitFor(() => expect(screen.getByRole('tablist', { name: 'Inspector sections' })).toBeInTheDocument());
    expect(screen.getByText('Properties')).toBeInTheDocument();

    // CAPEX moved to Reports: the bar no longer carries it.
    expect(screen.queryByTestId('capex-telemetry')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
    openSection('Reports');
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('CAPEX $3,747');
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('$1,249.00 / Home Passed');
    openSection('Design');
  });

  it('opens the Bill of Materials with reconciling totals', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    openSection('Reports');

    expect(await screen.findByText('Optical audit & commercial CAPEX quotation')).toBeInTheDocument();
    // 5 + 1 + 0.3 + 1.2 + 6 km of plant on the canvas.
    expect(screen.getByText('13.50')).toBeInTheDocument();
    // Two wired-optimal + one marginal = 3 online, 0 offline.
    expect(screen.getByText('ONTs provisioned')).toBeInTheDocument();
    expect(screen.queryByText('Dukan Ridge — Tower 7')).not.toBeInTheDocument();

    openSection('Design');
    expect(screen.queryByText('Optical audit & commercial CAPEX quotation')).not.toBeInTheDocument();
  });

  it('edits local USD pricing in the Bill of Materials without changing optical status', async () => {
    await renderStudio();
    openSection('Reports');
    const capexBadge = screen.getByTestId('capex-telemetry');
    expect(capexBadge).toHaveTextContent('$3,747');
    fireEvent.click(screen.getByRole('tab', { name: 'Commercial Quotation & CAPEX' }));
    fireEvent.click(screen.getByText('Local unit pricing'));
    const feederRate = screen.getByRole('spinbutton', { name: 'Feeder / OSP cable' });
    expect(feederRate).toHaveValue(350);
    fireEvent.change(feederRate, { target: { value: '500' } });

    expect(capexBadge).toHaveTextContent('$4,497');
    expect(capexBadge).toHaveTextContent('$1,499.00 / Home Passed');

    fireEvent.click(screen.getByRole('button', { name: 'Restore reference pricing' }));
    expect(capexBadge).toHaveTextContent('$3,747');

    // Pricing is commercial only: the optics are untouched behind the screen.
    openSection('Design');
    expect(statusToggle()).toHaveAccessibleName(/Network status: Marginal\./);
  });

  it('shows a commercial quotation tab with reconciling material and labor totals', async () => {
    await renderStudio();
    openSection('Reports');
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

    expect(screen.getByText('ONT serial number')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Optical Power' }));
    expect(await screen.findByText('Link budget breakdown')).toBeInTheDocument();
    expect(screen.getByText('P_rx = P_tx − ΣL − margin')).toBeInTheDocument();
    expect(screen.getByText(/System safety margin/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(await screen.findByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
    expect(screen.getByText('Desktop GPON ONU / ONT (reference)')).toBeInTheDocument();
    expect(screen.getByText('Ports & interfaces')).toBeInTheDocument();
    expect(screen.getByText(/do not mate an APC connector with a UPC connector/i)).toBeInTheDocument();
  });

  it('clears the canvas and shows the empty-state hint', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    useSettingsAction(/Clear Canvas/i);

    // Clearing hands the empty canvas back to the user.
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(screen.queryByText('Al-Sulaymaniyah — Unit 12')).not.toBeInTheDocument();
    expect(await screen.findByText('The canvas is empty')).toBeInTheDocument();
  });

  it('opens a field mission, loads its scenario, and tracks objectives live', async () => {
    await renderStudio();

    useSettingsAction(/^Missions$/i);
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

    openSection('Settings');
    expect(screen.getByRole('button', { name: 'Missions, active: The Marginal Villa' })).toBeInTheDocument();
  });

  it('tracks the Budget Crunch mission against the live CAPEX estimate', async () => {
    await renderStudio();
    useSettingsAction(/^Missions$/i);
    await screen.findByRole('dialog', { name: 'Field missions' });
    fireEvent.click(screen.getByRole('button', { name: /The Budget Crunch: Cost vs. Performance/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByText('1/3 complete')).toBeInTheDocument();
    expect(screen.getByText(/Keep the total reference CAPEX below \$1,600\.00/)).toBeInTheDocument();
    expect(screen.queryByTestId('capex-telemetry')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    openSection('Reports');
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('$3,747');
    openSection('Design');
  });

  it('acquires an interactive OTDR trace from the studio and lists terminal Fresnel events', async () => {
    await renderStudio();
    useSettingsAction('OTDR Trace');
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
    expect(statusToggle()).toHaveAccessibleName(/Network status: Fail\./);

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
    fireEvent.click(screen.getByRole('tab', { name: 'Optical Power' }));
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
    fireEvent.click(screen.getByRole('tab', { name: 'Optical Power' }));
    expect(await screen.findByText(/Feeder cable — 5 km @ 0\.22 dB\/km @ 1577 nm/)).toBeInTheDocument();
  });

  it('displays upstream dynamic range warnings and hides canvas fault tags in the Blind Fault mission', async () => {
    await renderStudio();
    const dropSpan = getCanvasNodeByText(/^6\.0 km$/);
    fireEvent.click(dropSpan);
    expandAdvanced();

    fireEvent.click(screen.getByRole('switch', { name: 'Macro-bend fault (<15 mm)' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Dirty SC/APC ferrule' }));
    const lengthInputs = screen.getAllByDisplayValue('6');
    fireEvent.change(lengthInputs[0], { target: { value: '45' } });

    expect(await screen.findByTestId('olt-dynamic-range-warning')).toHaveTextContent(/Dynamic range exceeded/i);

    openSection('Reports');
    expect(await screen.findByText('Upstream Δ')).toBeInTheDocument();
    expect(screen.getByText('0.00 dB')).toBeInTheDocument();
    openSection('Design');

    useSettingsAction(/^Missions$/i);
    await screen.findByRole('dialog', { name: 'Field missions' });
    fireEvent.click(screen.getByRole('button', { name: /Blind Fault: The Cut in the Trunk/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByText('0/3 complete')).toBeInTheDocument();
    expect(screen.queryByText(/Macro-bend \+3\.50 dB/)).not.toBeInTheDocument();
    expect(screen.queryByText('custom α')).not.toBeInTheDocument();
  });

  it('renders physical telecom hardware faceplates, canvas workbench toolbar, and the status bar', async () => {
    await renderStudio();

    // Realistic OLT hardware card
    const oltNode = getCanvasNodeByText('OLT').querySelector('.hw-olt');
    expect(oltNode).not.toBeNull();
    expect(oltNode).toHaveTextContent('TX Power');
    expect(oltNode).toHaveTextContent('ONU Rx (max)');
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
    expect(within(canvasToolbar).getByRole('button', { name: 'Delete selected elements' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Fit View' })).toBeInTheDocument();
    // Adding components lives in the library; the overflow keeps everything else.
    expect(within(canvasToolbar).queryByRole('button', { name: 'Add Node' })).not.toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'More tools' })).toBeInTheDocument();

    // A slim status bar replaces the old Components/Topology tabs.
    const bar = statusBar();
    expect(within(bar).getByText('Total distance')).toBeInTheDocument();
    expect(within(bar).getByText('13.5 km')).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Network summary views' })).not.toBeInTheDocument();
    fireEvent.click(statusToggle());
    const detail = document.getElementById('status-bar-detail') as HTMLElement;
    expect(within(detail).getByText('OLT Launch')).toBeInTheDocument();
    expect(within(detail).getByText('After Splitter')).toBeInTheDocument();
    expect(within(detail).getByRole('tab', { name: 'Optical Budget' })).toBeInTheDocument();
    expect(within(detail).getByText('Open full audit & quotation')).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: 'Hide network details' }));
    expect(document.getElementById('status-bar-detail')).toBeNull();

    // The panel only exists while something is selected.
    expect(screen.queryByRole('tablist', { name: 'Inspector sections' })).not.toBeInTheDocument();
    fireEvent.click(oltNode as HTMLElement);
    const tabList = screen.getByRole('tablist', { name: 'Inspector sections' });
    expect(
      within(tabList)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Properties', 'Optical Power', 'Info']);
    fireEvent.click(within(tabList).getByRole('tab', { name: 'Optical Power' }));
    fireEvent.click(within(tabList).getByRole('tab', { name: 'Info' }));
    fireEvent.click(within(tabList).getByRole('tab', { name: 'Properties' }));

    // Closing it frees the canvas; clicking the part again brings it back.
    fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
    expect(screen.queryByRole('tablist', { name: 'Inspector sections' })).not.toBeInTheDocument();
    fireEvent.click(oltNode as HTMLElement);
    expect(screen.getByRole('tablist', { name: 'Inspector sections' })).toBeInTheDocument();
  });

  it('keeps the top bar to the logo, project, zoom and Run Simulation', async () => {
    await renderStudio();
    const banner = workbenchTopBar();

    expect(within(banner).getByRole('button', { name: 'Overview & Physics' })).toBeInTheDocument();
    expect(within(banner).getByText('Standard 1:32 GPON Tree')).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Zoom' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Run Simulation' })).toBeInTheDocument();

    // Reports owns a section now, presets moved to the design bar, and the
    // network colour lives in the status bar instead of a header chip.
    expect(within(banner).queryByRole('button', { name: 'Reports' })).not.toBeInTheDocument();
    expect(within(banner).queryByRole('button', { name: /Preset Topologies/ })).not.toBeInTheDocument();
    expect(within(banner).queryByLabelText(/Network health/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Preset Topologies/i })).toBeInTheDocument();
  });

  it('switches between the Design, Simulation, Reports and Settings screens', async () => {
    await renderStudio();
    expect(within(rail()).getByRole('button', { name: 'Design' })).toHaveAttribute('aria-current', 'page');

    openSection('Simulation');
    expect(screen.getByRole('heading', { name: 'Simulation' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Subscriber optical results' })).toBeInTheDocument();
    expect(screen.getByText('OLT Launch')).toBeInTheDocument();
    expect(screen.getByText('13.5 km')).toBeInTheDocument();

    // A row is a shortcut back to that component on the canvas.
    fireEvent.click(screen.getByRole('button', { name: /Show Al-Sulaymaniyah — Unit 12 on the canvas/ }));
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Inspector sections' })).toBeInTheDocument();

    openSection('Settings');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Global safety margin' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Auto-run' })).toHaveAttribute('aria-checked', 'true');

    openSection('Reports');
    expect(screen.getByRole('heading', { name: 'Bill of Materials' })).toBeInTheDocument();
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('CAPEX $3,747');
  });

  it('returns from Reports with the back button, Escape, or the browser back gesture', async () => {
    await renderStudio();
    openSection('Reports');

    const back = screen.getByRole('button', { name: 'Back to Design' });
    expect(back).toBeVisible();
    fireEvent.click(back);
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bill of Materials' })).not.toBeInTheDocument();

    // Escape is the keyboard's way back.
    openSection('Reports');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Bill of Materials' })).not.toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();

    // The browser Back button and the phone back gesture walk the same steps.
    openSection('Reports');
    window.history.back();
    await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument());
  });

  it('moves keyboard focus to the heading of the section that opens', async () => {
    await renderStudio();

    openSection('Reports');
    expect(screen.getByRole('heading', { level: 1, name: 'Bill of Materials' })).toHaveFocus();

    openSection('Settings');
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveFocus();

    openSection('Simulation');
    expect(screen.getByRole('heading', { level: 1, name: 'Simulation' })).toHaveFocus();

    openSection('Design');
    expect(screen.getByRole('heading', { level: 1, name: 'Design canvas' })).toHaveFocus();
  });

  it('gives Reports a main landmark, a heading hierarchy and self-scrolling tables', async () => {
    await renderStudio();
    openSection('Reports');

    const main = document.querySelector('main.pu-reports-screen') as HTMLElement;
    expect(main).not.toBeNull();
    expect(within(main).getByRole('heading', { level: 1, name: 'Bill of Materials' })).toBeInTheDocument();
    expect(within(main).getByRole('heading', { level: 2, name: 'Optical budget per subscriber' })).toBeInTheDocument();

    // Every table scrolls inside its own box, so the page never scrolls sideways.
    const subscriberTable = screen.getByTestId('subscriber-budget');
    expect(subscriberTable.parentElement).toHaveClass('overflow-x-auto');

    fireEvent.click(screen.getByRole('tab', { name: 'Commercial Quotation & CAPEX' }));
    const quotationTable = screen.getByTestId('quotation-line-items');
    expect(quotationTable.parentElement).toHaveClass('overflow-x-auto');
    expect(within(main).getByRole('heading', { level: 2, name: 'Commercial quotation & CAPEX' })).toBeInTheDocument();
  });

  it('keeps the URL hash while the sections move', async () => {
    window.location.hash = '#reference';
    await renderStudio();

    openSection('Reports');
    expect(window.location.hash).toBe('#reference');
    openSection('Settings');
    expect(window.location.hash).toBe('#reference');
    openSection('Design');
    expect(window.location.hash).toBe('#reference');

    window.history.replaceState({}, '', window.location.pathname);
  });

  it('offers the same four sections in the phone tab bar', async () => {
    await renderStudio();
    const tabs = screen.getByRole('navigation', { name: 'Sections' });

    expect(
      within(tabs)
        .getAllByRole('button')
        .map((tab) => tab.getAttribute('aria-label')),
    ).toEqual(['Design', 'Simulation', 'Reports', 'Settings']);

    fireEvent.click(within(tabs).getByRole('button', { name: 'Reports' }));
    expect(screen.getByRole('heading', { name: 'Bill of Materials' })).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
  });

  it('explains the first three steps once and remembers the dismissal', async () => {
    window.localStorage.clear();
    const { unmount } = await renderStudio();

    const hint = screen.getByRole('complementary', { name: 'Getting started' });
    expect(hint).toHaveTextContent('Pick a component');
    expect(hint).toHaveTextContent('Connect them');
    expect(hint).toHaveTextContent('Press Run Simulation');

    fireEvent.click(within(hint).getByRole('button', { name: 'Dismiss getting started' }));
    expect(screen.queryByRole('complementary', { name: 'Getting started' })).not.toBeInTheDocument();

    // Remembered: a fresh mount stays clean.
    unmount();
    await renderStudio();
    expect(screen.queryByRole('complementary', { name: 'Getting started' })).not.toBeInTheDocument();
  });

  it('opens Reports as its own section instead of a dialog', async () => {
    await renderStudio();
    const reportsTab = within(rail()).getByRole('button', { name: 'Reports' });
    fireEvent.click(reportsTab);

    // The Bill of Materials is the Reports screen, so there is no overlay at all.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bill of Materials' })).toBeInTheDocument();
    expect(reportsTab).toHaveAttribute('aria-current', 'page');
    // Design chrome unmounts while another section is in charge.
    expect(screen.queryByRole('toolbar', { name: 'Canvas workbench tools' })).not.toBeInTheDocument();

    openSection('Design');
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bill of Materials' })).not.toBeInTheDocument();
  });

  it('keeps one dialog in charge of the keyboard at a time', async () => {
    await renderStudio();
    useSettingsAction('OTDR Trace');
    await screen.findByRole('dialog', { name: 'OTDR Trace Analyzer' });

    useSettingsAction(/^Missions$/i);

    await screen.findByRole('dialog', { name: 'Field missions' });
    expect(screen.queryByRole('dialog', { name: 'OTDR Trace Analyzer' })).not.toBeInTheDocument();
  });

  it('closes the More tools popover on Escape and returns focus to its trigger', async () => {
    await renderStudio();
    const trigger = screen.getByRole('button', { name: 'More tools' });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Zoom to 100%' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: 'Zoom to 100%' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps the canvas overflow to canvas actions only', async () => {
    await renderStudio();
    openMoreTools();
    const menu = document.getElementById('canvas-more-tools') as HTMLElement;
    const labels = within(menu)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));

    expect(labels).toEqual(['Fit view to screen', 'Zoom to 100%']);
    expect(within(menu).getByRole('switch', { name: 'Snap to grid' })).toBeInTheDocument();
    // Everything that configures the app moved to Settings instead.
    for (const moved of ['Overview & Physics', 'OPM Tool', 'OTDR Trace', 'Missions', 'Clear Canvas']) {
      expect(within(menu).queryByRole('button', { name: moved })).not.toBeInTheDocument();
    }
    expect(within(menu).queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('marks a keyboard-deleted element as an edit and clears the selection', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Launch Interactive Studio/i }));
    await screen.findByRole('button', { name: 'Run Simulation' });
    fireEvent.click(screen.getByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Standard 1:32 GPON Tree/i }));

    const dropSpan = getCanvasNodeByText(/^6\.0 km$/);
    fireEvent.click(dropSpan);
    expect(screen.getByRole('button', { name: 'Remove component' })).toBeInTheDocument();

    fireEvent.keyDown(container.querySelector('.react-flow__pane') as Element, { key: 'Delete' });

    await waitFor(() => expect(screen.queryAllByText(/^6\.0 km$/)).toHaveLength(0));
    expect(await screen.findByText('Edited')).toBeInTheDocument();
  });

  it('marks the loaded preset as edited once the canvas deviates from it', async () => {
    await renderStudio();
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();

    const dropSpan = getCanvasNodeByText(/^6\.0 km$/);
    fireEvent.click(dropSpan);
    expandAdvanced();
    fireEvent.click(screen.getByRole('switch', { name: 'Macro-bend fault (<15 mm)' }));

    expect(await screen.findByText('Edited')).toBeInTheDocument();
  });

  it('exposes one patchable branch port per split output and a reachable Ports tab', async () => {
    await renderStudio();

    const splitter = getCanvasNodeByText('PLC Splitter 1:8');
    expect(splitter.querySelectorAll('.react-flow__handle[data-handleid^="out-"]')).toHaveLength(8);
    expect(splitter.querySelector('.react-flow__handle[data-handleid="out-7"]')).not.toBeNull();

    fireEvent.click(splitter);
    expandAdvanced();
    expect(await screen.findByText('Physical Optical Interface Ports')).toBeInTheDocument();
    expect(screen.getByText(/8 × SC\/APC branch outputs/)).toBeInTheDocument();
  });

  it('caps large cassettes at sixteen branch ports and says so', async () => {
    await renderStudio();

    fireEvent.click(screen.getByRole('button', { name: /Preset Topologies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Failing Long-Distance Link/ }));
    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));

    const splitter = getCanvasNodeByText('PLC Splitter 1:32');
    expect(splitter.querySelectorAll('.react-flow__handle[data-handleid^="out-"]')).toHaveLength(16);
    expect(within(splitter).getByText(/rest trunked/i)).toBeInTheDocument();

    fireEvent.click(splitter);
    expandAdvanced();
    expect(screen.getByText(/remaining fan-out stays a ribbon trunk/i)).toBeInTheDocument();
  });

  it('keeps loss tables and allowances folded behind Advanced until asked', async () => {
    await renderStudio();
    fireEvent.click(getCanvasNodeByText('PLC Splitter 1:8'));

    // Essentials first: the ratio and its insertion loss.
    expect(screen.getByRole('combobox', { name: 'Split ratio' })).toHaveValue('8');
    expect(screen.getByText('Insertion loss')).toBeInTheDocument();
    const advanced = screen.getByRole('button', { name: /^Advanced/ });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Excess / uniformity loss')).not.toBeInTheDocument();

    expandAdvanced();
    expect(advanced).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Excess / uniformity loss')).toBeInTheDocument();
    expect(screen.getByText('Total modeled insertion loss')).toBeInTheDocument();
  });

  it('confirms before removing a selected component', async () => {
    await renderStudio();
    fireEvent.click(getCanvasNodeByText('PLC Splitter 1:8'));

    fireEvent.click(screen.getByRole('button', { name: 'Remove component' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Confirm removal' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('tablist', { name: 'Inspector sections' })).toBeInTheDocument();
    expect(screen.getAllByText('PLC Splitter 1:8').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Remove component' }));
    const again = await screen.findByRole('alertdialog', { name: 'Confirm removal' });
    fireEvent.click(within(again).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(screen.queryByText('PLC Splitter 1:8')).not.toBeInTheDocument());
    // The panel leaves with the component it described.
    expect(screen.queryByRole('tablist', { name: 'Inspector sections' })).not.toBeInTheDocument();
  });

  it('drags the phone inspector sheet between half and full height, then closes it', async () => {
    const { container } = await renderStudio();
    fireEvent.click(getCanvasNodeByText('PLC Splitter 1:8'));

    // The swipe handle only exists (visually) on phones, but its gestures are the
    // same handlers in every viewport.
    const handle = container.querySelector('.pu-insp-handle') as HTMLElement;
    expect(handle).not.toBeNull();

    fireEvent.pointerDown(handle, { clientY: 400 });
    fireEvent.pointerMove(handle, { clientY: 330 });
    fireEvent.pointerUp(handle, { clientY: 330 });
    expect(screen.getByLabelText('Selected component')).toHaveClass('is-sheet-full');

    fireEvent.pointerDown(handle, { clientY: 330 });
    fireEvent.pointerMove(handle, { clientY: 400 });
    fireEvent.pointerUp(handle, { clientY: 400 });
    expect(screen.getByLabelText('Selected component')).not.toHaveClass('is-sheet-full');

    fireEvent.pointerDown(handle, { clientY: 330 });
    fireEvent.pointerMove(handle, { clientY: 400 });
    fireEvent.pointerUp(handle, { clientY: 400 });
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Inspector sections' })).not.toBeInTheDocument());
  });

  it('searches across every library category and labels each hit', async () => {
    await renderStudio();
    fireEvent.change(screen.getByLabelText('Search components'), { target: { value: 'closure' } });

    const results = screen.getByRole('group', { name: 'Search results' });
    // The category name is part of the index, so both parts in it are labelled.
    expect(within(results).getAllByText('Splices & Closures')).toHaveLength(2);
    expect(within(results).getByRole('button', { name: /Dome Splice Closure/i })).toBeInTheDocument();
    // The accordion steps aside while a query is active.
    expect(screen.queryByRole('group', { name: 'Component categories' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search components'), { target: { value: 'nonsense' } });
    expect(within(results).getByText(/No components match/)).toBeInTheDocument();
  });

  it('remembers recently used parts as one-click shortcuts', async () => {
    await renderStudio();
    expect(screen.queryByRole('group', { name: 'Recently used components' })).not.toBeInTheDocument();

    openLibraryCategory('Customer / ONT');
    fireEvent.click(screen.getByRole('button', { name: /Wi-Fi 6 Gateway/i }));

    const recent = await screen.findByRole('group', { name: 'Recently used components' });
    expect(within(recent).getByRole('button', { name: 'Recently used: Wi-Fi 6 Gateway' })).toBeInTheDocument();
  });

  it('collapses the library from its header and reopens it from the rail', async () => {
    await renderStudio();
    const library = screen.getByLabelText('Component library');

    fireEvent.click(screen.getByRole('button', { name: 'Hide component library' }));
    expect(library).not.toBeVisible();

    fireEvent.click(within(rail()).getByRole('button', { name: 'Design' }));
    expect(screen.getByLabelText('Component library')).toBeVisible();
  });

  it('drives one splitter card from the ratio selector instead of a list of cards', async () => {
    const { container } = await renderStudio();
    const before = container.querySelectorAll('.react-flow__node').length;

    openLibraryCategory('Splitters');
    const selector = screen.getByRole('group', { name: 'Splitter ratio' });
    const sixteen = within(selector).getByRole('button', { name: 'Splitter ratio 1:16' });
    fireEvent.click(sixteen);

    expect(sixteen).toHaveAttribute('aria-pressed', 'true');
    expect(within(selector).getByRole('button', { name: 'Splitter ratio 1:8' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Picking a ratio is a picker, not a quick-add…
    expect(container.querySelectorAll('.react-flow__node')).toHaveLength(before);

    // …and the single card follows the selector with its insertion loss.
    const library = screen.getByLabelText('Search components').closest('aside') as HTMLElement;
    const cards = library.querySelectorAll('.pu-acc-body .pu-tool');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('1:16');
    expect(cards[0]).toHaveTextContent('13.8 dB insertion loss');

    fireEvent.click(cards[0]);
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(before + 1));
  });
});
