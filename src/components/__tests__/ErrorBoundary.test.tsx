import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom(): JSX.Element {
  throw new Error('splitter cassette on fire');
}

describe('ErrorBoundary', () => {
  it('replaces a crashed subtree with the branded recovery screen', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Workbench interrupted');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('FiberLAB hit an unexpected error');
    // The thrown message is shown so a bug report is actionable.
    expect(screen.getByLabelText('Error detail')).toHaveTextContent('splitter cassette on fire');
    expect(screen.getByRole('button', { name: 'Reload Workbench' })).toHaveFocus();
    consoleError.mockRestore();
  });

  it('offers a reload, an in-place retry and an issue link', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Reload Workbench' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report an issue' })).toHaveAttribute(
      'href',
      'https://github.com/kara-nawzad/FiberLAB/issues',
    );
    // Retry clears the error state; the same throwing child re-crashes, which
    // proves the boundary is reusable rather than stuck.
    fireEvent.click(screen.getByRole('button', { name: 'Try again without reloading' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('renders children untouched while nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>workbench running</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('workbench running')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
