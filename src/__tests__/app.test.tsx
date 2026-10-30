import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { buildPreset } from '../engine/presets';
import { simulateTopology } from '../engine/opticalSimulator';
import { calculateNetworkCost, resolveUnitCosts } from '../data/pricingCatalogue';
import { buildQuotationExport } from '../data/commercialQuoteExports';
import { DEFAULT_SETTINGS, type PonEdge, type PonNode } from '../types';

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

/**
 * The hero carries the same "Launch Studio" label as the fixed navigation, so
 * the suite enters the workbench through the nav, which is always reachable.
 * The hero's own door gets its own test below.
 */
function enterStudioFromNav() {
  const nav = screen.getByRole('navigation', { name: /FiberLAB overview navigation/i });
  fireEvent.click(within(nav).getByRole('button', { name: /^Launch Studio$/i }));
}

/**
 * Earn the hero's studio door: hold the splice with one synthetic frame whose
 * timestamp is past the 2 s hold, then wait for the door to appear.
 */
async function spliceHero() {
  const holdButton = await screen.findByRole('button', { name: /Press and hold to splice the fiber/i });
  const originalRaf = window.requestAnimationFrame;
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now() + 6000), 1) as unknown as number,
  });
  try {
    fireEvent.keyDown(holdButton, { key: ' ' });
    await screen.findByText('SPLICE COMPLETE');
  } finally {
    if (originalRaf) {
      Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalRaf });
    } else {
      Reflect.deleteProperty(window, 'requestAnimationFrame');
    }
  }
}

async function renderStudio() {
  const result = render(<App />);
  enterStudioFromNav();
  await screen.findByRole('button', { name: 'Run Simulation' });
  // The workbench opens on the "Start your network" empty canvas, so load the
  // reference tree the assertions below are written against.
  fireEvent.click(await screen.findByRole('button', { name: 'Standard 1:32 tree' }));
  await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));
  return result;
}

const rail = () => screen.getByRole('navigation', { name: 'Workbench sections' });

/** The landing view stays mounted (inert) behind the studio, so scope to the workbench header. */
const workbenchTopBar = () =>
  screen.getAllByRole('banner').find((element) => element.classList.contains('fiberlab-topbar')) as HTMLElement;

/** Sections are screens: Design, Results and Learn. Settings is a dialog now. */
function openSection(name: 'Design' | 'Results' | 'Learn') {
  fireEvent.click(within(rail()).getByRole('button', { name }));
}

/** Results opens on Summary; the quotation is its third tab. */
function openResultTab(name: 'Summary' | 'Subscribers' | 'Quotation') {
  fireEvent.click(screen.getByRole('tab', { name }));
}

/** The quotation is the third Results tab. */
function openQuotation() {
  openSection('Results');
  openResultTab('Quotation');
}

