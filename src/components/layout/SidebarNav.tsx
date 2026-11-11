import { useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Folder, Plus } from 'lucide-react';
import { CategoryMark, categoryIcon } from '@/components/common/CategoryMark';
import { useData } from '@/app/providers/DataProvider';
import { useCollections } from '@/hooks/useCollections';
import { useToday } from '@/hooks/useNow';
import { isDone, isScheduled } from '@/features/habits/logic';
import { isOpen } from '@/features/tasks/logic';
import { openInList } from '@/features/tasks/lists';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { NAV_ITEMS } from './nav';

const GROUPS_KEY = 'plano:sidebar-groups';
const readClosed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const itemCls = (on: boolean, big: boolean) =>
  cn(
    'flex items-center gap-3 rounded-full px-3.5 font-medium transition-colors',
    big ? 'h-12 text-[16px]' : 'h-[38px] text-[14.5px]',
    on ? 'bg-sidebar-active text-white' : 'text-[#cfcfd4] hover:bg-white/6 hover:text-white',
  );
const subCls = (on: boolean, big: boolean) =>
  cn(
    'flex items-center gap-2.5 rounded-full px-3.5 transition-colors',
    big ? 'h-11 text-[15px]' : 'h-8 text-[14px]',
    on ? 'bg-sidebar-active text-white' : 'text-[#cfcfd4] hover:bg-white/6 hover:text-white',
  );

function Group({ id, label, to, onAdd, children, big }: { id: string; label: string; to?: string; onAdd?: () => void; children: ReactNode; big?: boolean }) {
  const [closed, setClosed] = useState(() => readClosed().includes(id));
  const toggle = () => {
    const next = closed ? readClosed().filter((x) => x !== id) : [...readClosed(), id];
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setClosed(!closed);
  };
  const navigate = useNavigate();
  return (
    <div className="mt-4">
      <div className={cn('mb-1 flex items-center gap-1 px-3.5 font-semibold text-sidebar-muted', big ? 'text-[12.5px]' : 'text-[11.5px]')}>
        <button type="button" onClick={to ? () => void navigate(to) : toggle} className="hover:text-white">
          {label}
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={closed ? `Розгорнути «${label}»` : `Згорнути «${label}»`}
          className="rounded-sm p-0.5 hover:text-white"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', closed && '-rotate-90')} />
        </button>
        {onAdd && (
          <button type="button" onClick={onAdd} aria-label={`Додати: ${label}`} className="ml-auto rounded-sm p-1 hover:text-white">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {!closed && <div className="space-y-px">{children}</div>}
    </div>
  );
}

/** The navigation, projects ("folders") and categories ("tags") — shared by the desktop sidebar and the phone drawer. */
export function SidebarNav({ onNavigate, big }: { onNavigate?: () => void; big?: boolean }) {
  const { projects, categories } = useCollections();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const go = (to: string) => () => {
    void navigate(to);
    onNavigate?.();
  };
  const { tasks, habits } = useCollections();
  const { data } = useData();
  const today = useToday();
  // Small counters next to the sections that have something waiting.
  const counts = useMemo<Record<string, number>>(
    () => ({
      '/': tasks.filter((t) => openInList(t, 'today', today)).length,
      '/tasks': tasks.filter(isOpen).length,
      '/habits': habits.filter((h) => !h.archived && isScheduled(h, today) && !isDone(h, data.habitLogs, today)).length,
    }),
    [tasks, habits, data.habitLogs, today],
  );
  const activeProjects = projects.filter((p) => p.status !== 'archived');
  const categoryId = new URLSearchParams(search).get('category');

  return (
    <nav aria-label="Розділи" className="scrollbar-thin flex-1 overflow-y-auto pb-3">
      <div className="space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => itemCls(isActive, !!big)}>
            {({ isActive }) => (
              <>
                <Icon
                  className={cn('shrink-0', big ? 'h-5 w-5' : 'h-[18px] w-[18px]', isActive ? 'text-primary-bright' : 'text-sidebar-muted')}
                  strokeWidth={isActive ? 2.1 : 1.9}
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {!!counts[to] && (
                  <span className={cn('rounded-full px-2 text-[12px] font-semibold tabular-nums', isActive ? 'bg-white/15 text-white' : 'text-sidebar-muted')}>
                    {counts[to]}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <Group id="projects" label="Проєкти" to="/projects" onAdd={go('/projects?new=1')} big={big}>
        {activeProjects.map((p) => (
          <NavLink key={p.id} to={`/projects/${p.id}`} onClick={onNavigate} className={({ isActive }) => subCls(isActive, !!big)}>
            <ChevronRight className="h-3 w-3 shrink-0 text-sidebar-muted" />
            <Folder className="h-4 w-4 shrink-0" style={{ color: colorOf(p.color) }} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
          </NavLink>
        ))}
        {activeProjects.length === 0 && <p className="px-3.5 py-1 text-[12.5px] text-sidebar-muted">Проєктів ще немає</p>}
      </Group>

      <Group id="categories" label="Категорії" onAdd={go('/settings/categories')} big={big}>
        {categories.map((c) => (
          <NavLink key={c.id} to={`/tasks?category=${c.id}`} onClick={onNavigate} className={() => subCls(pathname === '/tasks' && categoryId === c.id, !!big)}>
            <span className="flex w-4 shrink-0 justify-center" style={{ color: colorOf(c.color) }}>
              {categoryIcon(c) ? (
                <CategoryMark category={c} className="h-4 w-4" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(c.color) }} />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
          </NavLink>
        ))}
      </Group>
    </nav>
  );
}
