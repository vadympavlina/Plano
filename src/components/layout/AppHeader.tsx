import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Menu, PanelLeft, Plus, Search, SquarePen } from 'lucide-react';
import { useUI } from '@/app/providers/UIProvider';
import { CreateMenu } from './CreateMenu';
import { UserMenu } from './UserMenu';
import { Avatar } from './Avatar';
import { SyncIndicator, useSyncSummary } from './SyncIndicator';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils/cn';

const round =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-[#cfcfd4] transition-colors hover:bg-[#323237] hover:text-white';

function SearchPill({ className }: { className?: string }) {
  const { openSearch } = useUI();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Пошук"
      className={cn(
        'flex h-11 items-center gap-2.5 rounded-full bg-sidebar-active px-4 text-[14.5px] text-sidebar-muted transition-colors hover:bg-[#323237]',
        className,
      )}
    >
      <Search className="h-[17px] w-[17px] shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">
        <span className="sm:hidden">Пошук</span>
        <span className="hidden sm:inline">Пошук або створити будь-що…</span>
      </span>
      <kbd className="ml-auto hidden rounded-lg bg-[#34343a] px-2 py-0.5 font-sans text-[12px] font-semibold text-[#b3b3bb] lg:block">
        {isMac ? '⌘' : 'Ctrl'} K
      </kbd>
    </button>
  );
}

/** The dark top bar. Desktop: window-style buttons, search in the middle, "Створити" on the right. Phone: menu, search, account. */
export function AppHeader({ onToggleSidebar, onOpenMenu }: { onToggleSidebar: () => void; onOpenMenu: () => void }) {
  const navigate = useNavigate();
  const { openQuickAdd } = useUI();
  const profile = useProfile();
  const sync = useSyncSummary();

  return (
    <header className="z-30 shrink-0 lg:sticky lg:top-0">
      {/* Desktop */}
      <div className="relative hidden h-[72px] items-center gap-2.5 pl-[max(18px,env(safe-area-inset-left))] pr-[max(18px,env(safe-area-inset-right))] lg:flex">
        <button type="button" className={round} onClick={onToggleSidebar} aria-label="Показати чи сховати меню" title="Меню">
          <PanelLeft className="h-[18px] w-[18px]" />
        </button>
        <button type="button" className={round} onClick={() => openQuickAdd()} aria-label="Швидко додати" title="Швидко додати (N)">
          <SquarePen className="h-[18px] w-[18px]" />
        </button>
        <button type="button" className={round} onClick={() => navigate(-1)} aria-label="Назад" title="Назад">
          <ChevronLeft className="h-[18px] w-[18px]" />
        </button>
        <button type="button" className={round} onClick={() => navigate(1)} aria-label="Вперед" title="Вперед">
          <ChevronRight className="h-[18px] w-[18px]" />
        </button>
        <SearchPill className="absolute left-1/2 w-[min(460px,38vw)] -translate-x-1/2" />
        <div className="ml-auto">
          <CreateMenu
            trigger={
              <button
                type="button"
                aria-label="Створити"
                className="flex h-11 items-center gap-2 rounded-full bg-[#f4f3f1] px-5 text-sm font-semibold text-[#161618] transition-colors hover:bg-white"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} /> Створити
              </button>
            }
          />
        </div>
      </div>

      {/* Phone & tablet */}
      <div className="flex h-[60px] items-center gap-2.5 px-3.5 lg:hidden">
        <button type="button" className={round} onClick={onOpenMenu} aria-label="Меню" aria-haspopup="dialog">
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <SearchPill className="min-w-0 flex-1" />
        <UserMenu
          trigger={
            <button type="button" aria-label="Меню акаунта" className="relative shrink-0 rounded-full">
              <Avatar name={profile.name} src={profile.avatarUrl} />
            </button>
          }
        />
      </div>
      {sync.tone !== 'success' && sync.tone !== 'muted' && (
        <div className="flex items-center px-4 pb-2 lg:hidden">
          <SyncIndicator variant="sidebar" />
        </div>
      )}
    </header>
  );
}
