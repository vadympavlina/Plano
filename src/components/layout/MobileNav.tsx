import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, MoreHorizontal, Plus } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils/cn';
import { NAV_ITEMS } from './nav';
import { useUI } from '@/app/providers/UIProvider';
import { useSignOut } from './UserMenu';
import { SyncIndicator } from './SyncIndicator';
import { useProfile } from '@/hooks/useProfile';

const PRIMARY = NAV_ITEMS.filter((i) => ['/', '/calendar', '/tasks'].includes(i.to));
const MORE = NAV_ITEMS.filter((i) => !['/', '/calendar', '/tasks'].includes(i.to));

function Tab({ to, label, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn('flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[10.5px] font-medium', isActive ? 'text-ink' : 'text-subtle')
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
          {label}
        </>
      )}
    </NavLink>
  );
}

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { openQuickAdd } = useUI();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const profile = useProfile();
  const moreActive = MORE.some((i) => pathname.startsWith(i.to));

  return (
    <>
      <nav
        aria-label="Головна навігація"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-safe backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex h-[60px] max-w-lg items-stretch px-2">
          <Tab {...PRIMARY[0]} />
          <Tab {...PRIMARY[1]} />
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              aria-label="Швидко додати"
              onClick={openQuickAdd}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-surface shadow-pop transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <Tab {...PRIMARY[2]} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn('flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[10.5px] font-medium', moreActive ? 'text-ink' : 'text-subtle')}
            aria-haspopup="dialog"
          >
            <MoreHorizontal className="h-[22px] w-[22px]" />
            Більше
          </button>
        </div>
      </nav>

      <DialogPrimitive.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b0f17]/40 data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[22px] border-t border-line bg-surface pb-safe shadow-pop data-[state=open]:animate-slide-up">
            <DialogPrimitive.Title className="sr-only">Більше</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Інші розділи</DialogPrimitive.Description>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" />
            <div className="grid grid-cols-3 gap-2 p-4">
              {MORE.map(({ to, label, icon: Icon }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(to);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border border-line px-2 py-4 text-[13px] font-medium transition-colors active:bg-surface-2',
                    pathname.startsWith(to) ? 'bg-surface-2 text-ink' : 'text-muted',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <SyncIndicator variant="header" />
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  void signOut();
                }}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2"
              >
                <LogOut className="h-4 w-4" />
                {profile.mode === 'preview' ? 'Вийти з перегляду' : 'Вийти'}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
