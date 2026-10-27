import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Info } from 'lucide-react';
import { ReminderSync } from '@/features/reminders/ReminderSync';
import { NotificationActions } from '@/features/reminders/NotificationActions';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileNav } from './MobileNav';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { UIProvider, useUI } from '@/app/providers/UIProvider';
import { GoogleSyncProvider } from '@/features/integrations/GoogleSyncProvider';
import { useData } from '@/app/providers/DataProvider';
import { PageSkeleton, ErrorState } from '@/components/common/States';

const COLLAPSE_KEY = 'plano:sidebar-collapsed';

export function AppLayout() {
  return (
    <UIProvider>
      <GoogleSyncProvider>
        <ReminderSync />
        <NotificationActions />
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
  const { pathname } = useLocation();
  const { openSearch, openQuickAdd } = useUI();
  const { ready, error, backendKind } = useData();

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

  // Scroll to top on navigation between pages (not between sections of one page, e.g. /settings/data).
  const lastPage = useRef(pathname.split('/')[1]);
  useEffect(() => {
    const pageKey = pathname.split('/')[1];
    if (pageKey !== lastPage.current) window.scrollTo({ top: 0 });
    lastPage.current = pageKey;
  }, [pathname]);

  return (
    <div className="flex min-h-dvh">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {backendKind === 'local' && (
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-xs text-ink sm:px-8">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold">Локальний перегляд.</strong> Дані зберігаються лише в цьому браузері й не синхронізуються. Налаштуйте Firebase, щоб користуватися Plano на всіх пристроях.
            </span>
          </div>
        )}
        <AppHeader />
        <main className="min-w-0 flex-1 pb-[calc(88px+max(12px,env(safe-area-inset-bottom)))] pl-safe pr-safe lg:pb-10">
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
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`w-full px-4 sm:px-6 ${className}`}>{children}</div>;
}
