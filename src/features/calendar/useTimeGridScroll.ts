import { useEffect, useRef, type RefObject } from 'react';
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

/** Swipe left/right to page through days (touch only, ignored while drawing a selection). */
export function usePageSwipe(scrollRef: RefObject<HTMLDivElement | null>, blockScroll: RefObject<boolean>, onSwipe?: (dir: 1 | -1) => void) {
  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  useEffect(() => {
    const el = scrollRef.current?.parentElement;
    if (!el) return;
    let start: { x: number; y: number; t: number } | null = null;
    const onStart = (e: TouchEvent) => {
      start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!start || blockScroll.current) return (start = null);
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - start.t < 700) swipeRef.current?.(dx < 0 ? 1 : -1);
      start = null;
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchend', onEnd);
    };
  }, [scrollRef, blockScroll]);
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
