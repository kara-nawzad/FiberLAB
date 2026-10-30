import { LandingNav } from './LandingNav';
import { PhotonicHero } from './PhotonicHero';
import { PillarsGrid } from './PillarsGrid';
import { SpecsStrip } from './SpecsStrip';
import { SpliceIntroHero } from './SpliceIntroHero';

export interface LandingViewProps {
  onLaunchStudio: () => void;
  onLoadPreset: (presetId: string) => void;
  onStartVillaMission: () => void;
}

export function LandingView({ onLaunchStudio, onLoadPreset, onStartVillaMission }: LandingViewProps) {
  return (
    <div className="landing-page">
      <main>
        <div className="splice-hero-frame" id="top">
          <div className="landing-nav-wrap">
            <LandingNav onLaunchStudio={onLaunchStudio} onLoadPreset={onLoadPreset} />
          </div>
          <SpliceIntroHero onLaunchStudio={onLaunchStudio} />
        </div>

        <div className="landing-content">
          <PhotonicHero onLoadPreset={onLoadPreset} />
          <PillarsGrid onStartVillaMission={onStartVillaMission} onOpenStudio={onLaunchStudio} />
          <SpecsStrip />
        </div>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span className="landing-footer-wordmark">
            <strong>Fiber</strong>
            <b>LAB</b>
          </span>
        </div>
        <p>A learning model: confirm every live-network decision against current standards and device datasheets.</p>
      </footer>
    </div>
  );
}

export default LandingView;
