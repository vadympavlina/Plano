import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, MoreHorizontal } from 'lucide-react';
import { Logo, LogoMark } from '@/components/common/Logo';
import { cn } from '@/lib/utils/cn';
import { NAV_ITEMS } from './nav';
import { SyncIndicator } from './SyncIndicator';
import { UserMenu } from './UserMenu';
import { Avatar } from './Avatar';
import { useProfile } from '@/hooks/useProfile';

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const profile = useProfile();
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar pl-safe text-sidebar-fg transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[76px]' : 'w-[232px]',
      )}
      aria-label="Головна навігація"
    >
      <div className={cn('flex h-[72px] items-center px-5', collapsed && 'justify-center px-0')}>
        {collapsed ? <LogoMark className="h-[22px] w-[22px]" tone="light" /> : <Logo tone="light" className="text-white" />}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-white')} strokeWidth={isActive ? 2.1 : 1.8} />
                <span className={cn(collapsed && 'sr-only')}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/5 px-3 pb-4 pt-3">
        {!collapsed && (
          <p className="px-2 text-[11.5px] leading-relaxed text-sidebar-muted/80">
            Твоє життя.
            <br />
            В одному місці.
          </p>
        )}
        <div className="px-2">
          <SyncIndicator collapsed={collapsed} />
        </div>
        <UserMenu
          side="top"
          trigger={
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-active',
                collapsed && 'justify-center',
              )}
              aria-label="Меню акаунта"
            >
              <Avatar name={profile.name} src={profile.avatarUrl} />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-sidebar-fg">{profile.name || 'Акаунт'}</span>
                    <span className="block truncate text-[11px] text-sidebar-muted">
                      {profile.mode === 'preview' ? 'Локальний перегляд' : profile.email}
                    </span>
                  </span>
                  <MoreHorizontal className="h-4 w-4 text-sidebar-muted" />
                </>
              )}
            </button>
          }
        />
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-xs text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-fg',
            collapsed && 'justify-center',
          )}
          aria-label={collapsed ? 'Розгорнути панель' : 'Згорнути панель'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && 'Згорнути'}
        </button>
      </div>
    </aside>
  );
}
