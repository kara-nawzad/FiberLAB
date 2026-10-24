import { useEffect, useRef, type RefObject } from 'react';

/* ========================================================================== *
 * Shared modal-dialog behaviour
 *
 * FiberLAB has three overlays (Bill of Materials, OTDR analyzer, mission
 * drawer). They used to implement keyboard handling separately, which meant
 * only some of them closed on Escape, trapped Tab, or restored focus. This hook
 * centralises the contract so every overlay behaves the same way:
 *
 *   • Escape closes the dialog.
 *   • Tab / Shift+Tab cycle inside the dialog and never reach the canvas.
 *   • Focus moves into the dialog on open and returns to the trigger on close
 *     (or to the studio overview toggle when the trigger has been hidden).
 * ========================================================================== */

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Focus target used when the element that opened the dialog is gone or hidden. */
export const DIALOG_FALLBACK_FOCUS_ID = 'studio-overview-toggle';

interface UseDialogA11yOptions {
  open: boolean;
  onClose: () => void;
  /** Element that receives focus on open; defaults to the first focusable child. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

function isVisibleFocusTarget(element: HTMLElement | null): element is HTMLElement {
  if (!element || !document.body.contains(element)) return false;
  return !element.closest('[inert], [aria-hidden="true"]');
}

export function useDialogA11y({ open, onClose, initialFocusRef }: UseDialogA11yOptions) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Keep the close handler fresh without re-running the focus effect whenever
  // a parent re-creates its callback (inline arrows are common here).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    const getFocusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );

    // Default to the dialog container itself (screen readers then announce the
    // title and description before the first control) unless a caller asks for
    // a specific control such as a close button.
    const preferred = initialFocusRef?.current ?? dialog ?? getFocusable()[0];
    preferred?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusIsInside = Boolean(dialog?.contains(document.activeElement));

      if (event.shiftKey && (document.activeElement === first || !focusIsInside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusIsInside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const previous = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (isVisibleFocusTarget(previous)) {
        previous.focus({ preventScroll: true });
      } else {
        document.getElementById(DIALOG_FALLBACK_FOCUS_ID)?.focus({ preventScroll: true });
      }
    };
  }, [open, initialFocusRef]);

  return { dialogRef };
}
