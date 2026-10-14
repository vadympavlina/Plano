import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Info } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { MobileNav } from './MobileNav';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { UIProvider, useUI } from '@/app/providers/UIProvider';
import { useData } from '@/app/providers/DataProvider';
import { LoadingState, ErrorState } from '@/components/common/States';

const COLLAPSE_KEY = 'plano:sidebar-collapsed';

export function AppLayout() {
  return (
    <UIProvider>
      <LayoutInner />
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
  const { openSearch } = useUI();
  const { ready, error, backendKind } = useData();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // ⌘K / Ctrl+K opens global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch]);

  // Scroll to top on navigation.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {backendKind === 'local' && (
          <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-xs text-ink sm:px-8">
            <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold">Local preview.</strong> Data is stored only in this browser and is not synced. Configure Firebase to use Plano across devices.
            </span>
          </div>
        )}
        <AppHeader />
        <main className="min-w-0 flex-1 pb-[calc(84px+env(safe-area-inset-bottom))] pl-safe pr-safe lg:pb-10">
          {error && !ready ? (
            <ErrorState title="Could not load your data" message={error} onRetry={() => window.location.reload()} />
          ) : !ready ? (
            <LoadingState label="Loading your data…" className="py-32" />
          ) : (
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}
