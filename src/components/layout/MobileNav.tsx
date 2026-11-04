import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarDays, NotebookPen, Plus, Search, SquareCheck, Sun, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useUI } from '@/app/providers/UIProvider';
import { GlassButton, GlassTabs, RouterLink } from '@/components/ui/glass';
import { Logo } from '@/components/common/Logo';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './AppSidebar';

const TABS = [
  { to: '/', label: 'Сьогодні', icon: Sun },
  { to: '/calendar', label: 'Календар', icon: CalendarDays },
  { to: '/tasks', label: 'Задачі', icon: SquareCheck },
  { to: '/notes', label: 'Нотатки', icon: NotebookPen },
];

function TabLabel({ label, icon: Icon }: { label: string; icon: (typeof TABS)[number]['icon'] }) {
  return (
    <span className="flex flex-col items-center gap-0.5 text-[11px] font-semibold leading-none">
      <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
      {label}
    </span>
  );
}

/**
 * The phone's floating tab bar — the one place Liquid Glass (glisse) is used. It is always dark
 * glass, whatever the theme, to sit with the dark frame.
 */
export function MobileNav() {
  const { openQuickAdd } = useUI();
  const { pathname } = useLocation();
  const current = TABS.find((t) => (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)))?.to ?? null;

  return (
    <nav
      aria-label="Головна навігація"
      data-theme="dark"
      className="glass-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2.5">
        <GlassTabs
          fill
          wrapperClassName="flex-1"
          tabHeight={54}
          aria-label="Розділи"
          link={RouterLink}
          value={current}
          items={TABS.map((t) => ({ value: t.to, href: t.to, label: <TabLabel label={t.label} icon={t.icon} /> }))}
        />
        <GlassButton
          variant="filled"
          tint="rgb(var(--primary))"
          aria-label="Швидко додати"
          onClick={() => openQuickAdd()}
          icon={<Plus className="!h-6 !w-6" strokeWidth={2.4} />}
          className="!h-[62px] !w-[62px] shrink-0 !rounded-full"
        />
      </div>
    </nav>
  );
}

/** Phone: the full menu from the top bar's menu button — sections with counters, projects, categories, the account. */
export function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { openQuickAdd, openSearch } = useUI();
  const close = () => onOpenChange(false);
  // Drag the drawer left to close it.
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const x = e.touches[0].clientX - s.x;
      if (!s.on) {
        if (Math.abs(e.touches[0].clientY - s.y) > 12) return void (start.current = null);
        if (x > -12) return;
        s.on = true;
      }
      setDx(Math.min(0, x));
    },
    onTouchEnd: () => {
      if (start.current?.on && dx < -90) close();
      start.current = null;
      setDx(0);
    },
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          {...handlers}
          style={dx ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(330px,88vw)] flex-col rounded-r-[30px] bg-sidebar px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] text-sidebar-fg shadow-pop outline-none data-[state=open]:animate-slide-in-left"
        >
          <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Розділи, проєкти та категорії</DialogPrimitive.Description>
          <div className="mb-3 flex h-11 items-center justify-between pl-2">
            <Logo tone="light" className="text-white" />
            <DialogPrimitive.Close className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-active text-[#cfcfd4] hover:text-white" aria-label="Закрити меню">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
