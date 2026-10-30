import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { WORKSPACE_STORAGE_KEY } from '../engine/workspacePersistence';

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
 * ========================================================================== */

const savedWorkspace = () => JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '{}');

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

    // Persisting is debounced, so poll rather than reading the first snapshot:
    // a single read is a race that only shows up on slower machines.
    await waitFor(
      () => {
        const branches = (savedWorkspace().edges ?? [])
          .filter((edge: { source: string }) => edge.source === splitterId)
          .map((edge: { sourceHandle: string }) => edge.sourceHandle)
          .sort();
        expect(branches).toEqual(['out-0', 'out-1', 'out-2', 'out-3']);
      },
      { timeout: 10_000 },
    );
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
});

function getCanvasNode(_container: HTMLElement, match: string | RegExp): HTMLElement {
  const pattern = typeof match === 'string' ? new RegExp(`^${match}$`) : match;
  for (const element of screen.getAllByText(pattern)) {
    const node = element.closest('.react-flow__node');
    if (node) return node as HTMLElement;
  }
  throw new Error(`No canvas node matching ${String(match)}`);
}