/** Settings moved from a section to a sheet behind the top bar's More menu. */
function openSettings() {
  fireEvent.click(within(workbenchTopBar()).getByRole('button', { name: 'More' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
}

/** Presets moved from the Design bar into the top bar's More menu. */
function loadPreset(name: string | RegExp) {
  fireEvent.click(within(workbenchTopBar()).getByRole('button', { name: 'More' }));
  fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
  fireEvent.click(screen.getByRole('button', { name }));
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
  openSettings();
  // The canvas toolbar carries a Missions button too, so stay inside the sheet.
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', { name }));
}

/** Detailed values (loss tables, fault switches) hide behind the Details disclosure. */
function expandAdvanced() {
  fireEvent.click(screen.getByRole('button', { name: /^Details/ }));
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
  it('introduces the lab in one screen and earns the studio door by splicing', async () => {
    render(<App />);

    const hero = await screen.findByRole('region', { name: /Splice the fiber/i });
    expect(within(hero).getByRole('heading', { name: /Splice the fiber/i })).toBeInTheDocument();
    expect(
      within(hero).getByText('Build a fiber-to-the-home network and simulate its optical performance.'),
    ).toBeInTheDocument();

    // The optical readout that used to live here belongs to the engineering
    // sections below the hero now, so nothing competes with the headline.
    expect(within(hero).queryByText(/dBm/)).not.toBeInTheDocument();
    expect(within(hero).queryByText('Weakest home')).not.toBeInTheDocument();
    expect(within(hero).queryByText(/Splitter 1:4/)).not.toBeInTheDocument();
    expect(within(hero).queryByRole('button', { name: /Explore Guided Missions/i })).not.toBeInTheDocument();

    // One action, and it is the splice: the studio door is earned.
    expect(within(hero).getByRole('button', { name: /Press and hold to splice the fiber/i })).toHaveTextContent(
      'HOLD TO SPLICE',
    );
    expect(within(hero).queryByRole('button', { name: /^Launch Studio$/i })).not.toBeInTheDocument();

    await spliceHero();

    fireEvent.click(within(hero).getByRole('button', { name: /^Launch Studio$/i }));
    expect(await screen.findByRole('button', { name: 'Run Simulation' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Splice the fiber/i })).not.toBeInTheDocument();

    // Missions sit in the canvas toolbar now; the ⋯ menu keeps the view actions
    // only, and fitting is gone from both.
    const canvasToolbar = screen.getByRole('toolbar', { name: 'Canvas workbench tools' });
    expect(within(canvasToolbar).getByRole('button', { name: 'Missions' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Test' })).toBeInTheDocument();
    openMoreTools();
    expect(screen.getByRole('button', { name: 'Zoom to 100%' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fit view to screen' })).not.toBeInTheDocument();
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
    enterStudioFromNav();
    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));
    expect(screen.getByRole('region', { name: 'Field hardware reference' })).toBeInTheDocument();
  });

  it('opens the workbench on an empty canvas with a friendly mission hint', async () => {
    render(<App />);
    enterStudioFromNav();
    await screen.findByRole('button', { name: 'Run Simulation' });

    expect(await screen.findByText('Start your network')).toBeInTheDocument();
    expect(screen.queryByText('Al-Sulaymaniyah — Unit 12')).not.toBeInTheDocument();
    expect(screen.getByText(/Drop parts from the library, or begin from a working design/)).toBeInTheDocument();
    // Three ways in, no fourth.
    expect(screen.getByRole('button', { name: /Standard 1:32 tree/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guided mission/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import topology/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Guided mission/ }));
    expect(await screen.findByRole('dialog', { name: 'Field missions' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Field missions' })).not.toBeInTheDocument());

    // The hint is a nudge, not furniture: it can be dismissed.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss canvas hint' }));
    expect(screen.queryByText('Start your network')).not.toBeInTheDocument();
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
    for (const label of ['OLT / Headend', 'Fiber Cables', 'Splitters', 'Splices & Closures', 'Customer / ONT']) {
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
    // OLT + ODF, four cable cards (three single-mode + OM3 + OM4 = five in the
    // fiber section), one splitter card, closure + NAP + attenuator, ONT +
    // gateway. The multi-mode cards and the attenuator pad are deliberate
    // additions in the component-ecosystem task, so the library grew by two.
    expect(thumbnails).toBe(9);
  });

  it('drags a toolbox component onto the React Flow canvas', async () => {
    const { container } = render(<App />);
    enterStudioFromNav();
    fireEvent.click(await screen.findByRole('button', { name: 'Standard 1:32 tree' }));
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
    enterStudioFromNav();
    fireEvent.click(await screen.findByRole('button', { name: 'Standard 1:32 tree' }));
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    expect(statusToggle()).toHaveAccessibleName(/Network status: Warning\./);

    const oltNode = getCanvasNodeByText('OLT');
    const feederNode = getCanvasNodeByText(/^5\.0 km$/);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    expect(screen.getByText(/Select a source node, then a destination/i)).toBeInTheDocument();
    fireEvent.click(oltNode);
    expect(screen.getByText(/Source: olt-a/)).toBeInTheDocument();
    fireEvent.click(feederNode);
    await waitFor(() =>
      // Bypassing the splitter leaves every subscriber with no path: Disconnected, not LOS.
      expect(within(statusBar()).getByRole('button', { name: /Network status: Disconnected\./ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(oltNode);
    fireEvent.click(feederNode);
    await waitFor(() =>
      expect(within(statusBar()).getByRole('button', { name: /Network status: Warning\./ })).toBeInTheDocument(),
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

    // Four values, no more: status, loss + margin, total distance, subscribers OK.
    const bar = statusBar();
    expect(within(bar).getByText('Warning')).toBeInTheDocument();
    expect(within(bar).getByText('Loss + margin')).toBeInTheDocument();
    expect(within(bar).getByText('Fiber on canvas')).toBeInTheDocument();
    expect(within(bar).getByText('13.5 km')).toBeInTheDocument();
    const subscribers = within(bar).getByText('Subscribers online').closest('.pu-sb-item') as HTMLElement;
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
    openQuotation();
    // Reports is a lazily loaded chunk now, so the first paint may be the
    // suspense fallback while the module downloads.
    const capexAfterOpen = await screen.findByTestId('capex-telemetry');
    expect(capexAfterOpen).toHaveTextContent('CAPEX $3,747');
    expect(capexAfterOpen).toHaveTextContent('$1,249.00 / Home Passed');
    openSection('Design');
  });

  it('opens the Bill of Materials with reconciling totals', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    openQuotation();

    expect(await screen.findByText('Optical audit & commercial CAPEX quotation')).toBeInTheDocument();
    // The quotation is a tab under Results, and it opens on the commercial view.
    expect(screen.getByRole('tab', { name: 'Quotation' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Commercial quotation and CAPEX' })).toBeInTheDocument();
    expect(screen.getByText('Total Project CAPEX')).toBeInTheDocument();
    expect(screen.queryByText('Dukan Ridge — Tower 7')).not.toBeInTheDocument();

    openSection('Design');
    expect(screen.queryByText('Optical audit & commercial CAPEX quotation')).not.toBeInTheDocument();
  });

  it('edits local USD pricing in the Bill of Materials without changing optical status', async () => {
    await renderStudio();
    openQuotation();
    const capexBadge = await screen.findByTestId('capex-telemetry');
    expect(capexBadge).toHaveTextContent('$3,747');
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
    expect(statusToggle()).toHaveAccessibleName(/Network status: Warning\./);
  });

  it('shows a commercial quotation tab with reconciling material and labor totals', async () => {
    await renderStudio();
    openQuotation();

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

    // Clearing is two-step now: ask, then act.
    useSettingsAction(/Clear Canvas/i);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear canvas' }));

    // Clearing hands the empty canvas back to the user.
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(screen.queryByText('Al-Sulaymaniyah — Unit 12')).not.toBeInTheDocument();
    expect(await screen.findByText('Start your network')).toBeInTheDocument();
  });

  it('opens a field mission, loads its scenario, and tracks objectives live', async () => {
    await renderStudio();

    useSettingsAction(/^Missions$/i);
    expect(await screen.findByRole('dialog', { name: 'Field missions' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start mission' }));

    expect(await screen.findByText('2/3 complete')).toBeInTheDocument();
    const missionsDrawer = screen.getByRole('dialog', { name: 'Field missions' });
    expect(
      within(missionsDrawer).getByText(/Bring all three connected ONTs into the ONLINE window/),
    ).toBeInTheDocument();
    // The same progress is on the canvas now, without opening the drawer.
    expect(screen.getByTestId('mission-bar')).toHaveTextContent('2/3 done');
    expect(screen.getByText('Mission active')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Mission objective progress' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Field missions' })).not.toBeInTheDocument();

    // The canvas toolbar names the running mission; the bar shows its progress.
    expect(screen.getByRole('button', { name: 'Missions, active: The Marginal Villa' })).toBeInTheDocument();
    expect(screen.getByTestId('mission-bar')).toHaveTextContent('The Marginal Villa');
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
    openQuotation();
    expect(await screen.findByTestId('capex-telemetry')).toHaveTextContent('$3,747');
    openSection('Design');
  });

  it('acquires an interactive OTDR trace from the studio and lists terminal Fresnel events', async () => {
    await renderStudio();
    useSettingsAction('OTDR Trace');
    // The analyser arrives in its own chunk; wait for the dialog itself.
    expect(await screen.findByRole('dialog', { name: 'OTDR Trace Analyzer' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'OTDR source node' })).toHaveValue('olt-a');
    expect(screen.getByRole('combobox', { name: 'OTDR target subscriber' })).toHaveValue('ont-a1');

    fireEvent.click(screen.getByRole('button', { name: 'Acquire trace' }));
    expect(screen.getByRole('button', { name: /Acquiring trace/ })).toBeDisabled();
    const eventTable = screen.getByRole('table', { name: 'OTDR detected events' });
    await waitFor(() => expect(within(eventTable).getByText('End of fiber')).toBeInTheDocument(), { timeout: 2000 });
    expect(within(eventTable).getByText('+4.00 dB')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /OTDR backscatter trace/ })).toBeInTheDocument();
  });

  it('loads the failing long-haul preset and turns the health strip red', async () => {
    await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    loadPreset(/Failing Long-Distance Link/);

    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));
    expect(statusToggle()).toHaveAccessibleName(/Network status: LOS\./);

    const ont = getCanvasNodeByText('Dukan Ridge — Tower 7').querySelector('.hw-onu');
    expect(within(ont as HTMLElement).getByText(/LOS/)).toBeInTheDocument();
    expect(within(ont as HTMLElement).getByText('-39.5 dBm')).toBeInTheDocument();
  });

  it('selects the modern XGS-PON suburb preset and exposes live gateway service and hardware details', async () => {
    await renderStudio();
    loadPreset(/MODERN 10G XGS-PON SUBURB/i);

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

    openSection('Results');
    const upstreamCard = (await screen.findByText('Upstream Δ')).closest('.pu-stat-card') as HTMLElement;
    expect(upstreamCard).toHaveTextContent('dB');
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

    // Realistic PLC Splitter hardware card. The canvas shows the part and its
    // ratio only — measurements live in the Inspector that a click opens.
    const splitterNode = getCanvasNodeByText('PLC Splitter 1:8').querySelector('.hw-spl');
    expect(splitterNode).not.toBeNull();
    expect(splitterNode).toHaveTextContent('PLC Splitter 1:8');
    expect(splitterNode?.querySelectorAll('small')).toHaveLength(0);

    // The dotted ground is part of the canvas: React Flow's background layer
    // draws the dot pattern, and no stylesheet may paint over it.
    const dotPattern = document.querySelector('.react-flow__background pattern circle');
    expect(dotPattern).not.toBeNull();
    expect(dotPattern).toHaveClass('react-flow__background-pattern', 'dots');

    // Floating canvas sub-toolbar
    const canvasToolbar = screen.getByRole('toolbar', { name: 'Canvas workbench tools' });
    expect(within(canvasToolbar).getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Pan' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Link nodes' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Delete selected elements' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'Missions' })).toBeInTheDocument();
    expect(within(canvasToolbar).queryByRole('button', { name: 'Fit View' })).not.toBeInTheDocument();
    // Adding components lives in the library; the overflow keeps everything else.
    expect(within(canvasToolbar).queryByRole('button', { name: 'Add Node' })).not.toBeInTheDocument();
    expect(within(canvasToolbar).getByRole('button', { name: 'More tools' })).toBeInTheDocument();

    // A slim status bar replaces the old Components/Topology tabs.
    const bar = statusBar();
    expect(within(bar).getByText('Fiber on canvas')).toBeInTheDocument();
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

  it('keeps the top bar to one row: project, save state, undo/redo, zoom, More and Run', async () => {
    await renderStudio();
    const banner = workbenchTopBar();

    expect(within(banner).getByRole('button', { name: 'Overview & Physics' })).toBeInTheDocument();
    // The project name is editable in place and says whether it is saved.
    expect(within(banner).getByLabelText('Project name')).toHaveValue('Standard 1:32 GPON Tree');
    expect(within(banner).getByRole('status')).toHaveTextContent(/Saved|Saving/);
    expect(within(banner).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Redo' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Zoom' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Run Simulation' })).toBeInTheDocument();

    // Presets live one level down in More; the network colour lives in the status bar.
    expect(within(banner).queryByLabelText(/Network health/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Preset Topologies/i })).not.toBeInTheDocument();
  });

  it('switches between the Design, Results and Learn screens, with Settings as a sheet', async () => {
    await renderStudio();
    expect(within(rail()).getByRole('button', { name: 'Design' })).toHaveAttribute('aria-current', 'page');

    openSection('Results');
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('OLT Launch')).toBeInTheDocument();
    expect(screen.getByText('13.5 km')).toBeInTheDocument();

    openResultTab('Subscribers');
    expect(screen.getByRole('table', { name: 'Subscriber optical results' })).toBeInTheDocument();

    // A row is a shortcut back to that component on the canvas.
    fireEvent.click(screen.getByRole('button', { name: /Show Al-Sulaymaniyah — Unit 12 on the canvas/ }));
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Inspector sections' })).toBeInTheDocument();

    openSettings();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Global safety margin' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Auto-run' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));

    openQuotation();
    expect(screen.getByRole('heading', { name: 'Bill of Materials' })).toBeInTheDocument();
    expect(screen.getByTestId('capex-telemetry')).toHaveTextContent('CAPEX $3,747');

    openSection('Learn');
    expect(screen.getByRole('heading', { name: 'Learn' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fault-finding' })).toBeInTheDocument();
  });

  it('returns from Results with Escape or the browser back gesture', async () => {
    await renderStudio();
    openQuotation();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bill of Materials' })).not.toBeInTheDocument();

    // Escape is the keyboard's way back.
    openQuotation();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Bill of Materials' })).not.toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument();

    // The browser Back button and the phone back gesture walk the same steps.
    openQuotation();
    window.history.back();
    await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Canvas workbench tools' })).toBeInTheDocument());
  });

  it('moves keyboard focus to the heading of the section that opens', async () => {
    await renderStudio();

    openSection('Results');
    expect(screen.getByRole('heading', { level: 1, name: 'Results' })).toHaveFocus();

    openSettings();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));

    openSection('Design');
    expect(screen.getByRole('heading', { level: 1, name: 'Design canvas' })).toHaveFocus();
  });

  it('gives Results one h1, tab panels, and tables that scroll inside their own box', async () => {
    await renderStudio();
    openQuotation();

    const results = screen.getByRole('region', { name: 'Results' });
    expect(within(results).getByRole('heading', { level: 1, name: 'Results' })).toBeInTheDocument();
    // The quotation is embedded, so it titles itself at h2 under Results.
    expect(within(results).getByRole('heading', { level: 2, name: 'Bill of Materials' })).toBeInTheDocument();
    expect(
      within(results).getByRole('heading', { level: 2, name: 'Commercial quotation & CAPEX' }),
    ).toBeInTheDocument();

    const quotationTable = screen.getByTestId('quotation-line-items');
    expect(quotationTable.parentElement).toHaveClass('overflow-x-auto');

    openResultTab('Subscribers');
    const subscriberTable = screen.getByRole('table', { name: 'Subscriber optical results' });
    expect(subscriberTable.parentElement).toHaveClass('pu-sim-table-wrap');
  });

  it('keeps the URL hash while the sections move', async () => {
    window.location.hash = '#reference';
    await renderStudio();

    openQuotation();
    expect(window.location.hash).toBe('#reference');
    openSettings();
    expect(window.location.hash).toBe('#reference');
    openSection('Design');
    expect(window.location.hash).toBe('#reference');

    window.history.replaceState({}, '', window.location.pathname);
  });

  it('offers the same three sections in the phone tab bar', async () => {
    await renderStudio();
    const tabs = screen.getByRole('navigation', { name: 'Sections' });

    expect(
      within(tabs)
        .getAllByRole('button')
        .map((tab) => tab.getAttribute('aria-label')),
    ).toEqual(['Design', 'Results', 'Learn']);

    fireEvent.click(within(tabs).getByRole('button', { name: 'Results' }));
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(within(tabs).getByRole('button', { name: 'Results' })).toHaveAttribute('aria-current', 'page');
  });

  it('remembers a dismissed empty-state hint across a reload', async () => {
    window.localStorage.clear();
    const { unmount } = render(<App />);
    enterStudioFromNav();
    await screen.findByRole('button', { name: 'Run Simulation' });

    // The hint is a nudge, not furniture: it can be dismissed.
    expect(await screen.findByText('Start your network')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss canvas hint' }));
    expect(screen.queryByText('Start your network')).not.toBeInTheDocument();

    // The dismissal is part of the saved workspace, so a reload stays clean.
    await waitFor(() => expect(window.localStorage.getItem('fiberlab.workspace.v1')).not.toBeNull(), {
      timeout: 2000,
    });
    unmount();
    render(<App />);
    enterStudioFromNav();
    await screen.findByRole('button', { name: 'Run Simulation' });
    expect(screen.queryByText('Start your network')).not.toBeInTheDocument();
  });

  it('opens Results and its quotation as a section, not a dialog', async () => {
    await renderStudio();
    const resultsTab = within(rail()).getByRole('button', { name: 'Results' });
    fireEvent.click(resultsTab);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument();
    expect(resultsTab).toHaveAttribute('aria-current', 'page');
    // Design chrome unmounts while another section is in charge.
    expect(screen.queryByRole('toolbar', { name: 'Canvas workbench tools' })).not.toBeInTheDocument();

    openResultTab('Quotation');
    expect(screen.getByRole('heading', { name: 'Bill of Materials' })).toBeInTheDocument();

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

    expect(labels).toEqual(['Zoom to 100%']);
    expect(labels).not.toContain('Fit view to screen');
    expect(within(menu).getByRole('switch', { name: 'Snap to grid' })).toBeInTheDocument();
    // Everything that configures the app moved to Settings instead.
    for (const moved of ['Overview & Physics', 'OPM Tool', 'OTDR Trace', 'Missions', 'Clear Canvas']) {
      expect(within(menu).queryByRole('button', { name: moved })).not.toBeInTheDocument();
    }
    expect(within(menu).queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('marks a keyboard-deleted element as an edit and clears the selection', async () => {
    const { container } = render(<App />);
    enterStudioFromNav();
    await screen.findByRole('button', { name: 'Run Simulation' });
    fireEvent.click(await screen.findByRole('button', { name: 'Standard 1:32 tree' }));

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

    loadPreset(/Failing Long-Distance Link/);
    await waitFor(() => expect(screen.getAllByText('Dukan Ridge — Tower 7').length).toBeGreaterThan(0));

    const splitter = getCanvasNodeByText('PLC Splitter 1:32');
    const outputs = splitter.querySelectorAll<HTMLElement>('.react-flow__handle[data-handleid^="out-"]');
    expect(outputs).toHaveLength(16);

    // Every port sits on one axis: the input lines up with the middle of the
    // branch fan, which is also where the cassette's own stub is drawn.
    const input = splitter.querySelector<HTMLElement>('.react-flow__handle[data-handleid="in"]') as HTMLElement;
    const tops = Array.from(outputs).map((handle) => parseFloat(handle.style.top));
    const inputTop = parseFloat(input.style.top);
    expect(inputTop).toBeCloseTo((Math.min(...tops) + Math.max(...tops)) / 2, 1);
    // Symmetric fan, one even step at a time.
    const steps = tops.slice(1).map((top, index) => top - tops[index]);
    expect(new Set(steps.map((step) => step.toFixed(2))).size).toBe(1);
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(15);

    // The trunking explanation is the Inspector's job, not the canvas's.
    expect(within(splitter).queryByText(/rest trunked/i)).not.toBeInTheDocument();
    fireEvent.click(splitter);
    expandAdvanced();
    expect(screen.getByText(/remaining fan-out stays a ribbon trunk/i)).toBeInTheDocument();
  });

  it('keeps loss tables and allowances folded behind Details until asked', async () => {
    await renderStudio();
    fireEvent.click(getCanvasNodeByText('PLC Splitter 1:8'));

    // Essentials first: the ratio and its insertion loss.
    expect(screen.getByRole('combobox', { name: 'Split ratio' })).toHaveValue('8');
    expect(screen.getByText('Insertion loss')).toBeInTheDocument();
    const advanced = screen.getByRole('button', { name: /^Details/ });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Excess / uniformity loss')).not.toBeInTheDocument();
    expect(screen.getByText(/Guided view shows the essentials/)).toBeInTheDocument();

    expandAdvanced();
    expect(advanced).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Excess / uniformity loss')).toBeInTheDocument();
    expect(screen.getByText('Total modeled insertion loss')).toBeInTheDocument();
  });

  it('switches between Guided and Engineer detail levels from the top bar chip', async () => {
    await renderStudio();
    const banner = workbenchTopBar();
    const chip = within(banner).getByRole('button', { name: /^Detail level: Guided$/ });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(getCanvasNodeByText('PLC Splitter 1:8'));
    // Guided hides the loss tables and explains why.
    expect(screen.getByText(/Guided view shows the essentials/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Details/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));

    fireEvent.click(within(banner).getByRole('button', { name: /^Detail level: Guided$/ }));
    expect(within(banner).getByRole('button', { name: /^Detail level: Engineer$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(getCanvasNodeByText('PLC Splitter 1:8'));
    // Engineer opens the same table without being asked.
    expect(screen.queryByText(/Guided view shows the essentials/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Details/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Excess / uniformity loss')).toBeInTheDocument();
  });

  it('defines a term once in the glossary and links it from the inspector', async () => {
    await renderStudio();
    fireEvent.click(getCanvasNodeByText('Al-Sulaymaniyah — Unit 12'));
    fireEvent.click(screen.getByRole('tab', { name: 'Optical Power' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'What is Margin to LOS?' })[0]);
    expect(screen.getByRole('note')).toHaveTextContent(/closer to dropping out/i);

    // The same sentence is on the Learn screen, not a second copy of it.
    fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
    openSection('Learn');
    const glossary = screen.getByRole('heading', { name: 'Glossary' }).closest('.pu-screen-card') as HTMLElement;
    expect(within(glossary).getByText('Margin to LOS')).toBeInTheDocument();
    expect(within(glossary).getByText(/closer to dropping out/i)).toBeInTheDocument();
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
    // The category name is part of the index, so a hit is labelled once per
    // match. The section now holds closure, NAP/FAT and the attenuator pad.
    expect(within(results).getAllByText('Splices & Closures')).toHaveLength(3);
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

  it('adds the multi-mode span and the attenuator pad from the component library', async () => {
    const { container } = await renderStudio();
    const before = container.querySelectorAll('.react-flow__node').length;

    openLibraryCategory('Fiber Cables');
    const cableSelector = screen.getByRole('group', { name: 'Cable type' });
    const om4 = within(cableSelector).getByRole('button', { name: 'Cable type multi-mode OM4' });
    fireEvent.click(om4);
    expect(om4).toHaveAttribute('aria-pressed', 'true');

    const library = screen.getByLabelText('Search components').closest('aside') as HTMLElement;
    const cableCard = library.querySelectorAll('.pu-acc-body .pu-tool');
    expect(cableCard).toHaveLength(1);
    expect(cableCard[0]).toHaveTextContent('Multi-mode OM4');
    fireEvent.click(cableCard[0]);
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(before + 1));

    // The canvas pill carries the OM4 tag, and the inspector exposes the glass.
    expect(container.querySelector('.hw-fiber.is-multimode')).not.toBeNull();
    expect(screen.getByLabelText('Fiber profile')).toHaveValue('om4');

    openLibraryCategory('Splices & Closures');
    fireEvent.click(within(library).getByRole('button', { name: /Attenuator Pad/i }));
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(before + 2));

    expect(screen.getByLabelText('Pad value')).toHaveValue('5');
    expect(screen.getByRole('combobox', { name: 'Attenuator polish' })).toHaveValue('SC/APC');
    expect(screen.getByText('Inline pad · 5 dB fixed')).toBeInTheDocument();
  });

  it('honours the V and H shortcuts its own tooltips advertise', async () => {
    await renderStudio();
    const toolbar = screen.getByRole('toolbar', { name: 'Canvas workbench tools' });
    const select = within(toolbar).getByRole('button', { name: 'Select' });
    const pan = within(toolbar).getByRole('button', { name: 'Pan' });

    expect(select).toHaveAttribute('aria-pressed', 'true');
    expect(select.getAttribute('title')).toContain('(V)');
    expect(pan.getAttribute('title')).toContain('(H)');

    fireEvent.keyDown(document, { key: 'h' });
    await waitFor(() => expect(pan).toHaveAttribute('aria-pressed', 'true'));
    expect(select).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(document, { key: 'v' });
    await waitFor(() => expect(select).toHaveAttribute('aria-pressed', 'true'));
  });

  it('shows path loss, safety margin and the total as three separate rows', async () => {
    await renderStudio();
    openSection('Results');
    expect(within(document.body).getByText('Loss + margin')).toBeInTheDocument();
    expect(within(document.body).getByText('Path loss · worst subscriber')).toBeInTheDocument();
    expect(within(document.body).getByText('Safety margin · design allowance')).toBeInTheDocument();
    expect(within(document.body).getByText('Total · loss + margin')).toBeInTheDocument();
  });

  it('never turns a mistyped span length into zero kilometres', async () => {
    await renderStudio();
    const feeder = getCanvasNodeByText(/^5\.0 km$/);
    fireEvent.click(feeder);

    const lengthInput = await screen.findByLabelText('Span length (km)');
    expect(lengthInput).toHaveValue(5);

    fireEvent.change(lengthInput, { target: { value: '12.5' } });
    await waitFor(() => expect(lengthInput).toHaveValue(12.5));

    // A cleared or non-numeric field must keep the last good length.
    fireEvent.change(lengthInput, { target: { value: '' } });
    fireEvent.change(lengthInput, { target: { value: 'abc' } });
    expect(lengthInput).toHaveValue(12.5);
  });

  it('keeps the design in this browser across a remount', async () => {
    const { unmount } = await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    // The write is debounced, so give it a beat before the "reload".
    await waitFor(() => expect(window.localStorage.getItem('fiberlab.workspace.v1')).not.toBeNull(), {
      timeout: 2000,
    });

    unmount();
    render(<App />);
    enterStudioFromNav();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));
    expect(screen.queryByText('Start your network')).not.toBeInTheDocument();
  });

  it('undoes and redoes a canvas edit with Ctrl+Z and Ctrl+Shift+Z', async () => {
    await renderStudio();
    const feeder = getCanvasNodeByText(/^5\.0 km$/);
    fireEvent.click(feeder);

    const deleteButton = screen.getByRole('button', { name: 'Delete selected elements' });
    await waitFor(() => expect(deleteButton).toBeEnabled());
    fireEvent.click(deleteButton);
    await waitFor(() => expect(screen.queryByText(/^5\.0 km$/)).not.toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(screen.getByText(/^5\.0 km$/)).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'z', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(screen.queryByText(/^5\.0 km$/)).not.toBeInTheDocument());
  });

  it('imports a topology JSON exported from Reports', async () => {
    const { container } = await renderStudio();
    await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));

    // Build a document from the failing preset, then feed it back in.
    const { nodes, edges } = buildPreset('failing-long-haul') as { nodes: PonNode[]; edges: PonEdge[] };
    const simulation = simulateTopology(nodes, edges, DEFAULT_SETTINGS, 4321);
    const cost = calculateNetworkCost(nodes, edges);
    const document = buildQuotationExport(nodes, edges, simulation, DEFAULT_SETTINGS, resolveUnitCosts(), cost);

    openSettings();
    const fileInput = screen.getByLabelText('Topology JSON file') as HTMLInputElement;
    const file = new File([JSON.stringify(document)], 'failing.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Imported failing.json.')).toBeInTheDocument());
    openSection('Design');
    await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
    expect(screen.queryByText('Al-Sulaymaniyah — Unit 12')).not.toBeInTheDocument();
  });
});
