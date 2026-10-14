import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownUp, CheckSquare, ChevronDown, Layers, List, Plus, Search, Tag, X } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, Dot, Segmented } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { useCollections } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useToday } from '@/hooks/useNow';
import { plural } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { TaskItem } from './TaskItem';
import {
  filterTasks,
  groupTasks,
  matchesFilter,
  sortTasks,
  type TaskFilter,
  type TaskGrouping,
  type TaskSort,
} from './logic';

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: 'all', label: 'Усі' },
  { value: 'today', label: 'Сьогодні' },
  { value: 'upcoming', label: 'Майбутні' },
  { value: 'overdue', label: 'Прострочені' },
  { value: 'completed', label: 'Виконані' },
];

const PREFS_KEY = 'plano:tasks-view';

function loadPrefs(): { sort: TaskSort; group: TaskGrouping } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { sort: raw.sort ?? 'due', group: raw.group ?? 'category' };
  } catch {
    return { sort: 'due', group: 'category' };
  }
}

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.find((f) => f.value === params.get('filter'))?.value ?? 'all') as TaskFilter;
  const [query, setQuery] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const { tasks, categoryById, projectById, categories } = useCollections();
  const { openTaskForm } = useUI();
  const today = useToday();

  const updatePrefs = (p: Partial<typeof prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, tasks.filter((t) => matchesFilter(t, f.value, today)).length])),
    [tasks, today],
  );

  const groups = useMemo(() => {
    let list = filterTasks(tasks, filter, today, query);
    if (categoryFilter) list = list.filter((t) => (categoryFilter === 'none' ? !t.categoryId : t.categoryId === categoryFilter));
    const sorted = sortTasks(list, prefs.sort, filter);
    return groupTasks(sorted, filter === 'completed' ? 'none' : prefs.group);
  }, [tasks, filter, today, query, prefs, categoryFilter]);

  const total = groups.reduce((n, g) => n + g.tasks.length, 0);

  const groupInfo = (key: string) => {
    if (key === 'all') return { name: '', color: undefined };
    if (key === 'none') return { name: prefs.group === 'category' ? 'Без категорії' : 'Без проєкту', color: '#9AA2B2' };
    if (prefs.group === 'category') {
      const c = categoryById(key);
      return { name: c?.name ?? 'Невідома категорія', color: colorOf(c?.color) };
    }
    const p = projectById(key);
    return { name: p?.name ?? 'Невідомий проєкт', color: colorOf(p?.color) };
  };

  const defaultsForFilter = () => (filter === 'today' ? { dueDate: today } : {});

  return (
    <PageContainer>
      <PageHeader
        title="Задачі"
        subtitle={counts.all === 0 ? 'Відкритих задач немає' : `${counts.all} ${plural(counts.all, ['відкрита задача', 'відкриті задачі', 'відкритих задач'])}, на сьогодні ${counts.today}${counts.overdue ? `, прострочено ${counts.overdue}` : ''}`}
        actions={
          <Button variant="dark" onClick={() => openTaskForm({ defaults: defaultsForFilter() })}>
            <Plus className="h-4 w-4" /> Додати задачу
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="space-y-3 border-b border-line p-3 sm:p-4">
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented
              ariaLabel="Фільтр задач"
              value={filter}
              onChange={(v) => setParams(v === 'all' ? {} : { filter: v }, { replace: true })}
              options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук задач"
                aria-label="Пошук задач"
                className="h-9 pl-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Очистити пошук"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-ink"
                  onClick={() => setQuery('')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select
              variant="chip"
              className="h-9"
              aria-label="Категорія"
              icon={<Tag />}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: '', label: 'Усі категорії' },
                ...categories.map((c) => ({ value: c.id, label: c.name, color: colorOf(c.color) })),
                { value: 'none', label: 'Без категорії', color: '#C3C8D3' },
              ]}
            />
            <Select
              variant="chip"
              className="h-9"
              aria-label="Сортування"
              icon={<ArrowDownUp />}
              value={prefs.sort}
              onChange={(sort) => updatePrefs({ sort })}
              options={[
                { value: 'due' as TaskSort, label: 'За терміном', icon: <ArrowDownUp /> },
                { value: 'priority' as TaskSort, label: 'За пріоритетом', icon: <ArrowDownUp /> },
                { value: 'created' as TaskSort, label: 'Спершу нові', icon: <ArrowDownUp /> },
                { value: 'title' as TaskSort, label: 'За назвою', icon: <ArrowDownUp /> },
              ]}
            />
            {filter !== 'completed' && (
              <Select
                variant="chip"
                className="h-9"
                aria-label="Групування"
                value={prefs.group}
                onChange={(group) => updatePrefs({ group })}
                options={[
                  { value: 'category' as TaskGrouping, label: 'За категоріями', icon: <Layers /> },
                  { value: 'project' as TaskGrouping, label: 'За проєктами', icon: <Layers /> },
                  { value: 'none' as TaskGrouping, label: 'Без групування', icon: <List /> },
                ]}
              />
            )}
          </div>
        </div>

        <div className="p-2 sm:p-3">
          {total === 0 ? (
            <EmptyState
              icon={<CheckSquare />}
              title={
                query || categoryFilter
                  ? 'Нічого не знайдено'
                  : filter === 'completed'
                    ? 'Виконаних задач поки немає'
                    : filter === 'overdue'
                      ? 'Нічого не прострочено'
                      : filter === 'today'
                        ? 'На сьогодні нічого не заплановано'
                        : 'Тут поки немає задач'
              }
              description={query ? 'Спробуйте інший запит.' : filter === 'overdue' ? 'Усе під контролем.' : undefined}
              action={
                !query &&
                filter !== 'completed' &&
                filter !== 'overdue' && (
                  <Button variant="outline" size="sm" onClick={() => openTaskForm({ defaults: defaultsForFilter() })}>
                    <Plus className="h-3.5 w-3.5" /> Додати задачу
                  </Button>
                )
              }
            />
          ) : (
            groups.map((g) => {
              const info = groupInfo(g.key);
              const isCollapsed = collapsed.has(g.key);
              return (
                <section key={g.key} className="mb-2 last:mb-0">
                  {info.name && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold"
                      aria-expanded={!isCollapsed}
                      onClick={() =>
                        setCollapsed((s) => {
                          const n = new Set(s);
                          if (n.has(g.key)) n.delete(g.key);
                          else n.add(g.key);
                          return n;
                        })
                      }
                    >
                      <ChevronDown className={cn('h-3.5 w-3.5 text-subtle transition-transform', isCollapsed && '-rotate-90')} />
                      {info.color && <Dot color={info.color} />}
                      {info.name}
                      <span className="font-normal text-subtle">{g.tasks.length}</span>
                    </button>
                  )}
                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {g.tasks.map((t) => (
                        <TaskItem key={t.id} task={t} showCategory={prefs.group !== 'category' || filter === 'completed'} showProject={prefs.group !== 'project'} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </Card>
    </PageContainer>
  );
}
