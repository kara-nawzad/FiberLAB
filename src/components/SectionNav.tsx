import type { ReactNode } from 'react';
import { FileBarChart, LayoutDashboard, PlayCircle, Settings2 } from 'lucide-react';

/* ========================================================================== *
 * Section navigation — Design → Simulation → Reports → Settings.
 *
 * Desktop keeps the slim rail on the left (icon + label). Phones swap it for a
 * bottom tab bar with 44 px targets that sits under the status bar and clears
 * the iPhone home indicator. One screen is mounted at a time, so each section
 * only shows what belongs to that step.
 * ========================================================================== */

export type SectionId = 'design' | 'simulation' | 'reports' | 'settings';

interface SectionDef {
  id: SectionId;
  label: string;
  hint: string;
  icon: ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: 'design',
    label: 'Design',
    hint: 'Design — place components and wire the topology',
    icon: <LayoutDashboard size={20} aria-hidden="true" />,
  },
  {
    id: 'simulation',
    label: 'Simulation',
    hint: 'Simulation — run the optical budget and read every subscriber',
    icon: <PlayCircle size={20} aria-hidden="true" />,
  },
  {
    id: 'reports',
    label: 'Reports',
    hint: 'Reports — optical audit and commercial quotation',
    icon: <FileBarChart size={20} aria-hidden="true" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    hint: 'Settings — simulation options, test gear and help',
    icon: <Settings2 size={20} aria-hidden="true" />,
  },
];

interface SectionNavProps {
  active: SectionId;
  onChange: (section: SectionId) => void;
}

/** Desktop rail. */
export function SectionRail({ active, onChange }: SectionNavProps) {
  return (
    <nav className="pu-rail" aria-label="Workbench sections">
      {SECTIONS.map((section) => {
        const current = active === section.id;
        return (
          <button
            key={section.id}
            type="button"
            className={current ? 'is-active' : ''}
            aria-current={current ? 'page' : undefined}
            aria-label={section.label}
            title={section.hint}
            onClick={() => onChange(section.id)}
          >
            {section.icon}
            <span className="pu-rail-label">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Phone tab bar: pinned to the bottom, above the home indicator. */
export function SectionTabBar({ active, onChange }: SectionNavProps) {
  return (
    <nav className="pu-tabbar" aria-label="Sections">
      {SECTIONS.map((section) => {
        const current = active === section.id;
        return (
          <button
            key={section.id}
            type="button"
            className={`pu-tabbar-btn${current ? ' is-active' : ''}`}
            aria-current={current ? 'page' : undefined}
            aria-label={section.label}
            onClick={() => onChange(section.id)}
          >
            {section.icon}
            <span>{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default SectionRail;
