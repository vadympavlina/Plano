import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Folder, Plus } from 'lucide-react';
import { CategoryMark, categoryIcon } from '@/components/common/CategoryMark';
import { useCollections } from '@/hooks/useCollections';
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

const itemCls = (on: boolean) =>
  cn(
    'flex h-[38px] items-center gap-3 rounded-full px-3.5 text-[14.5px] font-medium transition-colors',
    on ? 'bg-sidebar-active text-white' : 'text-[#cfcfd4] hover:bg-white/[0.06] hover:text-white',
  );
const subCls = (on: boolean) =>
  cn(
    'flex h-8 items-center gap-2.5 rounded-full px-3.5 text-[14px] transition-colors',
    on ? 'bg-sidebar-active text-white' : 'text-[#cfcfd4] hover:bg-white/[0.06] hover:text-white',
  );

function Group({ id, label, to, onAdd, children }: { id: string; label: string; to?: string; onAdd?: () => void; children: ReactNode }) {
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
      <div className="mb-1 flex items-center gap-1 px-3.5 text-[11.5px] font-semibold text-sidebar-muted">
        <button type="button" onClick={to ? () => navigate(to) : toggle} className="hover:text-white">
          {label}
        </button>
        <button type="button" onClick={toggle} aria-label={closed ? `Розгорнути «${label}»` : `Згорнути «${label}»`} className="rounded p-0.5 hover:text-white">
          <ChevronDown className={cn('h-3 w-3 transition-transform', closed && '-rotate-90')} />
        </button>
        {onAdd && (
          <button type="button" onClick={onAdd} aria-label={`Додати: ${label}`} className="ml-auto rounded p-1 hover:text-white">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {!closed && <div className="space-y-px">{children}</div>}
    </div>
  );
}

/** The navigation, projects ("folders") and categories ("tags") — shared by the desktop sidebar and the phone drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { projects, categories } = useCollections();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const go = (to: string) => () => {
    navigate(to);
    onNavigate?.();
  };
  const activeProjects = projects.filter((p) => p.status !== 'archived');
  const categoryId = new URLSearchParams(search).get('category');

  return (
    <nav aria-label="Розділи" className="scrollbar-thin flex-1 overflow-y-auto pb-3">
      <div className="space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate} className={({ isActive }) => itemCls(isActive)}>
            {({ isActive }) => (
              <>
                <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-sidebar-muted')} strokeWidth={isActive ? 2.1 : 1.9} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <Group id="projects" label="Проєкти" to="/projects" onAdd={go('/projects?new=1')}>
        {activeProjects.map((p) => (
          <NavLink key={p.id} to={`/projects/${p.id}`} onClick={onNavigate} className={({ isActive }) => subCls(isActive)}>
            <ChevronRight className="h-3 w-3 shrink-0 text-sidebar-muted" />
            <Folder className="h-4 w-4 shrink-0" style={{ color: colorOf(p.color) }} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
          </NavLink>
        ))}
        {activeProjects.length === 0 && <p className="px-3.5 py-1 text-[12.5px] text-sidebar-muted">Проєктів ще немає</p>}
      </Group>

      <Group id="categories" label="Категорії" onAdd={go('/settings/categories')}>
        {categories.map((c) => (
          <NavLink key={c.id} to={`/tasks?category=${c.id}`} onClick={onNavigate} className={() => subCls(pathname === '/tasks' && categoryId === c.id)}>
            <span className="flex w-4 shrink-0 justify-center" style={{ color: colorOf(c.color) }}>
              {categoryIcon(c) ? <CategoryMark category={c} className="h-4 w-4" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorOf(c.color) }} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
          </NavLink>
        ))}
      </Group>
    </nav>
  );
}
