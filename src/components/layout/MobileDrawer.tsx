import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X } from 'lucide-react';
import { useUI } from '@/app/providers/UIProvider';
import { Logo } from '@/components/common/Logo';
import { reducedMotion, rubberBand, runSpring, VelocityTracker, type SpringHandle } from '@/lib/gesture/spring';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './AppSidebar';

const FLICK = 500; // px/s
const EDGE = 16; // px of the screen edge that starts an opening swipe

/**
 * Phone: the full menu. It is always mounted, parked off screen, so a swipe from the left edge can
 * pull it out under the finger (1:1) before it is "open"; a swipe on the panel pushes it back.
 *  - while a finger is down the panel and the backdrop are written straight to `style` (no React state);
 *  - on release a spring takes over, seeded with the finger's speed; it opens or closes by distance OR flick;
 *  - a new touch catches it mid-flight (the spring simply stops and the finger carries on from there).
 * Open, it behaves like a modal: the page behind is inert, focus stays inside, Escape closes it.
 */
export function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { openQuickAdd, openSearch } = useUI();
  const panel = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const x = useRef(0); // how much of the panel is on screen, px
  const spring = useRef<SpringHandle | null>(null);
  const target = useRef<'open' | 'closed'>('closed'); // where the panel is heading
  const tracker = useRef(new VelocityTracker());
  const drag = useRef<{ id: number; startX: number; startY: number; base: number; locked: boolean } | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const close = () => onOpenChange(false);

  const width = () => panel.current?.offsetWidth || 330;
  const apply = useCallback((v: number) => {
    const p = panel.current;
    const s = shade.current;
    if (!p || !s) return;
    const w = p.offsetWidth || 330;
    const px = Math.max(-40, Math.min(w, v));
    x.current = v;
    p.style.translate = px >= w ? '' : `${px - w}px 0`;
    p.style.visibility = v > 0.5 ? 'visible' : 'hidden';
    s.style.opacity = String(Math.max(0, Math.min(1, v / w)));
    s.style.pointerEvents = v > 0.5 ? 'auto' : 'none';
  }, []);
  const settle = useCallback(
    (to: 'open' | 'closed', velocity = 0) => {
      spring.current?.stop();
      target.current = to;
      const end = to === 'open' ? width() : 0;
      if (reducedMotion()) return apply(end);
      spring.current = runSpring({
        from: x.current,
        to: end,
        velocity,
        stiffness: 420,
        damping: to === 'open' ? 38 : 44,
        onUpdate: apply,
        onDone: () => (spring.current = null),
      });
    },
    [apply],
  );

  // Parked closed before the first paint; follows the `open` prop (buttons, links, Escape, route changes).
  useLayoutEffect(() => apply(0), [apply]);
  useEffect(() => {
    // A gesture has already sent it where `open` says: do not restart the spring and lose its speed.
    if (target.current === (open ? 'open' : 'closed')) return;
    settle(open ? 'open' : 'closed');
  }, [open, settle]);

  // A wide screen has its own sidebar.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const off = () => mq.matches && onOpenChangeRef.current(false);
    mq.addEventListener('change', off);
    return () => mq.removeEventListener('change', off);
  }, []);

  // Modal while open: the page behind cannot be reached, focus stays in the menu, Escape closes it.
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById('root');
    const opener = document.activeElement as HTMLElement | null;
    root?.setAttribute('inert', '');
    document.documentElement.style.overflow = 'hidden';
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onOpenChangeRef.current(false);
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])')].filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      root?.removeAttribute('inert');
      document.documentElement.style.overflow = '';
      if (opener?.isConnected) opener.focus?.({ preventScroll: true });
    };
  }, [open]);

  // ---- the finger -------------------------------------------------------------------------------
  const down = (e: ReactPointerEvent, lockAfter: number) => {
    if (e.pointerType !== 'touch') return;
    spring.current?.stop();
    spring.current = null;
    // Caught mid-flight: carry on from where it is.
    const mid = x.current > 0.5 && x.current < width() - 0.5;
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, base: x.current, locked: lockAfter === 0 || mid };
    tracker.current.reset(x.current);
    if (drag.current.locked) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent, lockAfter: number) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    if (!d.locked) {
      const dy = Math.abs(e.clientY - d.startY);
      if (dy > 10 && dy > Math.abs(dx)) return void (drag.current = null); // a scroll, not ours
      if (Math.abs(dx) < lockAfter) return;
      d.locked = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const w = width();
    let v = d.base + (e.clientX - d.startX);
    if (v > w) v = w + rubberBand(v - w, 0, 0.2); // pulled past fully open: resists
    if (v < 0) v = -rubberBand(-v, 0, 0.2);
    tracker.current.push(v);
    apply(v);
  };
  const up = (e: ReactPointerEvent, cancelled = false) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.locked) return;
    const v = cancelled ? 0 : tracker.current.velocity;
    const w = width();
    const wantOpen = Math.abs(v) > FLICK ? v > 0 : x.current > w * 0.5;
    settle(wantOpen ? 'open' : 'closed', v);
    if (wantOpen !== open) onOpenChange(wantOpen);
  };

  const content = (
    <>
      {/* The strip along the left edge: a swipe from it pulls the menu out. touch-action: pan-y leaves the sideways move to us. */}
      {!open && (
        <div
          aria-hidden
          className="fixed inset-y-0 left-0 z-30 touch-pan-y lg:hidden"
          style={{ width: EDGE }}
          onPointerDown={(e) => !document.querySelector('[role=dialog]:not([data-menu])') && down(e, 8)}
          onPointerMove={(e) => move(e, 8)}
          onPointerUp={(e) => up(e)}
          onPointerCancel={(e) => up(e, true)}
        />
      )}
      <div ref={shade} aria-hidden onClick={close} className="fixed inset-0 z-50 bg-black/60 lg:hidden" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Меню"
        data-menu
        tabIndex={-1}
        onPointerDown={(e) => down(e, 12)}
        onPointerMove={(e) => move(e, 12)}
        onPointerUp={(e) => up(e)}
        onPointerCancel={(e) => up(e, true)}
        className="fixed inset-y-0 left-0 z-50 flex w-[min(330px,88vw)] touch-pan-y flex-col rounded-r-[30px] bg-sidebar px-3 pt-[max(14px,env(safe-area-inset-top))] pb-[max(14px,env(safe-area-inset-bottom))] text-sidebar-fg shadow-pop outline-hidden lg:hidden"
      >
        <div className="mb-3 flex h-11 items-center justify-between pl-2">
          <Logo tone="light" className="text-white" />
          <button
            type="button"
            onClick={close}
            aria-label="Закрити меню"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-active text-[#cfcfd4] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => (close(), openSearch())}
            className="flex h-11 items-center gap-2 rounded-full bg-sidebar-active px-4 text-[14px] text-sidebar-muted transition-colors hover:text-white"
          >
            <Search className="h-4 w-4" /> Пошук
          </button>
          <button
            type="button"
            onClick={() => (close(), openQuickAdd())}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#f4f3f1] px-4 text-[14px] font-semibold text-[#161618] transition-colors hover:bg-white"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} /> Створити
          </button>
        </div>
        <SidebarNav big onNavigate={close} />
        <SidebarFooter />
      </div>
    </>
  );
  // Outside #root, so the page can be made inert without touching the menu.
  return createPortal(content, document.body);
}
