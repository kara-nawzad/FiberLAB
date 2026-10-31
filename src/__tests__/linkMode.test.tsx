import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';

/* ========================================================================== *
 * Tap-to-patch on touch hardware.
 *
 * A phone has no hover and no mouse drag, so linking two components has to be
 * "Connect, tap the source, tap the destination". Two things made that fail:
 * the first tap also *selected* the node, which opens the properties sheet over
 * the canvas on a phone, and every patch silently dropped out of link mode.
 *
 * A 1:4 splitter was also reported as only accepting three branches. It exposes
 * four (out-0 … out-3); what happened was two drops landing on the same output
 * handle, which replaces the earlier cord. Staying armed on a branching source
 * makes the intended one-tap-per-branch flow possible, and this test pins both
 * the four-port model and the flow.
 *
 * Tapping a *port* is now the fast path: tap the output point, tap the other
 * point, the cord is there — the note names both ports. Tapping the body of a
 * component still works and lets link mode choose the next free port.
 * ========================================================================== */

type ExportedCord = {
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
};

/**
 * The live graph, read the way a user can: through the Quotation JSON export.
 * The workspace is session-only now, so there is no storage document to inspect,
 * and jsdom gives React Flow no node geometry (so the SVG edges never mount).
 * The export carries the real `sourceHandle` / `targetHandle` of every cord.
 */
async function exportedCords(): Promise<ExportedCord[]> {
  const blobs: Blob[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      blobs.push(blob);
      return 'blob:cords';
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
  // Keep jsdom from trying to navigate to the blob URL.
  HTMLAnchorElement.prototype.click = () => {};
  try {
    const rail = screen.getByRole('navigation', { name: 'Workbench sections' });
    fireEvent.click(within(rail).getByRole('button', { name: 'Results' }));
    fireEvent.click(await screen.findByRole('tab', { name: 'Quotation' }));
    fireEvent.click(await screen.findByRole('button', { name: /Quote JSON/ }));
    expect(blobs).toHaveLength(1);
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error as Error);
      reader.readAsText(blobs[0]);
    });
    return (JSON.parse(text) as { edges: ExportedCord[] }).edges;
  } finally {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreate });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevoke });
    HTMLAnchorElement.prototype.click = originalClick;
  }
}

/** Cords leaving one component, keyed by the output port they use. */
const sourceHandlesOf = (cords: ExportedCord[], nodeId: string) =>
  cords
    .filter((edge) => edge.source === nodeId)
    .map((edge) => edge.sourceHandle)
    .sort();

/** The cord joining two components, or undefined. */
const cordBetween = (cords: ExportedCord[], sourceId: string, targetId: string) =>
  cords.find((edge) => edge.source === sourceId && edge.target === targetId);

function enterStudio() {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: /FiberLAB overview navigation/i })).getByRole('button', {
      name: /^Launch Studio$/i,
    }),
  );
}

async function startFromPreset() {
  const { container } = render(<App />);
  enterStudio();
  fireEvent.click(await screen.findByRole('button', { name: 'Standard 1:32 tree' }));
  await waitFor(() => expect(screen.getAllByText('Al-Sulaymaniyah — Unit 12').length).toBeGreaterThan(0));
  return container;
}

