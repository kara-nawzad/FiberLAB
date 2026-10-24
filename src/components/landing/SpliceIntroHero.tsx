import { useMemo } from 'react';
import { ArrowDownRight, ArrowRight, Radio } from 'lucide-react';
import { formatDbm } from '../../engine/opticalSimulator';
import type { OntStatus, SimulationResult } from '../../types';
import spliceHeroScene from '../../assets/splice-hero-scene.svg?raw';

interface SpliceIntroHeroProps {
  simulation: SimulationResult | null;
  simulationStale: boolean;
  simulationIsReference?: boolean;
  onLaunchStudio: () => void;
  onExploreMissions: () => void;
}

const STATUS_LABELS: Record<OntStatus, string> = {
  ONLINE: 'ONLINE',
  WARNING: 'MARGINAL',
  LOS: 'LOSS OF SIGNAL',
  OVERLOAD: 'OVERLOAD',
  DISCONNECTED: 'DISCONNECTED',
};

/* The introduction: one promise, two buttons, one live number. Everything
 * deeper (the physics bench, the reference plates, the caveats) lives further
 * down the page, so a first-time visitor is not asked to read a spec sheet. */
export function SpliceIntroHero({
  simulation,
  simulationStale,
  simulationIsReference = false,
  onLaunchStudio,
  onExploreMissions,
}: SpliceIntroHeroProps) {
  // The hero promises the *weakest* home, so it has to look at every subscriber
  // endpoint — ONTs and integrated gateways — and keep the lowest reading.
  const reading = useMemo(() => {
    if (!simulation) return null;
    const endpoints = [...Object.values(simulation.ontTelemetry), ...Object.values(simulation.gatewayTelemetry)];
    const lit = endpoints.filter((endpoint) => endpoint.rxPowerDbm !== null);
    if (lit.length > 0) {
      return lit.reduce((weakest, endpoint) =>
        (endpoint.rxPowerDbm ?? 0) < (weakest.rxPowerDbm ?? 0) ? endpoint : weakest,
      );
    }
    return endpoints[0] ?? null;
  }, [simulation]);

  const readingLabel =
    reading?.rxPowerDbm === null || reading?.rxPowerDbm === undefined ? '— —' : formatDbm(reading.rxPowerDbm);
  const readingStatus = reading ? STATUS_LABELS[reading.status] : 'NO SIMULATED PATH';
  const readingStateClass = reading ? `is-${reading.status.toLowerCase()}` : 'is-idle';

  return (
    <section className="splice-hero" aria-labelledby="splice-hero-title">
      <div className="splice-hero-scene is-done" aria-hidden="true">
        <div className="splice-hero-svg" dangerouslySetInnerHTML={{ __html: spliceHeroScene }} />
        <div className="splice-hero-scene-wash" />
      </div>

      <div className="splice-hero-content">
        <div className="splice-hero-eyebrow">
          <span /> FIBER ACCESS NETWORK LAB
        </div>
        <h1 id="splice-hero-title">
          Splice the fiber.
          <br />
          <em>Light the home.</em>
        </h1>
        <p className="splice-hero-lede">
          Build a fiber-to-the-home network in your browser, then watch the light budget decide which homes come online.
          Drag in an OLT, a splitter and a few subscribers — the physics handles the rest.
        </p>

        <div className="splice-hero-actions">
          <button type="button" className="landing-button landing-button--primary" onClick={onLaunchStudio}>
            Launch Interactive Studio <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button type="button" className="landing-button landing-button--secondary" onClick={onExploreMissions}>
            Explore Guided Missions (5 Scenarios) <ArrowDownRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="splice-live-readout" aria-label="Current studio simulation readout">
          <div className="splice-live-readout-label">
            <span className="splice-live-icon">
              <Radio size={16} aria-hidden="true" />
            </span>
            <span>
              <small>
                {simulationIsReference
                  ? 'REFERENCE 1:32 TREE'
                  : simulationStale
                    ? 'LAST COMMITTED RUN'
                    : 'LIVE STUDIO SIMULATION'}
              </small>
              <strong>Weakest home · receive power</strong>
            </span>
          </div>
          <div className="splice-live-value-wrap">
            <strong className="splice-live-value" aria-live="polite">
              {readingLabel}
            </strong>
            <span className={`splice-live-status ${readingStateClass}`}>
              <i aria-hidden="true" />
              {readingStatus}
            </span>
          </div>
          <p>
            {simulationIsReference
              ? 'Sample reading from the reference tree — the studio opens on an empty canvas.'
              : simulationStale
                ? 'Auto is off. Run a studio test to refresh the committed reading.'
                : 'Readouts come from the active React Flow network and optical simulator.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default SpliceIntroHero;
