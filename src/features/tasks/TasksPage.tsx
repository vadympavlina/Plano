import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Columns3, Inbox, Layers, List, Plus, Search, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/common/States';
import { useCollections } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useToday } from '@/hooks/useNow';
import { plural, relativeDayLabel } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Task } from '@/types';
import { isOverdue, taskDate } from './logic';
import { boardColumns, listContent, listCounts, listFromParam, type BoardColumn, type TaskListId } from './lists';
import { TaskBoard, TaskRow } from './TaskViews';

const LISTS: { id: TaskListId; label: string; icon: typeof Inbox; tint: string }[] = [
  { id: 'inbox', label: 'Вхідні', icon: Inbox, tint: 'bg-subtle/15 text-muted' },
  { id: 'today', label: 'Сьогодні', icon: Sun, tint: 'bg-warning/15 text-warning' },
  { id: 'scheduled', label: 'Заплановано', icon: CalendarDays, tint: 'bg-primary/10 text-primary' },
  { id: 'all', label: 'Усі задачі', icon: Layers, tint: 'bg-purple/10 text-purple' },
  { id: 'done', label: 'Виконані', icon: CheckCircle2, tint: 'bg-success/10 text-success' },
];

type ViewMode = 'list' | 'board';
const VIEW_KEY = 'plano:tasks-mode';

function loadMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}