/** Opens a library category (the sheet is an accordion, one section at a time). */
function openCategory(category: string, ratio?: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${category}`) }));
  if (ratio) {
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Splitter ratio' })).getByRole('button', {
        name: `Splitter ratio ${ratio}`,
      }),
    );
  }
}

/** Quick-adds the section's card once and returns the node id that appeared. */
async function addCard(container: HTMLElement): Promise<string> {
  const before = new Set([...container.querySelectorAll('.react-flow__node')].map((n) => n.getAttribute('data-id')));
  const library = screen.getByLabelText('Search components').closest('aside') as HTMLElement;
  fireEvent.click(library.querySelector('.pu-acc-body .pu-tool') as HTMLElement);
  await waitFor(() => expect(container.querySelectorAll('.react-flow__node').length).toBe(before.size + 1));
  const added = [...container.querySelectorAll('.react-flow__node')]
    .map((n) => n.getAttribute('data-id')!)
    .filter((id) => !before.has(id));
  return added[0];
}

const nodeById = (container: HTMLElement, id: string) => container.querySelector(`[data-id="${id}"]`) as HTMLElement;

describe('link mode as a tap-to-patch tool', () => {
  it('patches four branches from one 1:4 splitter without reopening the mode', async () => {
    const container = await startFromPreset();

    openCategory('Splitters', '1:4');
    const splitterId = await addCard(container);

    openCategory('Customer / ONT');
    const ontIds: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      ontIds.push(await addCard(container));
    }

    // One 1:4 cassette exposes exactly four patchable branches.
    expect(nodeById(container, splitterId).querySelectorAll('.react-flow__handle-right')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(nodeById(container, splitterId));
    expect(screen.getByText(/Source: PLC splitter 1:4/)).toBeInTheDocument();
    expect(nodeById(container, splitterId)).toHaveClass('is-link-source');

    // Every destination is one tap: the mode stays armed on the splitter.
    for (const [index, ontId] of ontIds.entries()) {
      fireEvent.click(nodeById(container, ontId));
      const progress = index + 1;
      if (progress < 4) {
        expect(screen.getByText(new RegExp(`${progress} of 4 branches patched`))).toBeInTheDocument();
      } else {
        // Nothing left to patch: the message says so rather than inviting a tap.
        expect(screen.getByText(/All 4 branches are patched/)).toBeInTheDocument();
      }
    }

    // Each tap must land on its own output port: no repeats, no replacements.
    expect(sourceHandlesOf(await exportedCords(), splitterId)).toEqual(['out-0', 'out-1', 'out-2', 'out-3']);
  }, 60_000);

  it('never opens the properties sheet while the user is patching', async () => {
    const container = await startFromPreset();

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(getCanvasNode(container, 'OLT'));
    fireEvent.click(getCanvasNode(container, /^5\.0 km$/));

    expect(screen.queryByRole('tablist', { name: 'Inspector sections' })).not.toBeInTheDocument();
    expect(screen.queryByText('Selected Component')).not.toBeInTheDocument();
  });

  it('leaves link mode after a single-cord pair so the next tap selects again', async () => {
    const container = await startFromPreset();

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(getCanvasNode(container, 'OLT'));
    fireEvent.click(getCanvasNode(container, /^5\.0 km$/));

    // A cable span has one output: the pair is complete, so the tool disarms.
    await waitFor(() => expect(screen.queryByText(/Now choose the destination/)).not.toBeInTheDocument());
    expect(screen.queryByText(/branches patched/)).not.toBeInTheDocument();
  });

  it('patches the two ports that were tapped, without a component selection in between', async () => {
    const container = await startFromPreset();

    openCategory('Splitters', '1:4');
    const splitterId = await addCard(container);
    openCategory('Customer / ONT');
    const ontId = await addCard(container);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));

    // Tap the third output point, then the subscriber's input point.
    fireEvent.click(port(nodeById(container, splitterId), 'out-2'));
    expect(screen.getByText(/Source: PLC splitter 1:4 · OUT 3/)).toBeInTheDocument();
    expect(port(nodeById(container, splitterId), 'out-2')).toHaveClass('is-link-anchor');

    fireEvent.click(port(nodeById(container, ontId), 'in'));

    // The note is the receipt: both ends are named with the ports that were used.
    expect(screen.getByText(/Patched PLC splitter 1:4 \(OUT 3\) → .* \(IN\)/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Inspector sections' })).not.toBeInTheDocument();
    expect(screen.queryByText('Selected Component')).not.toBeInTheDocument();

    const cords = await exportedCords();
    const cord = cordBetween(cords, splitterId, ontId);
    expect(cord).toBeDefined();
    expect(cord?.sourceHandle).toBe('out-2');
    expect(cord?.targetHandle).toBe('in');
    // The exact pair tapped, and nothing else was patched on the way.
    expect(sourceHandlesOf(cords, splitterId)).toEqual(['out-2']);
  }, 60_000);

  it('patches a port pair tapped destination-first', async () => {
    const container = await startFromPreset();

    openCategory('Splitters', '1:4');
    const splitterId = await addCard(container);
    openCategory('Customer / ONT');
    const ontId = await addCard(container);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));

    // Aim at the subscriber first: the mode adapts instead of refusing.
    fireEvent.click(port(nodeById(container, ontId), 'in'));
    expect(screen.getByText(/Destination: .* · IN\./)).toBeInTheDocument();
    fireEvent.click(port(nodeById(container, splitterId), 'out-1'));

    const cord = cordBetween(await exportedCords(), splitterId, ontId);
    expect(cord?.sourceHandle).toBe('out-1');
    expect(cord?.targetHandle).toBe('in');
  }, 60_000);

  it('keeps one tap per branch when the ports are tapped instead of the bodies', async () => {
    const container = await startFromPreset();

    openCategory('Splitters', '1:4');
    const splitterId = await addCard(container);
    openCategory('Customer / ONT');
    const ontIds: string[] = [];
    for (let index = 0; index < 3; index += 1) ontIds.push(await addCard(container));

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(port(nodeById(container, splitterId), 'out-0'));

    // After a branch lands, the splitter stays armed, so each further drop is
    // one tap on its own input port and takes the next free output.
    for (const [index, ontId] of ontIds.entries()) {
      fireEvent.click(port(nodeById(container, ontId), 'in'));
      const progress = index + 1;
      expect(screen.getByText(new RegExp(`${progress} of 4 branches patched`))).toBeInTheDocument();
    }

    expect(sourceHandlesOf(await exportedCords(), splitterId)).toEqual(['out-0', 'out-1', 'out-2']);
  }, 60_000);

  it('moves a port tap to the newest point when both taps are the same end', async () => {
    const container = await startFromPreset();

    openCategory('Splitters', '1:4');
    const splitterId = await addCard(container);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(port(nodeById(container, splitterId), 'out-0'));
    fireEvent.click(port(nodeById(container, splitterId), 'out-1'));

    // A second output is a change of mind about the source, not an error.
    expect(screen.getByText(/Source: PLC splitter 1:4 · OUT 2/)).toBeInTheDocument();
    expect(port(nodeById(container, splitterId), 'out-1')).toHaveClass('is-link-anchor');
  }, 60_000);

  it('pairs a tapped port with a tapped component body, in either order', async () => {
    const container = await startFromPreset();

    openCategory('Splitters', '1:4');
    const splitterId = await addCard(container);
    openCategory('Customer / ONT');
    const ontId = await addCard(container);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));

    // Point first, then the body: the body tap takes the free input port.
    fireEvent.click(port(nodeById(container, splitterId), 'out-0'));
    fireEvent.click(nodeById(container, ontId));

    const cord = cordBetween(await exportedCords(), splitterId, ontId);
    expect(cord?.sourceHandle).toBe('out-0');
    expect(cord?.targetHandle).toBe('in');
  }, 60_000);

  it('removes the cord when its two ports are tapped again', async () => {
    const container = await startFromPreset();

    openCategory('Splitters', '1:4');
    const splitterId = await addCard(container);
    openCategory('Customer / ONT');
    const ontId = await addCard(container);

    fireEvent.click(screen.getByRole('button', { name: 'Link nodes' }));
    fireEvent.click(port(nodeById(container, splitterId), 'out-1'));
    fireEvent.click(port(nodeById(container, ontId), 'in'));

    // The same two points again undo it, and say so. The splitter stays armed
    // after a branch lands, so tapping its output pins that exact port again.
    fireEvent.click(port(nodeById(container, splitterId), 'out-1'));
    fireEvent.click(port(nodeById(container, ontId), 'in'));

    // Removing the pair leaves the tool, exactly as the body-tap flow does.
    await waitFor(() => expect(screen.queryByText(/branches patched/)).not.toBeInTheDocument());
    expect(cordBetween(await exportedCords(), splitterId, ontId)).toBeUndefined();
  }, 60_000);

  it('does not open the properties sheet for a component that was dragged', async () => {
    const container = await startFromPreset();
    const olt = getCanvasNode(container, 'OLT');

    // A press, a real movement, then the click the browser delivers anyway.
    fireEvent.pointerDown(olt, { clientX: 300, clientY: 300 });
    fireEvent.pointerMove(olt, { clientX: 348, clientY: 342 });
    fireEvent.pointerUp(olt, { clientX: 348, clientY: 342 });
    fireEvent.click(olt);

    expect(screen.queryByRole('tablist', { name: 'Inspector sections' })).not.toBeInTheDocument();
    expect(olt).not.toHaveClass('selected');

    // A tap — press and release in place — still selects and opens the sheet.
    fireEvent.pointerDown(olt, { clientX: 300, clientY: 300 });
    fireEvent.pointerUp(olt, { clientX: 301, clientY: 301 });
    fireEvent.click(olt);

    await waitFor(() => expect(screen.getByRole('tablist', { name: 'Inspector sections' })).toBeInTheDocument());
    expect(screen.getByText('Selected Component')).toBeInTheDocument();
  }, 60_000);
});

/** A port on a canvas component, by the handle id the component gives it. */
function port(node: HTMLElement, handleId: string): HTMLElement {
  const handle = node.querySelector(`.react-flow__handle[data-handleid="${handleId}"]`);
  if (!handle) throw new Error(`No port "${handleId}" on the component`);
  return handle as HTMLElement;
}

function getCanvasNode(_container: HTMLElement, match: string | RegExp): HTMLElement {
  const pattern = typeof match === 'string' ? new RegExp(`^${match}$`) : match;
  for (const element of screen.getAllByText(pattern)) {
    const node = element.closest('.react-flow__node');
    if (node) return node as HTMLElement;
  }
  throw new Error(`No canvas node matching ${String(match)}`);
}
