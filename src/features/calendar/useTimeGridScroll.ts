import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import type { DateKey } from '@/types';

/** Scrolls the grid to a useful hour: the earliest item in view, or shortly before now. */
export function useScrollToUsefulHour({
  scrollRef,
  days,
  today,
  now,
  earliest,
  hourPx,
  onSettle,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  days: DateKey[];
  today: DateKey;
  now: Date;
  earliest: number;
  hourPx: number;
  /** Called each time the visible days change (the caller drops its draft block). */
  onSettle: () => void;
}) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const base = days.includes(today) ? Math.max(0, now.getHours() - 2) : 7;
    const hour = Math.min(base, Math.floor(earliest / 60));
    const apply = () => {
      el.scrollTop = Math.max(0, hour * hourPx - 16);
    };
    apply();
    // Mobile Safari can lay the scroller out after the first effect; apply again once it has a size.
    const raf = requestAnimationFrame(apply);
    let done = el.clientHeight > 0 && el.scrollTop > 0;
    const ro = new ResizeObserver(() => {
      if (done || el.clientHeight === 0) return;
      done = true;
      apply();
    });
    ro.observe(el);
    onSettle();
    // Layout can settle a moment later (fonts, the page's own height): retry while still at the top.
    const retries = [60, 250, 700].map((ms) => setTimeout(() => el.scrollTop === 0 && hour > 0 && apply(), ms));
    return () => {
      cancelAnimationFrame(raf);
      retries.forEach(clearTimeout);
      ro.disconnect();
    };
    // Only when the visible days change, not on every minute tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length]);
}

/**
 * Swipe left/right to page through days or months (touch only, ignored while drawing a selection). The page follows the
 * finger; on release it slides out and the next one slides in from the other side (or it springs back if the swipe was short).
 * `pageKey` changes when the shown days change: that is the moment the incoming page is positioned.
 */
export function usePageSwipe(
  pageRef: RefObject<HTMLElement | null>,
  blockScroll: RefObject<boolean>,
  onSwipe: ((dir: 1 | -1) => void) | undefined,
  pageKey: string,
) {
  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  // The direction of the page that is about to come in (set when a swipe is committed).
  const incoming = useRef<1 | -1 | 0>(0);

  useLayoutEffect(() => {
    const el = pageRef.current;
    const dir = incoming.current;
    if (!el || !dir) return;
    incoming.current = 0;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.style.transition = 'none';
    el.style.transform = `translate3d(${dir * 100}%, 0, 0)`;
    el.style.opacity = '0.6';
    void el.offsetWidth;
    el.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease-out';
    el.style.transform = 'translate3d(0, 0, 0)';
    el.style.opacity = '1';
  }, [pageKey, pageRef]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const reduce = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let g: { x: number; y: number; t: number; axis: 'x' | 'y' | null; dx: number; lastX: number; lastT: number; v: number } | null = null;
    const set = (x: number, ms: number) => {
      el.style.transition = ms ? `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none';
      el.style.transform = x ? `translate3d(${x}px, 0, 0)` : 'translate3d(0, 0, 0)';
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return void (g = null);
      const t = e.touches[0];
      g = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: 0, lastX: t.clientX, lastT: Date.now(), v: 0 };
    };
    const onMove = (e: TouchEvent) => {
      if (!g || blockScroll.current) return void (g = null);
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
        if (g.axis === 'x') el.style.willChange = 'transform';
      }
      if (g.axis !== 'x') return;
      const now = Date.now();
      g.v = (t.clientX - g.lastX) / Math.max(1, now - g.lastT);
      g.lastX = t.clientX;
      g.lastT = now;
      g.dx = dx;
      set(dx, 0);
    };
    const onEnd = () => {
      const s = g;
      g = null;
      if (!s || s.axis !== 'x') return;
      const w = el.clientWidth || 1;
      const go = Math.abs(s.dx) > w * 0.22 || Math.abs(s.v) > 0.45;
      const dir: 1 | -1 = (Math.abs(s.v) > 0.45 ? s.v : s.dx) < 0 ? 1 : -1;
      if (!go || !swipeRef.current) {
        set(0, reduce() ? 0 : 220);
        el.style.willChange = '';
        return;
      }
      if (reduce()) {
        set(0, 0);
        swipeRef.current(dir);
        return;
      }
      // Slide out the way the finger was going, then switch to the next page, which slides in from the other side.
      set(-dir * w, 160);
      window.setTimeout(() => {
        incoming.current = dir;
        swipeRef.current?.(dir);
        // If nothing changed (the move was refused), do not leave the page off to the side.
        window.setTimeout(() => {
          if (incoming.current) {
            incoming.current = 0;
            set(0, 200);
          }
          el.style.willChange = '';
        }, 120);
      }, 150);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [pageRef, blockScroll]);
}

/** While a touch selection or drag is in progress (`blockScroll.current`), the page must not scroll. */
export function useBlockTouchScroll(scrollRef: RefObject<HTMLDivElement | null>, blockScroll: RefObject<boolean>) {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (blockScroll.current) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [scrollRef, blockScroll]);
}
