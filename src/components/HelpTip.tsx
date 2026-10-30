import { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { GLOSSARY_BY_ID } from '../data/glossary';

/* One tap (or click) opens one sentence. The definition lives in the shared
 * glossary, so the tooltip and the Learn screen can never drift apart. */
export function HelpTip({ termId, label }: { termId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const entry = GLOSSARY_BY_ID[termId];
  if (!entry) return null;

  return (
    <span className="pu-helptip">
      <button
        type="button"
        className="pu-helptip-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label ?? `What is ${entry.term}?`}
        title={entry.short}
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp size={12} aria-hidden="true" />
      </button>
      {open ? (
        <span className="pu-helptip-panel" id={panelId} role="note">
          <b>{entry.term}</b> — {entry.definition}
        </span>
      ) : null}
    </span>
  );
}

export default HelpTip;
