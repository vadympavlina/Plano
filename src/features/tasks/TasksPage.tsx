import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Columns3, Folder, Inbox, List, Plus, Search } from 'lucide-react';
import { CategoryMark, categoryIcon } from '@/components/common/CategoryMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { RightPanel } from '@/components/layout/RightPanel';
import { toast } from '@/components/ui/toast';
import { useCollections } from '@/hooks/useCollections';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useActions } from '@/hooks/useActions';
import { useUI } from '@/app/providers/UIProvider';
import { useToday } from '@/hooks/useNow';
import { plural, relativeDayLabel } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Task } from '@/types';
import { taskDate } from './logic';
import { boardColumns, listContent, listCounts, listFromParam, type BoardColumn, type TaskListId } from './lists';
import { TaskBoard, TaskRow } from './TaskViews';
import { TaskDetailPanel } from './TaskDetail';
import { Progressive } from '@/components/common/Progressive';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';

const LISTS: { id: TaskListId; label: string }[] = [
  { id: 'all', label: 'Усі' },
  { id: 'inbox', label: 'Вхідні' },
  { id: 'today', label: 'Сьогодні' },
  { id: 'scheduled', label: 'Заплановано' },
  { id: 'done', label: 'Виконані' },
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

interface TaskGroup {
  key: string;
  title: string;
  tone?: 'danger';
  items: Task[];
}

/** Open tasks as sections: no date (inbox), overdue, then one section per day. */
function groupOpen(open: Task[], today: string, list: TaskListId): TaskGroup[] {
  const inbox: Task[] = [];
  const late: Task[] = [];
  const byDay = new Map<string, Task[]>();
  for (const t of open) {
    const d = taskDate(t);
    if (!d) inbox.push(t);
    else if (d < today) late.push(t);
    else byDay.set(d, [...(byDay.get(d) ?? []), t]);
  }
  const groups: TaskGroup[] = [];
  if (inbox.length) groups.push({ key: 'inbox', title: 'Вхідні', items: inbox });
  if (late.length) groups.push({ key: 'late', title: 'Прострочено', tone: 'danger', items: late });
  for (const d of [...byDay.keys()].sort()) {
    groups.push({ key: d, title: relativeDayLabel(d, today, 'EEEEEE, d MMMM'), items: byDay.get(d)! });
  }
  // A single section needs no label (the inbox and "today" lists).
  if (list === 'inbox' && groups.length === 1) groups[0]!.title = '';
  return groups;
}

function GroupSection({ title, count, tone, children }: { title: string; count: number; tone?: 'danger'; children: ReactNode }) {
  return (
    <section className={cn('grid gap-x-6 gap-y-1 border-t border-line py-4 first:border-t-0 first:pt-1', title && 'sm:grid-cols-[150px_1fr]')}>
      {title && (
        <h2 className="px-3 sm:pt-2.5">
          <span className={cn('block text-[15px] font-bold capitalize', tone === 'danger' && 'text-danger')}>{title}</span>
          <span className="mt-0.5 block text-[12px] font-medium text-muted">
            {count} {plural(count, ['задача', 'задачі', 'задач'])}
          </span>
        </h2>
      )}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const list = listFromParam(params.get('list') ?? params.get('filter') ?? 'all');
  const projectId = params.get('project') ?? undefined;
  const categoryId = params.get('category') ?? undefined;
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [mode, setModeState] = useState<ViewMode>(loadMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { tasks, projectById, categoryById } = useCollections();
  const { openTask, openTaskForm } = useUI();
  const actions = useActions();
  useOpenFromQuery(() => openTaskForm());
  const today = useToday();
  const wide = useMediaQuery('(min-width: 1280px)');

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {
      /* ignore */
    }
  };
  const setList = (l: TaskListId) => setParams({ list: l }, { replace: true });

  const scopeList: TaskListId = projectId || categoryId ? (list === 'done' ? 'done' : 'all') : list;
  const content = useMemo(() => listContent(tasks, { list: scopeList, projectId, categoryId }, today, query), [tasks, scopeList, projectId, categoryId, today, query]);
  const counts = useMemo(() => listCounts(tasks, today), [tasks, today]);

  // On wide screens a task opens in the side card; elsewhere in the details sheet.
  const open = useCallback((id: string) => (wide ? setSelectedId(id) : openTask(id)), [wide, openTask]);

  const project = projectId ? projectById(projectId) : undefined;
  const category = categoryId ? categoryById(categoryId) : undefined;
  const title = project?.name ?? category?.name ?? 'Задачі';
  const boardAllowed = scopeList !== 'done';
  const effectiveMode: ViewMode = boardAllowed ? mode : 'list';
  const doneCount = content.done.length;
  const empty = content.open.length === 0 && content.done.length === 0;

  const defaults = (status?: BoardColumn): Partial<Task> => ({
    ...(status && status !== 'completed' ? { status } : {}),
    ...(scopeList === 'today' ? { dueDate: today } : {}),
    ...(projectId ? { projectId } : {}),
    ...(categoryId && categoryId !== 'none' ? { categoryId } : {}),
  });

  const addInline = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const d = defaults();
    const { id, write } = actions.tasks.create({ title: text, status: 'todo', priority: 'medium', tags: [], subtasks: [], ...d });
    write.catch(() => toast.error('Не вдалося додати задачу'));
    toast.success(`Задачу «${text}» додано`, { action: { label: 'Скасувати', onClick: () => void actions.tasks.remove(id).catch(() => undefined) } });
    setDraft('');
  };

  const groups = useMemo(() => groupOpen(content.open, today, scopeList), [content.open, today, scopeList]);
  const row = (t: Task, showDate = true) => <TaskRow key={t.id} task={t} today={today} showDate={showDate} selected={selectedId === t.id} onOpen={open} />;

  const subtitle =
    scopeList === 'done'
      ? `${doneCount} ${plural(doneCount, ['задача', 'задачі', 'задач'])}`
      : content.open.length
        ? `${content.open.length} ${plural(content.open.length, ['відкрита', 'відкриті', 'відкритих'])}`
        : 'Усе зроблено';

  return (
    <div className="pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 px-2">
        <div className="flex min-w-0 items-center gap-3">
          {project ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${colorOf(project.color)}1f`, color: colorOf(project.color) }}>
              <Folder className="h-5 w-5" />
            </span>
          ) : category ? (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${colorOf(category.color)}1f`, color: colorOf(category.color) }}>
              <CategoryMark category={category} className={categoryIcon(category) ? 'h-5 w-5' : undefined} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[38px]">{title}</h1>
            <p className="mt-1.5 text-[13px] text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {boardAllowed && (
            <Segmented<ViewMode>
              ariaLabel="Вигляд"
              size="sm"
              value={effectiveMode}
              onChange={setMode}
              options={[
                { value: 'list', label: <List className="h-4 w-4" aria-label="Список" />, title: 'Список' },
                { value: 'board', label: <Columns3 className="h-4 w-4" aria-label="Дошка" />, title: 'Дошка' },
              ]}
            />
          )}
          <Button variant="dark" size="sm" onClick={() => openTaskForm({ defaults: defaults() })}>
            <Plus className="h-4 w-4" /> Задача
          </Button>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3 px-2">
        <Segmented<TaskListId>
          ariaLabel="Список задач"
          size="sm"
          wrap
          value={projectId || categoryId ? (scopeList === 'done' ? 'done' : 'all') : list}
          onChange={setList}
          options={LISTS.map((l) => ({ value: l.id, label: l.label, count: l.id === 'done' || l.id === 'all' ? undefined : counts[l.id] || undefined }))}
        />
        <div className="hidden min-w-[220px] flex-1 sm:block sm:max-w-[320px]">
          <Input type="search" icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} onValueChange={setQuery} placeholder="Пошук задач" aria-label="Пошук задач" className="h-9 rounded-full" />
        </div>
      </div>
      <div className="mt-3 px-2 sm:hidden">
        <Input type="search" icon={<Search />} value={query} onChange={(e) => setQuery(e.target.value)} onValueChange={setQuery} placeholder="Пошук задач" aria-label="Пошук задач" className="h-9 rounded-full" />
      </div>

      <div className="mt-4">
        {effectiveMode === 'board' ? (
          <div className="px-2">
            <TaskBoard columns={boardColumns(content)} today={today} onAdd={(status) => openTaskForm({ defaults: defaults(status) })} />
          </div>
        ) : (
          <>
            {scopeList !== 'done' && (
              <form onSubmit={addInline} className="mx-1 mb-3 flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-dashed border-subtle/70 text-subtle">
                  <Plus className="h-3 w-3" strokeWidth={3} />
                </span>
                <input autoComplete="off"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-label="Нова задача"
                  placeholder={scopeList === 'today' ? 'Нова задача на сьогодні' : 'Нова задача'}
                  className="-my-2 min-w-0 flex-1 bg-transparent py-2 text-[15.5px] font-medium outline-none placeholder:font-normal placeholder:text-subtle"
                />
              </form>
            )}
            {empty ? (
              <EmptyState
                icon={<Inbox />}
                title={query ? 'Нічого не знайдено' : scopeList === 'today' ? 'На сьогодні все чисто' : scopeList === 'inbox' ? 'Вхідні порожні' : scopeList === 'done' ? 'Виконаних задач поки немає' : 'Тут поки немає задач'}
                description={query ? 'Спробуйте інший запит.' : scopeList === 'inbox' ? 'Сюди потрапляють задачі без дати.' : undefined}
              />
            ) : (
              <div className="px-1">
                {scopeList === 'done' ? (
                  <GroupSection title="" count={doneCount}>
                    <Progressive items={content.done}>{(t) => row(t)}</Progressive>
                  </GroupSection>
                ) : (
                  <>
                    {groups.map((g) => (
                      <GroupSection key={g.key} title={g.title} count={g.items.length} tone={g.tone}>
                        <Progressive items={g.items}>{(t) => row(t, g.key === 'late' || g.key === 'inbox' ? g.key === 'late' : false)}</Progressive>
                      </GroupSection>
                    ))}
                    {doneCount > 0 && (
                      <GroupSection title={scopeList === 'today' ? 'Виконано' : 'Виконано за тиждень'} count={doneCount}>
                        <Progressive items={content.done}>{(t) => row(t, false)}</Progressive>
                      </GroupSection>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {wide && selectedId && (
        <RightPanel>
          <TaskDetailPanel taskId={selectedId} onClose={() => setSelectedId(null)} />
        </RightPanel>
      )}
    </div>
  );
}
