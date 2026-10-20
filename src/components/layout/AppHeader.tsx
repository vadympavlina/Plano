import { useLocation } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/misc';
import { useUI } from '@/app/providers/UIProvider';
import { LogoMark } from '@/components/common/Logo';
import { CreateMenu } from './CreateMenu';
import { UserMenu } from './UserMenu';
import { Avatar } from './Avatar';
import { titleForPath } from './nav';
import { useProfile } from '@/hooks/useProfile';
import { SyncIndicator, useSyncSummary } from './SyncIndicator';

export function AppHeader() {
  const { pathname } = useLocation();
  const { openSearch } = useUI();
  const profile = useProfile();
  const title = titleForPath(pathname);
  const sync = useSyncSummary();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 pt-safe backdrop-blur-md lg:border-none lg:bg-bg/70">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <LogoMark className="h-7 w-7" />
          <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
        </div>
        <span className="sr-only">{title}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openSearch}
            className="hidden h-10 w-[280px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-subtle transition-colors hover:border-subtle/50 md:flex"
            aria-label="Пошук"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Пошук…</span>
            <Kbd>{isMac ? '⌘' : 'Ctrl'} K</Kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Пошук" onClick={openSearch}>
            <Search className="h-5 w-5" />
          </Button>
          <div className="hidden lg:block">
            <CreateMenu
              trigger={
                <Button variant="dark" size="md" aria-label="Створити">
                  <Plus className="h-4 w-4" /> Створити
                </Button>
              }
            />
          </div>
          <div className="lg:hidden">
            <UserMenu
              trigger={
                <button type="button" aria-label="Меню акаунта" className="relative rounded-full">
                  <Avatar name={profile.name} src={profile.avatarUrl} />
                </button>
              }
            />
          </div>
        </div>
      </div>
      {sync.tone !== 'success' && (
        <div className="flex items-center px-4 pb-2 sm:px-6 lg:hidden">
          <SyncIndicator variant="header" />
        </div>
      )}
    </header>
  );
}
