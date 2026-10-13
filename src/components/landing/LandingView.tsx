import { ArrowUpRight } from 'lucide-react';
import { LandingNav } from './LandingNav';
import { PhotonicHero } from './PhotonicHero';
import { PillarsGrid } from './PillarsGrid';
import { SpecsStrip } from './SpecsStrip';

export interface LandingViewProps {
  onLaunchStudio: () => void;
  onExploreMissions: () => void;
  onLoadPreset: (presetId: string) => void;
  onStartVillaMission: () => void;
}

export function LandingView({
  onLaunchStudio,
  onExploreMissions,
  onLoadPreset,
  onStartVillaMission,
}: LandingViewProps) {
  return (
    <div className="landing-page" id="top">
      <LandingNav onLaunchStudio={onLaunchStudio} onLoadPreset={onLoadPreset} />
      <main className="landing-main">
        <PhotonicHero
          onLaunchStudio={onLaunchStudio}
          onExploreMissions={onExploreMissions}
          onLoadPreset={onLoadPreset}
        />
        <PillarsGrid onStartVillaMission={onStartVillaMission} onOpenStudio={onLaunchStudio} />
        <SpecsStrip />
      </main>
      <footer className="landing-footer">
        <div className="landing-footer-brand"><span>F</span> FiberLAB</div>
        <p>
          Learning model · downstream link-budget terms are explicit, but product-specific optics, bend penalties, and upstream receiver budgets are not fully modeled. Confirm every live-network decision against current standards and device datasheets.
        </p>
        <button type="button" className="landing-footer-link" onClick={onLaunchStudio}>
          Open the engineering canvas <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </footer>
    </div>
  );
}

export default LandingView;
