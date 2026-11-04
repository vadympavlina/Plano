import { useLocation } from 'react-router-dom';
import { CalendarDays, NotebookPen, Plus, SquareCheck, Sun, X } from 'lucide-react';
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
    <span className="flex flex-col items-center gap-0.5 text-[10.5px] font-semibold leading-none">
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

/** Phone: the full menu (sections, projects, categories) from the top bar's menu button. */
export function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(310px,86vw)] flex-col bg-sidebar px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] text-sidebar-fg shadow-pop outline-none data-[state=open]:animate-slide-in-left">
          <DialogPrimitive.Title className="sr-only">Меню</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Розділи, проєкти та категорії</DialogPrimitive.Description>
          <div className="mb-3 flex h-11 items-center justify-between pl-2">
            <Logo tone="light" className="text-white" />
            <DialogPrimitive.Close className="flex h-9 w-9 items-center justify-center rounded-full text-sidebar-muted hover:bg-white/[0.06] hover:text-white" aria-label="Закрити">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <SidebarNav onNavigate={() => onOpenChange(false)} />
          <SidebarFooter />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
