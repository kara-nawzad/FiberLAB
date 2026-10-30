import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { GLOSSARY_BY_ID } from '../data/glossary';

/* One tap (or click) opens one sentence. The definition lives in the shared
 * glossary, so the tooltip and the Learn screen can never drift apart.
 *
 * The panel is fixed-positioned and clamped to the viewport: these buttons sit
 * inside table cells and metric rows, and an absolutely positioned popover
 * either printed its copy over the row underneath (when its surface was
 * transparent) or ran off the right edge of a full-width inspector. */

const PANEL_WIDTH = 268;
const GUTTER = 12;

export function HelpTip({ termId, label }: { termId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();
  const entry = GLOSSARY_BY_ID[termId];

  const place = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - GUTTER * 2);
    const height = panelRef.current?.offsetHeight ?? 0;
    const left = Math.min(Math.max(GUTTER, rect.left), window.innerWidth - width - GUTTER);
    const below = rect.bottom + 6;
    const fitsBelow = below + height <= window.innerHeight - GUTTER;
    const top = fitsBelow ? below : Math.max(GUTTER, rect.top - height - 6);
    setPlacement({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    place();
  }, [open, place]);

  /* A fixed popover would drift away from its button on scroll or resize. */
  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  /* Tap anywhere else, or press Escape, and it goes away. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current?.contains(event.target as globalThis.Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!entry) return null;

  return (
    <span className="pu-helptip" ref={wrapRef}>
      <button
        ref={buttonRef}
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
        <span
          ref={panelRef}
          className="pu-helptip-panel"
          id={panelId}
          role="note"
          style={{
            left: placement?.left ?? 0,
            top: placement?.top ?? 0,
            width: `min(${PANEL_WIDTH}px, calc(100vw - ${GUTTER * 2}px))`,
            // Until the first measurement lands the panel is laid out but not
            // shown, so it can never flash at the wrong corner of the screen.
            visibility: placement ? 'visible' : 'hidden',
          }}
        >
          <b>{entry.term}</b> — {entry.definition}
        </span>
      ) : null}
    </span>
  );
}

export default HelpTip;
