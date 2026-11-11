import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Info } from 'lucide-react';
import { ReminderSync } from '@/features/reminders/ReminderSync';
import { NotificationActions } from '@/features/reminders/NotificationActions';
import { AppBadge } from '@/app/AppBadge';
import { ShareTarget } from '@/app/ShareTarget';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileDrawer, MobileNav } from './MobileNav';
import { PanelSlot } from './RightPanel';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { UIProvider, useUI } from '@/app/providers/UIProvider';
import { GoogleSyncProvider } from '@/features/integrations/GoogleSyncProvider';
import { useData } from '@/app/providers/DataProvider';
import { PageSkeleton, ErrorState } from '@/components/common/States';
import { cn } from '@/lib/utils/cn';

const COLLAPSE_KEY = 'plano:sidebar-collapsed';

export function AppLayout() {
  return (
    <UIProvider>
      <GoogleSyncProvider>
        <ReminderSync />
        <NotificationActions />
        <AppBadge />
        <ShareTarget />
        <LayoutInner />
      </GoogleSyncProvider>
    </UIProvider>
  );
}

function LayoutInner() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { openSearch, openQuickAdd } = useUI();
  const { ready, error, backendKind } = useData();

  // The page's side card (see RightPanel): a slot in the layout that pages fill through a portal.
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);
  const [panels, setPanels] = useState(0);
  const mount = useCallback(() => {
    setPanels((n) => n + 1);
    return () => setPanels((n) => n - 1);
  }, []);

  // Phones: swipe right from the left edge to open the menu (the drawer closes with a swipe left).
  // A thin strip owns the edge with touch-action: pan-y, so the browser leaves the sideways move to us.
  const edge = useRef<{ x: number; y: number } | null>(null);
  const edgeHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch' || menuOpen || document.querySelector('[role=dialog]')) return;
      edge.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = edge.current;
      if (!s) return;
      const dx = e.clientX - s.x;
      if (Math.abs(e.clientY - s.y) > 24 && Math.abs(e.clientY - s.y) > dx) edge.current = null;
      else if (dx > 48) {
        edge.current = null;
        setMenuOpen(true);
      }
    },
    onPointerUp: () => void (edge.current = null),
    onPointerCancel: () => void (edge.current = null),
  };

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // ⌘K / Ctrl+K opens global search; N (outside text fields and dialogs) opens quick capture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest('[role="dialog"],[role="menu"]');
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'n' || e.key === 'т' || e.key === 'N' || e.key === 'Т')) {
        e.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch, openQuickAdd]);

  // Back to the top on navigation between pages (not between sections of one page, e.g. /settings/data).
  const scroller = useRef<HTMLElement>(null);
  const lastPage = useRef(pathname.split('/')[1]);
  useEffect(() => {
    const pageKey = pathname.split('/')[1];
    if (pageKey !== lastPage.current) {
      window.scrollTo({ top: 0 });
      scroller.current?.scrollTo({ top: 0 });
    }
    lastPage.current = pageKey;
  }, [pathname]);

  const banner = backendKind === 'local';
  // Height of what is left for the page on wide screens: top bar, the preview banner, the frame below and the card's padding.
  const pageH = `calc(100dvh - ${72 + (banner ? 36 : 0)}px - 14px - 2.5rem)`;

  return (
    <PanelSlot.Provider value={{ el: panelEl, mount }}>
      <div className="flex min-h-dvh flex-col pt-safe text-sidebar-fg lg:h-dvh lg:overflow-hidden" style={{ '--page-h': pageH } as React.CSSProperties}>
        {/* Keyboard: the first Tab stop jumps over the menu to the page (a button, not #anchor: the hash is the route). */}
        <button
          type="button"
          onClick={() => scroller.current?.focus()}
          className="fixed left-3 top-3 z-[80] -translate-y-24 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-pop focus:translate-y-0"
        >
          Перейти до вмісту
        </button>
        {banner && (
          <div className="flex h-9 shrink-0 items-center gap-2 bg-sidebar-active px-4 text-xs text-sidebar-fg sm:px-8">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary-bright" />
            <span className="truncate">
              <strong className="font-semibold">Локальний перегляд.</strong>
              <span className="sm:hidden"> Дані лише в цьому браузері.</span>
              <span className="hidden sm:inline"> Дані зберігаються лише в цьому браузері й не синхронізуються. Налаштуйте Firebase, щоб користуватися Plano на всіх пристроях.</span>
            </span>
          </div>
        )}
        <AppHeader onToggleSidebar={() => setCollapsed((c) => !c)} onOpenMenu={() => setMenuOpen(true)} />
        <div className="flex min-h-0 flex-1">
          {/* Always mounted: it slides out (translate + fade) while its column closes, so opening and
              closing is a motion, not a jump. Collapsed, it is inert (no focus, no clicks). */}
          <div
            aria-hidden={collapsed || undefined}
            inert={collapsed}
            className={cn(
              'hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:block',
              collapsed ? 'w-0' : 'w-[250px]',
            )}
          >
            <div
              className={cn(
                'flex h-full w-[250px] transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-opacity',
                collapsed && '-translate-x-8 opacity-0',
              )}
            >
              <AppSidebar />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 gap-2.5 px-2 pr-[max(8px,env(safe-area-inset-right))] lg:pb-3.5 lg:pl-2 lg:pr-[max(14px,env(safe-area-inset-right))]">
            <main
              ref={scroller}
              tabIndex={-1}
              className={cn(
                'outline-none focus-visible:ring-0',
                'min-w-0 flex-1 rounded-t-[26px] bg-surface text-ink lg:overflow-y-auto lg:rounded-[24px]',
                'pb-[calc(110px+max(12px,env(safe-area-inset-bottom)))] lg:pb-0',
              )}
            >
              <div className="px-2 pt-4 sm:px-3 lg:px-3 lg:py-5">
                {error && !ready ? (
                  <ErrorState title="Не вдалося завантажити ваші дані" message={error} onRetry={() => window.location.reload()} />
                ) : !ready ? (
                  <PageSkeleton label="Завантажуємо ваші дані…" />
                ) : (
                  <ErrorBoundary resetKey={pathname}>
                    {/* Soft fade between sections (not between views of one section). */}
                    <div key={pathname.split('/')[1]} className="motion-safe:animate-page-in">
                      <Outlet />
                    </div>
                  </ErrorBoundary>
                )}
              </div>
            </main>
            <aside
              ref={setPanelEl}
              aria-label="Бічна панель"
              className={cn('hidden w-[372px] shrink-0 overflow-y-auto rounded-[24px] bg-surface p-5 text-ink', panels > 0 && 'xl:block')}
            />
          </div>
        </div>
      </div>
      <div aria-hidden className="fixed inset-y-0 left-0 z-30 w-4 touch-pan-y lg:hidden" {...edgeHandlers} />
      <MobileNav />
      <MobileDrawer open={menuOpen} onOpenChange={setMenuOpen} />
    </PanelSlot.Provider>
  );
}

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`w-full px-2 sm:px-3 ${className}`}>{children}</div>;
}
