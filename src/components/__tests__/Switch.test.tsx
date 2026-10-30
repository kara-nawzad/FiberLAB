import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Switch } from '../Switch';

/**
 * One switch, two earlier regressions: the graphic must not be the button's own
 * box (coarse-pointer sizing stretched it into a circle), and the knob must sit
 * inside the track. Those are CSS facts the jsdom suite cannot measure, but the
 * contract the app relies on — a real switch role with a boolean state — is
 * checked here.
 */
describe('Switch', () => {
  it('exposes a switch with its checked state', () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} label="Laser transmitter" />);
    const control = screen.getByRole('switch', { name: 'Laser transmitter' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(control).not.toHaveClass('is-on');

    rerender(<Switch checked onChange={() => {}} label="Laser transmitter" />);
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(control).toHaveClass('is-on');
  });

  it('reports the next state on click', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Macro-bend fault" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Macro-bend fault' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('paints the track and knob as children, not as the button box', () => {
    const { container } = render(<Switch checked onChange={() => {}} label="Laser transmitter" />);
    const track = container.querySelector('.pu-toggle-track');
    expect(track).not.toBeNull();
    expect(track?.querySelector('.pu-toggle-knob')).not.toBeNull();
  });
});
