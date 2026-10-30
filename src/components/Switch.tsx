/* ========================================================================== *
 * The one on/off switch.
 *
 * Earlier toggles were drawn twice, and both went wrong: the fault switch was
 * a <button> whose own box *was* the track, so the coarse-pointer rule that
 * guarantees a 44 px touch target stretched it into a circle; the laser switch
 * put its knob in an absolutely positioned span with no `left`, so the knob's
 * static position plus its transform pushed it outside the track.
 *
 * Here the button is only the hit area (44 × 36, touch-friendly) and the track
 * is a child with a fixed 38 × 22 box, so pointer-coarse sizing can never
 * distort the graphic. The knob is positioned from the track's own left edge.
 * ========================================================================== */

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; the switch itself carries no text. */
  label: string;
  title?: string;
  className?: string;
}

export function Switch({ checked, onChange, label, title, className = '' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title ?? label}
      className={`pu-toggle${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="pu-toggle-track" aria-hidden="true">
        <span className="pu-toggle-knob" />
      </span>
    </button>
  );
}

export default Switch;
