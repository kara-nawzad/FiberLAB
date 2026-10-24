import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutGrid, X } from 'lucide-react';
import { PRESETS } from '../engine/presets';

/* ========================================================================== *
 * Design bar — the context line above the canvas.
 *
 * The topology picker and the first-run hint live here so the top bar can stay
 * down to four things (logo, project, zoom, Run Simulation).
 * ========================================================================== */

const HINT_KEY = 'fiberlab.onboarding.dismissed';

function readHintDismissed(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Three steps, dismissed once and remembered on this device. */
function FirstRunHint() {
  const [dismissed, setDismissed] = useState(readHintDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* Private mode: the hint simply comes back next visit. */
    }
  };

  return (
    <aside className="pu-firstrun" aria-label="Getting started">
      <ol className="pu-firstrun-steps">
        <li>
          <span aria-hidden="true">1</span> Pick a component
        </li>
        <li>
          <span aria-hidden="true">2</span> Connect them
        </li>
        <li>
          <span aria-hidden="true">3</span> Press Run Simulation
        </li>
      </ol>
      <button type="button" className="pu-firstrun-close" onClick={dismiss} aria-label="Dismiss getting started">
        <X size={14} aria-hidden="true" />
      </button>
    </aside>
  );
}

interface DesignBarProps {
  activePresetId: string | null;
  presetEdited: boolean;
  stale: boolean;
  onPreset: (presetId: string) => void;
}

export function DesignBar({ activePresetId, presetEdited, stale, onPreset }: DesignBarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const activePreset = PRESETS.find((preset) => preset.id === activePresetId);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as globalThis.Node;
      if (wrapRef.current && !wrapRef.current.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="pu-design-bar">
      <div className="pu-preset-wrap" ref={wrapRef}>
        <button
          ref={buttonRef}
          type="button"
          className="pu-select"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls="preset-menu"
          aria-label="Preset Topologies"
        >
          <LayoutGrid size={14} className="pu-mut" aria-hidden="true" />
          <span className="pu-preset-name">{activePreset ? activePreset.name : 'FTTH Network'}</span>
          <ChevronDown size={14} className="pu-mut" aria-hidden="true" />
        </button>
        {open ? (
          <div id="preset-menu" className="pu-menu pu-preset-menu">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onPreset(preset.id);
                  setOpen(false);
                }}
              >
                <strong className="pu-menu-strong">{preset.name}</strong>
                {activePresetId === preset.id ? (
                  <span className="pu-preset-loaded">{presetEdited ? 'LOADED · EDITED' : 'LOADED'}</span>
                ) : null}
                <div className="pu-menu-desc">{preset.description}</div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {stale ? <span className="pu-health amber">UNSAVED BUDGET — RUN SIMULATION</span> : null}

      <FirstRunHint />
    </div>
  );
}

export default DesignBar;
