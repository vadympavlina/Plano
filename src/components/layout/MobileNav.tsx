import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, NotebookPen, Plus, Search, SquareCheck, Sun, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useUI } from '@/app/providers/UIProvider';
import { Logo } from '@/components/common/Logo';
import { useDragDismiss } from '@/lib/gesture/useDragDismiss';
import { SidebarNav } from './SidebarNav';
import { SidebarFooter } from './AppSidebar';

const TABS = [
  { to: '/', label: 'Сьогодні', icon: Sun },
  { to: '/calendar', label: 'Календар', icon: CalendarDays },
  { to: '/tasks', label: 'Задачі', icon: SquareCheck },
  { to: '/notes', label: 'Нотатки', icon: NotebookPen },
];

/**
 * The phone's floating tab bar: a solid dark pill, always dark whatever the theme, to sit with the
 * dark frame. A lighter pill under the current tab slides between tabs (transform only).
 */
export function MobileNav() {
  const { openQuickAdd } = useUI();
  const { pathname } = useLocation();
  const index = TABS.findIndex((t) => (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)));

  return (
    <nav aria-label="Головна навігація" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2.5">
        <div className="relative flex min-w-0 flex-1 items-center rounded-full bg-[#131316] p-1 shadow-pop ring-1 ring-white/15">
          {index >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 rounded-full bg-[#2e2e34] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
              style={{ width: `calc((100% - 8px) / ${TABS.length})`, transform: `translateX(${index * 100}%)` }}
            />
          )}
          {TABS.map(({ to, label, icon: Icon }, i) => (
            <Link
              key={to}
              to={to}
              aria-current={i === index ? 'page' : undefined}
              className={`relative z-10 flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11.5px] font-semibold leading-none transition-colors active:scale-[0.97] ${
                i === index ? 'text-white' : 'text-[#cfcfd4]'
              }`}
            >
              <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
              {label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          aria-label="Швидко додати"
          onClick={() => openQuickAdd()}
          className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg shadow-pop ring-1 ring-white/15 transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      </div>
    </nav>
  );
}

/** Phone: the full menu from the top bar's menu button — sections with counters, projects, categories, the account. */
export function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { openQuickAdd, openSearch } = useUI();
  const close = () => onOpenChange(false);
  // Drag the drawer left to close it: it follows the finger 1:1, then a spring finishes the job.
  const panel = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const drag = useDragDismiss({
    target: panel,
    overlay: shade,
    axis: 'x',
    dir: -1,
    lockAfter: 12,
    distance: 0.4,
    onDismiss: close,
  });
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay ref={shade} className="fixed inset-0 z-50 bg-black/60 enter-fade" />
        <DialogPrimitive.Content
          ref={panel}
          {...drag}
          className="fixed inset-y-0 left-0 z-50 flex touch-pan-y w-[min(330px,88vw)] flex-col rounded-r-[30px] bg-sidebar px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] text-sidebar-fg shadow-pop outline-hidden enter-drawer"
        >
          <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Розділи, проєкти та категорії</DialogPrimitive.Description>
          <div className="mb-3 flex h-11 items-center justify-between pl-2">
            <Logo tone="light" className="text-white" />
            <DialogPrimitive.Close
              className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-active text-[#cfcfd4] hover:text-white"
              aria-label="Закрити меню"
            >
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
