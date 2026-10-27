import { useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, MoreHorizontal, Plus } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils/cn';
import { GlassButton, GlassTabs, RouterLink } from '@/components/ui/glass';
import { NAV_ITEMS } from './nav';
import { useUI } from '@/app/providers/UIProvider';
import { useSignOut } from './UserMenu';
import { SyncIndicator } from './SyncIndicator';
import { useProfile } from '@/hooks/useProfile';

const PRIMARY = NAV_ITEMS.filter((i) => ['/', '/calendar', '/tasks'].includes(i.to));
const MORE = NAV_ITEMS.filter((i) => !['/', '/calendar', '/tasks'].includes(i.to));

function TabLabel({ label, icon: Icon }: { label: string; icon: (typeof NAV_ITEMS)[number]['icon'] }) {
  return (
    <span className="flex flex-col items-center gap-0.5 text-[10.5px] font-semibold leading-none">
      <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
      {label}
    </span>
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
  const current = moreActive ? 'more' : (PRIMARY.find((i) => (i.to === '/' ? pathname === '/' : pathname.startsWith(i.to)))?.to ?? null);

  return (
    <>
      {/* A floating glass bar, with the add button beside it (as on iOS). */}
      <nav aria-label="Головна навігація" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2.5">
          <GlassTabs
            fill
            wrapperClassName="flex-1"
            tabHeight={54}
            aria-label="Розділи"
            link={RouterLink}
            value={current}
            onValueChange={(v) => v === 'more' && setMoreOpen(true)}
            style={{ '--lg-lens-grow-x': '10px', '--lg-lens-grow-y': '8px' } as CSSProperties}
            items={[
              ...PRIMARY.map((i) => ({ value: i.to, href: i.to, label: <TabLabel label={i.label} icon={i.icon} /> })),
              { value: 'more', label: <TabLabel label="Більше" icon={MoreHorizontal} /> },
            ]}
          />
          <GlassButton
            variant="filled"
            tint="var(--glass-add)"
            aria-label="Швидко додати"
            onClick={() => openQuickAdd()}
            icon={<Plus className="!h-6 !w-6" />}
            className="!h-[62px] !w-[62px] shrink-0 !rounded-full shadow-pop"
          />
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
