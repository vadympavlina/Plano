import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { haptic } from '@/lib/utils/haptic';
import { reducedMotion, runSpring } from './spring';

const LONG_PRESS_MS = 300;

interface Options {
  /** Called when the card is over a different drop zone (or null when over none). */
  onHover?: (zone: string | null) => void;
  /** Dropped on a zone. Return false to refuse: the card flies back. */
  onDrop: (zone: string) => boolean | void;
}

interface Session {
  id: number;
  touch: boolean;
  x0: number;
  y0: number;
  x: number;
  y: number;
  started: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  clone: HTMLElement | null;
  rect: DOMRect | null;
  zone: string | null;
  raf: number;
  scrollers: HTMLElement[];
}

const preventScroll = (e: TouchEvent) => e.cancelable && e.preventDefault();

/** Scrollable ancestors, nearest first: they auto-scroll while a card is held near their edge. */
function scrollParents(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let n = el.parentElement; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    const sx = /(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1;
    const sy = /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1;
    if (sx || sy) out.push(n);
  }
  return out;
}

/**
 * Drag a card between drop zones (`data-drop-zone="…"`) with a pointer: mouse, pen or finger.
 *  - mouse grabs after a few pixels; touch after a short hold, so scrolling stays native;
 *  - a floating copy follows the pointer 1:1 (direct transform writes, no React state per move),
 *    so no clipping by scrolling columns; the original stays dimmed in place;
 *  - the edges of scrollable parents auto-scroll;
 *  - a drop that is refused, or missed, springs the copy back to where it came from.
 */
export function useCardDrag(o: Options) {
  const opts = useRef(o);
  opts.current = o;
  const ref = useRef<HTMLElement | null>(null);
  const s = useRef<Session | null>(null);
  const swallow = useRef(false);

  const hit = useCallback((sess: Session) => {
    const els = document.elementsFromPoint(sess.x, sess.y);
    let zone: string | null = null;
    for (const el of els) {
      const z = (el as HTMLElement).closest?.('[data-drop-zone]') as HTMLElement | null;
      if (z) {
        zone = z.dataset.dropZone ?? null;
        break;
      }
    }
    if (zone !== sess.zone) {
      sess.zone = zone;
      opts.current.onHover?.(zone);
    }
  }, []);

  const place = useCallback((sess: Session) => {
    if (!sess.clone) return;
    const lift = reducedMotion() ? '' : ' scale(1.03)';
    sess.clone.style.transform = `translate3d(${sess.x - sess.x0}px,${sess.y - sess.y0}px,0)${lift}`;
  }, []);

  const loop = useCallback(
    (sess: Session) => {
      const tick = () => {
        if (s.current !== sess || !sess.started) return;
        const edge = 56;
        for (const sc of sess.scrollers) {
          const r = sc.getBoundingClientRect();
          const speed = (d: number) => Math.min(16, Math.max(0, (edge - d) / edge) * 16);
          const dx = sess.x - r.left < edge ? -speed(sess.x - r.left) : r.right - sess.x < edge ? speed(r.right - sess.x) : 0;
          const dy = sess.y - r.top < edge ? -speed(sess.y - r.top) : r.bottom - sess.y < edge ? speed(r.bottom - sess.y) : 0;
          if (dx || dy) {
            const bx = sc.scrollLeft;
            const by = sc.scrollTop;
            sc.scrollLeft += dx;
            sc.scrollTop += dy;
            if (sc.scrollLeft !== bx || sc.scrollTop !== by) {
              hit(sess);
              break;
            }
          }
        }
        sess.raf = requestAnimationFrame(tick);
      };
      sess.raf = requestAnimationFrame(tick);
    },
    [hit],
  );

  const start = useCallback(
    (sess: Session, target: HTMLElement) => {
      const el = ref.current;
      if (!el) return void (s.current = null);
      sess.started = true;
      const rect = el.getBoundingClientRect();
      sess.rect = rect;
      const clone = el.cloneNode(true) as HTMLElement;
      clone.removeAttribute('id');
      clone.setAttribute('aria-hidden', 'true');
      clone.tabIndex = -1;
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        zIndex: '200',
        pointerEvents: 'none',
        willChange: 'transform',
        boxShadow: '0 14px 34px rgba(16,24,40,.22)',
        opacity: '1',
      });
      document.body.appendChild(clone);
      sess.clone = clone;
      el.style.opacity = '0.35';
      sess.scrollers = scrollParents(el);
      try {
        target.setPointerCapture(sess.id);
      } catch {
        /* pointer gone */
      }
      window.addEventListener('touchmove', preventScroll, { passive: false });
      haptic();
      place(sess);
      hit(sess);
      loop(sess);
    },
    [hit, loop, place],
  );

  const finish = useCallback(
    (cancel: boolean) => {
      const sess = s.current;
      s.current = null;
      if (!sess) return;
      if (sess.timer) clearTimeout(sess.timer);
      if (!sess.started) return;
      cancelAnimationFrame(sess.raf);
      window.removeEventListener('touchmove', preventScroll);
      swallow.current = true;
      setTimeout(() => (swallow.current = false), 300);
      const el = ref.current;
      const clone = sess.clone;
      const zone = sess.zone;
      opts.current.onHover?.(null);
      const accepted = !cancel && zone !== null && opts.current.onDrop(zone) !== false;
      if (el) el.style.opacity = '';
      if (!clone) return;
      if (accepted || reducedMotion()) return void clone.remove();
      // Back to where it was: a quick spring from where the card was let go.
      const dx = sess.x - sess.x0;
      const dy = sess.y - sess.y0;
      runSpring({
        from: 1,
        to: 0,
        stiffness: 520,
        damping: 38,
        onUpdate: (k) => (clone.style.transform = `translate3d(${dx * k}px,${dy * k}px,0) scale(${1 + 0.03 * k})`),
        onDone: () => clone.remove(),
      });
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (s.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if ((e.target as HTMLElement).closest('input,textarea,[role=checkbox]')) return;
      const touch = e.pointerType !== 'mouse';
      const sess: Session = { id: e.pointerId, touch, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, started: false, timer: null, clone: null, rect: null, zone: null, raf: 0, scrollers: [] };
      s.current = sess;
      if (touch) {
        const target = e.currentTarget;
        sess.timer = setTimeout(() => s.current === sess && start(sess, target), LONG_PRESS_MS);
      }
    },
    [start],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const sess = s.current;
      if (!sess || e.pointerId !== sess.id) return;
      sess.x = e.clientX;
      sess.y = e.clientY;
      if (!sess.started) {
        const moved = Math.hypot(sess.x - sess.x0, sess.y - sess.y0);
        // Touch: moving before the hold ends means a scroll. Mouse: a few pixels start the drag.
        if (sess.touch) {
          if (moved > 8) {
            if (sess.timer) clearTimeout(sess.timer);
            s.current = null;
          }
        } else if (moved > 4) start(sess, e.currentTarget);
        return;
      }
      place(sess);
      hit(sess);
    },
    [hit, place, start],
  );

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: () => finish(false),
      onPointerCancel: () => finish(true),
      /** Swallows the click that ends a drag. */
      onClickCapture: (e: ReactMouseEvent) => {
        if (swallow.current) {
          swallow.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
      onContextMenu: (e: ReactMouseEvent) => {
        if (s.current?.touch) e.preventDefault();
      },
    },
  };
}