function Group({ title, tone, children }: { title: string; tone?: 'danger'; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      {title && <h3 className={cn('mb-0.5 px-3 text-[12px] font-semibold', tone === 'danger' ? 'text-danger' : 'text-subtle')}>{title}</h3>}
      {children}
    </section>
  );
}

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const list = listFromParam(params.get('list') ?? params.get('filter'));
  const projectId = params.get('project') ?? undefined;
  const categoryId = params.get('category') ?? undefined;
  const [query, setQuery] = useState('');
  const [mode, setModeState] = useState<ViewMode>(loadMode);
  const { tasks, projects, categories, projectById, categoryById } = useCollections();
  const { openTaskForm } = useUI();
  const today = useToday();

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {
      /* ignore */
    }
  };
  const go = (next: { list?: TaskListId; project?: string; category?: string }) => {
    const p: Record<string, string> = {};
    if (next.project) p.project = next.project;
    else if (next.category) p.category = next.category;
    else p.list = next.list ?? 'today';
    if (next.project || next.category) p.list = 'all';
    setParams(p, { replace: true });
  };

  const scopeList: TaskListId = projectId || categoryId ? 'all' : list;
  const content = useMemo(() => listContent(tasks, { list: scopeList, projectId, categoryId }, today, query), [tasks, scopeList, projectId, categoryId, today, query]);
  const counts = useMemo(() => listCounts(tasks, today), [tasks, today]);
  const projectCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) if (t.projectId && (t.status === 'todo' || t.status === 'in_progress')) m.set(t.projectId, (m.get(t.projectId) ?? 0) + 1);
    return m;
  }, [tasks]);
  const activeProjects = projects.filter((p) => p.status !== 'archived' && p.status !== 'completed');

  // Header for the current scope.
  const project = projectId ? projectById(projectId) : undefined;
  const category = categoryId ? categoryById(categoryId) : undefined;
  const listMeta = LISTS.find((l) => l.id === list)!;
  const title = project?.name ?? category?.name ?? listMeta.label;
  const boardAllowed = scopeList !== 'done';
  const effectiveMode: ViewMode = boardAllowed ? mode : 'list';
  const doneCount = content.done.length;
  const totalCount = content.open.length + (scopeList === 'today' ? doneCount : 0);

  const defaults = (status?: BoardColumn): Partial<Task> => ({
    ...(status && status !== 'completed' ? { status } : {}),
    ...(scopeList === 'today' ? { dueDate: today } : {}),
    ...(projectId ? { projectId } : {}),
    ...(categoryId && categoryId !== 'none' ? { categoryId } : {}),
  });

  /* ---------- list view groups ---------- */
  const listBody = () => {
    const { open, done } = content;
    if (scopeList === 'today') {
      const late = open.filter((t) => isOverdue(t, today));
      const now = open.filter((t) => !isOverdue(t, today));
      return (
        <>
          {late.length > 0 && (
            <Group title="Прострочено" tone="danger">
              {late.map((t) => (
                <TaskRow key={t.id} task={t} today={today} />
              ))}
            </Group>
          )}
          {now.length > 0 && (
            <Group title={late.length ? 'Сьогодні' : ''}>
              {now.map((t) => (
                <TaskRow key={t.id} task={t} today={today} showDate={false} />
              ))}
            </Group>
          )}
          {done.length > 0 && (
            <Group title={`Виконано · ${done.length}`}>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} today={today} showDate={false} />
              ))}
            </Group>
          )}
        </>
      );
    }
    if (scopeList === 'scheduled') {
      const byDay = new Map<string, Task[]>();
      for (const t of open) {
        const d = taskDate(t)!;
        const key = d < today ? 'late' : d;
        byDay.set(key, [...(byDay.get(key) ?? []), t]);
      }
      return [...byDay.entries()].map(([key, items]) => (
        <Group key={key} title={key === 'late' ? 'Прострочено' : relativeDayLabel(key, today, 'EEEE, d MMMM')} tone={key === 'late' ? 'danger' : undefined}>
          {items.map((t) => (
            <TaskRow key={t.id} task={t} today={today} showDate={key === 'late'} />
          ))}
        </Group>
      ));
    }
    return (
      <>
        {open.length > 0 && (
          <Group title="">
            {open.map((t) => (
              <TaskRow key={t.id} task={t} today={today} />
            ))}
          </Group>
        )}
        {done.length > 0 && (
          <Group title={scopeList === 'done' ? '' : `Виконано за тиждень · ${done.length}`}>
            {done.map((t) => (
              <TaskRow key={t.id} task={t} today={today} />
            ))}
          </Group>
        )}
      </>
    );
  };

  const empty = content.open.length === 0 && content.done.length === 0;

  const navItem = (active: boolean, onClick: () => void, icon: ReactNode, label: string, count?: number) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors',
        active ? 'bg-primary/10 font-semibold text-primary' : 'text-ink hover:bg-surface',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!count && <span className={cn('text-[12px] tabular-nums', active ? '' : 'text-subtle')}>{count}</span>}
    </button>
  );

  const searchBox = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Пошук задач" aria-label="Пошук задач" className="h-9 pl-9" />
      {query && (
        <button type="button" aria-label="Очистити пошук" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-ink" onClick={() => setQuery('')}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  const modeSwitch = boardAllowed && (
    <div role="radiogroup" aria-label="Вигляд" className="flex rounded-xl bg-surface-2 p-1 ring-1 ring-line/70">
      {(
        [
          ['list', 'Список', List],
          ['board', 'Дошка', Columns3],
        ] as const
      ).map(([m, label, Icon]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={effectiveMode === m}
          onClick={() => setMode(m)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] transition-colors',
            effectiveMode === m ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted hover:text-ink',
          )}
        >
          <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );

  const HeadIcon = listMeta.icon;

  return (
    <div className="flex w-full gap-5 px-4 pb-6 sm:px-6 lg:h-[calc(100dvh-72px-2.5rem)] lg:px-6 lg:pb-0">
      {/* Lists */}
      <nav aria-label="Списки задач" className="hidden w-[232px] shrink-0 flex-col gap-0.5 overflow-y-auto pb-4 lg:flex">
        <div className="mb-2">{searchBox}</div>
        {LISTS.map((l) =>
          navItem(!projectId && !categoryId && list === l.id, () => go({ list: l.id }), <l.icon className={cn('h-[18px] w-[18px]', !(!projectId && !categoryId && list === l.id) && 'text-muted')} />, l.label, l.id === 'done' ? undefined : counts[l.id]),
        )}
        {activeProjects.length > 0 && <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Проєкти</p>}
        {activeProjects.map((p) =>
          navItem(
            projectId === p.id,
            () => go({ project: p.id }),
            <span className="mx-[3px] h-3 w-3 shrink-0 rounded-full border-[3px]" style={{ borderColor: colorOf(p.color) }} />,
            p.name,
            projectCounts.get(p.id),
          ),
        )}
        {categories.length > 0 && <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">Категорії</p>}
        {categories.map((c) =>
          navItem(categoryId === c.id, () => go({ category: c.id }), <span className="mx-[5px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(c.color) }} />, c.name),
        )}
      </nav>

      {/* Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[20px] border border-line/60 bg-surface p-4 shadow-soft sm:p-6">
        {/* Phones & tablets: lists as chips */}
        <div className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
          {LISTS.map((l) => {
            const on = !projectId && !categoryId && list === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => go({ list: l.id })}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]', on ? 'bg-accent font-semibold text-surface' : 'border border-line bg-surface text-muted')}
              >
                {l.label}
                {l.id !== 'done' && counts[l.id] > 0 && <span className={cn('text-[11.5px]', on ? 'opacity-70' : 'text-subtle')}>{counts[l.id]}</span>}
              </button>
            );
          })}
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          {project ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorOf(project.color)}1f` }}>
              <span className="h-3.5 w-3.5 rounded-full border-[3.5px]" style={{ borderColor: colorOf(project.color) }} />
            </span>
          ) : category ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${colorOf(category.color)}1f` }}>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorOf(category.color) }} />
            </span>
          ) : (
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', listMeta.tint)}>
              <HeadIcon className="h-5 w-5" />
            </span>
          )}
          <h1 className="text-[24px] font-bold tracking-tight sm:text-[28px]">{title}</h1>
          <span className="text-[13px] text-muted">
            {scopeList === 'today' && totalCount > 0
              ? `${doneCount} з ${totalCount} виконано`
              : scopeList === 'done'
                ? `${doneCount} ${plural(doneCount, ['задача', 'задачі', 'задач'])}`
                : content.open.length
                  ? `${content.open.length} відкритих`
                  : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {modeSwitch}
            <Button variant="dark" size="sm" onClick={() => openTaskForm({ defaults: defaults() })}>
              <Plus className="h-4 w-4" /> Задача
            </Button>
          </div>
        </div>

        <div className="mb-4 lg:hidden">{searchBox}</div>

        {effectiveMode === 'board' ? (
          <TaskBoard columns={boardColumns(content)} today={today} onAdd={(status) => openTaskForm({ defaults: defaults(status) })} />
        ) : empty ? (
          <EmptyState
            className="flex-1"
            icon={<HeadIcon />}
            title={
              query
                ? 'Нічого не знайдено'
                : scopeList === 'today'
                  ? 'На сьогодні все чисто'
                  : scopeList === 'inbox'
                    ? 'Вхідні порожні'
                    : scopeList === 'done'
                      ? 'Виконаних задач поки немає'
                      : 'Тут поки немає задач'
            }
            description={query ? 'Спробуйте інший запит.' : scopeList === 'inbox' ? 'Сюди потрапляють задачі без дати.' : undefined}
            action={
              !query &&
              scopeList !== 'done' && (
                <Button variant="outline" size="sm" onClick={() => openTaskForm({ defaults: defaults() })}>
                  <Plus className="h-3.5 w-3.5" /> Додати задачу
                </Button>
              )
            }
          />
        ) : (
          <div className="scrollbar-thin -mx-2 min-h-0 flex-1 overflow-y-auto px-2">
            <div className="w-full">
              {scopeList !== 'done' && (
                <button
                  type="button"
                  onClick={() => openTaskForm({ defaults: defaults() })}
                  className="mb-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2.5 text-left text-[14px] text-subtle transition-colors hover:border-subtle hover:text-ink"
                >
                  <Plus className="h-[18px] w-[18px]" /> {scopeList === 'today' ? 'Нова задача на сьогодні' : 'Нова задача'}
                </button>
              )}
              {listBody()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
