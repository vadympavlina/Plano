import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounced callback with an explicit `flush`, so pending work (e.g. note
 * autosave) can be forced when the component unmounts or the page hides.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgs = useRef<A | null>(null);
  fnRef.current = fn;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (lastArgs.current) {
      const args = lastArgs.current;
      lastArgs.current = null;
      fnRef.current(...args);
    }
  }, []);

  const run = useCallback(
    (...args: A) => {
      lastArgs.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    lastArgs.current = null;
  }, []);

  useEffect(() => flush, [flush]);
  return { run, flush, cancel, isPending: () => lastArgs.current !== null };
}
