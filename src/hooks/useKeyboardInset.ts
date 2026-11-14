import { useEffect, useState } from 'react';

/**
 * Height of the on-screen keyboard (0 when there is none). Phone browsers lay a bottom sheet out against the
 * full screen, so the keyboard would cover its lower half; a sheet lifts itself by this much instead.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!enabled || !vv) return;
    const update = () => {
      // The part of the layout viewport that the visual viewport no longer reaches: the keyboard.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return inset;
}
