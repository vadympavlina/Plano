import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { reducedMotion, rubberBand, runSpring, VelocityTracker, type SpringHandle } from './spring';

interface Options {
  /** Element that moves with the finger. */
  target: RefObject<HTMLElement | null>;
  /** Backdrop that fades with the drag (opacity is derived from the same progress). */
  overlay?: RefObject<HTMLElement | null>;
  axis: 'x' | 'y';
  /** +1: dismiss by moving right/down; -1: left/up. An element leaves the way it came in. */
  dir: 1 | -1;
  onDismiss: () => void;
  /** Return false to veto (e.g. a form with unsaved changes). The sheet springs back. */
  canDismiss?: () => boolean;
  onBlocked?: () => void;
  /** Only start on these pointers/places. Defaults to touch pointers. */
  allow?: (e: ReactPointerEvent) => boolean;
  /** Pixels of travel before the gesture claims the pointer (0 = a handle that grabs at once). */
  lockAfter?: number;
  /** Fraction of the element's size that dismisses on distance alone. */
  distance?: number;
  /** px/s that dismisses on a flick, whatever the distance. */
  flick?: number;
}

/**
 * Drag-to-dismiss for sheets, drawers and toasts.
 *  track:   transform written straight to the element, 1:1 with the finger, rubber-band the wrong way;
 *  release: spring seeded with the finger's velocity; dismiss on distance OR velocity;
 *  a new touch can catch the element while it is still moving.
 */
export function useDragDismiss(o: Options) {
  const opts = useRef(o);
  opts.current = o;
  const st = useRef<{ id: number; startC: number; startCross: number; base: number; locked: boolean; size: number } | null>(null);
  const pos = useRef(0); // current offset toward dismissal, px
  const spring = useRef<SpringHandle | null>(null);
  const tracker = useRef(new VelocityTracker());

  const write = useCallback((p: number) => {
    const { target, overlay, axis, dir } = opts.current;
    pos.current = p;
    const el = target.current;
    if (!el) return;
    const size = (axis === 'x' ? el.offsetWidth : el.offsetHeight) || 1;
    // The `translate` property, not `transform`: it is the one the entrance transition animates,
    // so a drag that starts mid-entrance picks up from the exact spot.
    el.style.translate = p === 0 ? '' : axis === 'x' ? `${p * dir}px 0` : `0 ${p * dir}px`;
    if (overlay?.current) overlay.current.style.opacity = p === 0 ? '' : String(Math.max(0, Math.min(1, 1 - p / size)));
  }, []);

  /** Hand the element to the finger: drop the entrance transition so writes apply at once. */
  const hold = useCallback(() => {
    const { target, overlay } = opts.current;
    if (target.current) target.current.style.transition = 'none';
    if (overlay?.current) overlay.current.style.transition = 'none';
  }, []);
  const release = useCallback(() => {
    const { target, overlay } = opts.current;
    if (target.current) target.current.style.transition = '';
    if (overlay?.current) overlay.current.style.transition = '';
  }, []);

  const settle = useCallback(
    (to: number, velocity: number, done?: () => void, bouncy = true) => {
      spring.current?.stop();
      if (reducedMotion()) {
        write(to);
        done?.();
        return;
      }
      spring.current = runSpring({
        from: pos.current,
        to,
        velocity,
        // Dismissal flies out without a bounce; a snap-back is quick and only slightly springy.
        stiffness: bouncy ? 520 : 300,
        damping: bouncy ? 36 : 40,
        onUpdate: write,
        onDone: () => {
          spring.current = null;
          done?.();
        },
      });
    },
    [write],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const { allow, axis, lockAfter = 0 } = opts.current;
      if (!(allow ? allow(e) : e.pointerType === 'touch')) return;
      // Catch the element mid-flight: carry on from where it is.
      let caught = spring.current !== null;
      spring.current?.stop();
      spring.current = null;
      // Still sliding in? Take over from where it is right now.
      const el = opts.current.target.current;
      if (el && !caught) {
        const t = getComputedStyle(el).translate;
        const [tx = '0px', ty = '0px'] = t === 'none' ? [] : t.split(' ');
        const cur = parseFloat(axis === 'x' ? tx : ty) * opts.current.dir;
        if (Math.abs(cur) > 0.5) {
          caught = true;
          pos.current = cur;
        }
      }
      const c = axis === 'x' ? e.clientX : e.clientY;
      st.current = {
        id: e.pointerId,
        startC: c - pos.current * opts.current.dir,
        startCross: axis === 'x' ? e.clientY : e.clientX,
        base: pos.current,
        locked: lockAfter === 0 || caught,
        size: 0,
      };
      tracker.current.reset(pos.current);
      if (st.current.locked) {
        hold();
        write(pos.current);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* gone */
        }
      }
    },
    [hold, write],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const s = st.current;
      if (!s || e.pointerId !== s.id) return;
      const { axis, dir, lockAfter = 0, target } = opts.current;
      const along = ((axis === 'x' ? e.clientX : e.clientY) - s.startC) * dir;
      if (!s.locked) {
        const cross = Math.abs((axis === 'x' ? e.clientY : e.clientX) - s.startCross);
        // Mostly sideways/vertical the other way: it is a scroll, not ours.
        if (cross > 10 && cross > Math.abs(along)) return void (st.current = null);
        if (along < lockAfter) return;
        s.locked = true;
        hold();
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* gone */
        }
      }
      const el = target.current;
      s.size = el ? (axis === 'x' ? el.offsetWidth : el.offsetHeight) : 1;
      // Pulling against the dismiss direction resists instead of stopping dead.
      const p = along >= 0 ? along : -rubberBand(-along, 0, 0.2);
      tracker.current.push(p);
      write(p);
    },
    [write, hold],
  );

  const end = useCallback(
    (e: ReactPointerEvent, cancelled: boolean) => {
      const s = st.current;
      if (!s || e.pointerId !== s.id) return;
      st.current = null;
      if (!s.locked) return;
      const { distance = 0.4, flick = 500, canDismiss, onBlocked, onDismiss, target, axis } = opts.current;
      const size = (axis === 'x' ? target.current?.offsetWidth : target.current?.offsetHeight) || s.size || 1;
      const v = cancelled ? 0 : tracker.current.velocity;
      const wants = !cancelled && (pos.current > size * distance || (v > flick && pos.current > 8));
      if (wants && (canDismiss ? canDismiss() : true)) {
        settle(
          size + 24,
          Math.max(v, 0),
          () => {
            // The element is about to unmount; the next one starts at rest.
            pos.current = 0;
            onDismiss();
          },
          false,
        );
      } else {
        if (wants) onBlocked?.();
        settle(0, v, () => (write(0), release()));
      }
    },
    [settle, write, release],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent) => end(e, false),
    onPointerCancel: (e: ReactPointerEvent) => end(e, true),
  };
}
