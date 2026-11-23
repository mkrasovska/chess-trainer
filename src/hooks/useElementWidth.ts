import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Tracks a DOM element's rendered content width via ResizeObserver, so a computed
 * size (e.g. the chess board) can fit whatever space is actually available instead
 * of guessing it from the viewport minus a hand-maintained "chrome" constant --
 * which breaks every time a wrapping layout's own padding/margins change.
 */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
