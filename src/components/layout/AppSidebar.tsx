import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { Logo, LogoMark } from '@/components/common/Logo';
import { cn } from '@/lib/utils/cn';
import { NAV_ITEMS } from './nav';
import { useSyncSummary } from './SyncIndicator';
import { UserMenu } from './UserMenu';
import { Avatar } from './Avatar';
import { useProfile } from '@/hooks/useProfile';

const MAIN_ITEMS = NAV_ITEMS.filter((i) => i.to !== '/settings');

/** Desktop navigation: a floating dark "island" with the menu, the account and settings. */
export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const profile = useProfile();
  const sync = useSyncSummary();
  const syncDot = sync.tone === 'success' ? 'bg-success' : sync.tone === 'warning' ? 'bg-warning' : sync.tone === 'danger' ? 'bg-danger' : 'bg-sidebar-muted';

  const itemClass = (isActive: boolean) =>
    cn(
      'flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors',
      collapsed && 'justify-center px-0',
      isActive ? 'bg-white font-semibold text-[#172033]' : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-fg',
    );

  return (
    <aside
      className={cn('sticky top-0 hidden h-dvh shrink-0 p-3 pl-[max(0.75rem,env(safe-area-inset-left))] transition-[width] duration-200 lg:block', collapsed ? 'w-[92px]' : 'w-[252px]')}
      aria-label="Головна навігація"
    >
      <div className="flex h-full flex-col rounded-[22px] bg-sidebar p-3 text-sidebar-fg shadow-pop">
        <div className={cn('mb-4 flex h-11 items-center justify-between pl-2', collapsed && 'justify-center pl-0')}>
          {collapsed ? <LogoMark className="h-[26px] w-[26px]" tone="light" /> : <Logo tone="light" className="text-white" />}
          {!collapsed && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/[0.06] hover:text-sidebar-fg"
              aria-label="Згорнути панель"
              aria-expanded
              title="Згорнути панель"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>

        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto">
          {MAIN_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined} className={({ isActive }) => itemClass(isActive)}>
              {({ isActive }) => (
                <>
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.1 : 1.8} />
                  <span className={cn(collapsed && 'sr-only')}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 space-y-1">
          {collapsed && (
            <button
              type="button"
              onClick={onToggle}
              className="flex h-10 w-full items-center justify-center rounded-xl text-sidebar-muted transition-colors hover:bg-white/[0.06] hover:text-sidebar-fg"
              aria-label="Розгорнути панель"
              aria-expanded={false}
              title="Розгорнути панель"
            >
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            </button>
          )}
          <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
            <UserMenu
              side="top"
              trigger={
                <button
                  type="button"
                  className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06]', collapsed && 'justify-center')}
                  aria-label="Меню акаунта"
                >
                  <span className="relative shrink-0">
                    <Avatar name={profile.name} src={profile.avatarUrl} />
                    {collapsed && <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-sidebar', syncDot)} />}
                  </span>
                  {!collapsed && (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-sidebar-fg">{profile.name || 'Акаунт'}</span>
                      <span className="flex items-center gap-1.5 truncate text-[11.5px] text-sidebar-muted" title={`${sync.label} — ${sync.detail}`} role="status">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', syncDot)} />
                        {sync.label}
                      </span>
                    </span>
                  )}
                </button>
              }
            />
            <NavLink
              to="/settings"
              title="Налаштування"
              aria-label="Налаштування"
              className={({ isActive }) =>
                cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
                  isActive ? 'bg-white text-[#172033]' : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-fg',
                )
              }
            >
              <Settings className="h-[18px] w-[18px]" />
            </NavLink>
          </div>
        </div>
      </div>
    </aside>
  );
}
