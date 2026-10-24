import { useCallback, useRef } from 'react';

/**
 * Sections are screens, so opening one moves keyboard focus to its heading.
 * Returns a callback ref: it focuses the node whenever it mounts, which covers
 * both the first render and every return to that section. The element needs
 * `tabIndex={-1}` — focus is programmatic, not a tab stop.
 */
export function useSectionFocus<T extends HTMLElement = HTMLHeadingElement>() {
  const nodeRef = useRef<T | null>(null);

  return useCallback((node: T | null) => {
    nodeRef.current = node;
    if (!node) return;
    /* jsdom and older browsers ignore the options bag; both are safe to pass. */
    try {
      node.focus({ preventScroll: true });
    } catch {
      node.focus();
    }
  }, []);
}

export default useSectionFocus;
