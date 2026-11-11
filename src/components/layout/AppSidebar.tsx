import { NavLink } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SidebarNav } from './SidebarNav';
import { useSyncSummary } from './SyncIndicator';
import { UserMenu } from './UserMenu';
import { Avatar } from './Avatar';
import { useProfile } from '@/hooks/useProfile';

export function SidebarFooter() {
  const profile = useProfile();
  const sync = useSyncSummary();
  const syncDot = sync.tone === 'success' ? 'bg-success' : sync.tone === 'warning' ? 'bg-warning' : sync.tone === 'danger' ? 'bg-danger' : 'bg-sidebar-muted';
  return (
    <div className="flex items-center gap-1 pt-2">
      <UserMenu
        side="top"
        trigger={
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full p-1.5 pr-3 text-left transition-colors hover:bg-white/6"
            aria-label="Меню акаунта"
          >
            <Avatar name={profile.name} src={profile.avatarUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-sidebar-fg">{profile.name || 'Акаунт'}</span>
              <span className="flex items-center gap-1.5 truncate text-[11.5px] text-sidebar-muted" title={`${sync.label} — ${sync.detail}`} role="status">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', syncDot)} />
                {sync.label}
              </span>
            </span>
          </button>
        }
      />
      <NavLink
        to="/settings"
        title="Налаштування"
        aria-label="Налаштування"
        className={({ isActive }) =>
          cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
            isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-muted hover:bg-white/6 hover:text-white',
          )
        }
      >
        <Settings className="h-[18px] w-[18px]" />
      </NavLink>
    </div>
  );
}

/** Desktop navigation: sits flat on the dark frame, with pills for the current section. */
export function AppSidebar() {
  return (
    <aside className="hidden w-[250px] shrink-0 flex-col pb-3.5 pl-[max(14px,env(safe-area-inset-left))] pr-1 lg:flex" aria-label="Головна навігація">
      <SidebarNav />
      <SidebarFooter />
    </aside>
  );
}
