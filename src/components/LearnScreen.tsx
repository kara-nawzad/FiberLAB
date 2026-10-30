import { ArrowRight, BookOpen, ClipboardList, ExternalLink, Flag, GraduationCap } from 'lucide-react';
import { groupMissions, type Mission } from '../engine/missions';
import { GLOSSARY } from '../data/glossary';
import { useSectionFocus } from '../hooks/useSectionFocus';

/* ========================================================================== *
 * Learn — the third section.
 *
 * Missions used to live behind a canvas icon and a settings card; here they
 * are the page, grouped by the skill they train, with the reading material in
 * one place. Starting a mission still happens on the canvas, so every card
 * says so before it is pressed.
 * ========================================================================== */

interface LearnScreenProps {
  activeMissionId: string | null;
  onStartMission: (mission: Mission) => void;
  onOpenMissions: () => void;
  onOpenOverview: () => void;
}

export function LearnScreen({ activeMissionId, onStartMission, onOpenMissions, onOpenOverview }: LearnScreenProps) {
  const headingRef = useSectionFocus<HTMLHeadingElement>();
  const sections = groupMissions();

  return (
    <section className="pu-screen" aria-labelledby="learn-title">
      <header className="pu-screen-head">
        <div className="pu-screen-head-copy">
          <h1 id="learn-title" ref={headingRef} tabIndex={-1}>
            Learn
          </h1>
          <p>
            Guided missions that run on the same simulator as the workbench, plus the physics notes behind every number.
          </p>
        </div>
        <div className="pu-screen-actions">
          <button type="button" className="pu-btn" onClick={onOpenOverview}>
            <BookOpen size={16} aria-hidden="true" /> Overview &amp; Physics
          </button>
          <button type="button" className="pu-btn" onClick={onOpenMissions}>
            <ClipboardList size={16} aria-hidden="true" /> Mission briefs
          </button>
        </div>
      </header>

      <div className="pu-screen-body">
        <div className="pu-screen-cards">
          {sections.map(({ section, missions }) => (
            <section className="pu-screen-card" key={section.id} aria-labelledby={`learn-${section.id}-title`}>
              <div className="pu-screen-card-head">
                <h2 id={`learn-${section.id}-title`}>{section.title}</h2>
                <span className="pu-screen-card-note">{missions.length} missions</span>
              </div>
              <p className="pu-sb-note">{section.blurb}</p>
              <ul className="pu-learn-list">
                {missions.map((mission) => (
                  <li key={mission.id}>
                    <div className="pu-learn-item-copy">
                      <b>
                        {mission.title}
                        {activeMissionId === mission.id ? <span className="pu-learn-active">Running</span> : null}
                      </b>
                      <small>
                        <GraduationCap size={13} aria-hidden="true" /> {mission.difficulty} ·{' '}
                        {mission.objectives.length} objectives
                      </small>
                      <small>{mission.scenarioBrief}</small>
                    </div>
                    <button
                      type="button"
                      className="pu-btn"
                      onClick={() => onStartMission(mission)}
                      aria-label={`Start ${mission.title} on the canvas`}
                    >
                      <Flag size={14} aria-hidden="true" /> Start
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="pu-screen-card" aria-labelledby="learn-glossary-title">
            <div className="pu-screen-card-head">
              <h2 id="learn-glossary-title">Glossary</h2>
              <span className="pu-screen-card-note">{GLOSSARY.length} terms</span>
            </div>
            <dl className="pu-glossary">
              {GLOSSARY.map((entry) => (
                <div key={entry.id}>
                  <dt>{entry.term}</dt>
                  <dd>
                    {entry.short}. {entry.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="pu-screen-card" aria-labelledby="learn-reading-title">
            <div className="pu-screen-card-head">
              <h2 id="learn-reading-title">Reading</h2>
            </div>
            <ul className="pu-learn-links">
              <li>
                <a
                  href="https://github.com/kara-nawzad/FiberLAB/tree/main/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Project guide <ExternalLink size={12} aria-hidden="true" />
                </a>
              </li>
              <li>
                <a href="https://github.com/kara-nawzad/FiberLAB/issues" target="_blank" rel="noopener noreferrer">
                  Ask a question <ExternalLink size={12} aria-hidden="true" />
                </a>
              </li>
            </ul>
            <p className="pu-sb-note">
              This is a learning model. Confirm every live-network decision against current standards and device
              datasheets.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}

export default LearnScreen;
