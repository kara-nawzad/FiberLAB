import { useCallback, useEffect, useRef } from 'react';
import type { SectionId } from '../components/SectionNav';

/**
 * Sections behave like pages, so the browser Back button (and the phone back
 * gesture) must walk back through them instead of leaving the app.
 *
 * Every section move pushes one entry; a pop event simply applies the section
 * stored on the entry it lands on. The URL is never rewritten, so the hash
 * (`#reference` and friends) is preserved exactly as it was.
 */
export function useSectionHistory(onSectionChange: (section: SectionId) => void) {
  const tokenRef = useRef(`fiberlab-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { section?: SectionId } | null;
      onSectionChange(state?.section ?? 'design');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [onSectionChange]);

  /** Record the section the user is on so Back can return to it. */
  const push = useCallback((section: SectionId) => {
    if (typeof window === 'undefined' || typeof window.history?.pushState !== 'function') return;
    try {
      window.history.pushState({ section, nav: tokenRef.current }, '');
    } catch {
      /* Sandboxed/blocked history: navigation still works, only Back is lost. */
    }
  }, []);

  return { push };
}

export default useSectionHistory;
