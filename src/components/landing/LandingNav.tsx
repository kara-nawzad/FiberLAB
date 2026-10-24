import { useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { PRESETS } from '../../engine/presets';

interface LandingNavProps {
  onLaunchStudio: () => void;
  onLoadPreset: (presetId: string) => void;
}

export function LandingNav({ onLaunchStudio, onLoadPreset }: LandingNavProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);

  return (
    <nav className="landing-nav" aria-label="FiberLAB overview navigation">
      <a id="landing-overview-link" className="landing-brand" href="#top" aria-label="FiberLAB overview">
        <span className="landing-brand-wordmark">
          <strong>Fiber</strong>
          <b>LAB</b>
        </span>
      </a>

      <div className="landing-nav-links">
        <a href="#capabilities">Capabilities</a>
        <a href="#reference">Reference</a>
        <details
          className="landing-preset-menu"
          open={presetsOpen}
          onToggle={(event) => setPresetsOpen(event.currentTarget.open)}
        >
          <summary aria-label="Quick-load a topology">
            Topologies <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="landing-preset-popover">
            <p>LOAD A NETWORK</p>
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                onClick={() => {
                  onLoadPreset(preset.id);
                  setPresetsOpen(false);
                }}
              >
                <span>{preset.name}</span>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>
        </details>
      </div>

      <button type="button" className="landing-button landing-button--nav" onClick={onLaunchStudio}>
        Launch Studio <ArrowRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}

export default LandingNav;
