import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { useCollections } from '@/hooks/useCollections';
import { useToday } from '@/hooks/useNow';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';
import { colorOf } from '@/lib/utils/colors';
import { diffDaysKey, formatDateKey, plural } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { DateKey, Project, ProjectStatus } from '@/types';
import { PROJECT_STATUS_LABEL, projectProgress } from './logic';
import { ProjectForm } from './ProjectForm';

type Filter = ProjectStatus | 'all';
const ORDER: ProjectStatus[] = ['active', 'on_hold', 'completed', 'archived'];
const GROUP_LABEL: Record<ProjectStatus, string> = { active: 'Активні', on_hold: 'На паузі', completed: 'Завершені', archived: 'В архіві' };
const COLS = 'md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_120px_140px_110px]';

const STATUS_PILL: Record<ProjectStatus, string> = {
  active: 'bg-success/10 text-success',
  on_hold: 'bg-warning/15 text-warning',
  completed: 'bg-surface-2 text-muted',
  archived: 'bg-surface-2 text-subtle',
};

/** "через 5 днів", "сьогодні", "прострочено на 3 дні". */
function deadlineHint(target: DateKey, today: DateKey): { text: string; tone: 'danger' | 'warning' | 'muted' } {
  const d = diffDaysKey(target, today);
  if (d < 0) return { text: `прострочено на ${-d} ${plural(-d, ['день', 'дні', 'днів'])}`, tone: 'danger' };
  if (d === 0) return { text: 'сьогодні', tone: 'warning' };
  if (d <= 7) return { text: `через ${d} ${plural(d, ['день', 'дні', 'днів'])}`, tone: 'warning' };
  if (d < 60) return { text: `через ${d} ${plural(d, ['день', 'дні', 'днів'])}`, tone: 'muted' };
  const m = Math.round(d / 30);
  return { text: `через ${m} ${plural(m, ['місяць', 'місяці', 'місяців'])}`, tone: 'muted' };
}

function ProjectRow({ project, today }: { project: Project; today: DateKey }) {
  const { tasks } = useCollections();
  const prog = projectProgress(project, tasks, today);
  const color = colorOf(project.color);
  const open = prog.total - prog.done;
  const finished = project.status === 'completed' || project.status === 'archived';
  const hint = project.targetDate && !finished ? deadlineHint(project.targetDate, today) : undefined;
  const toneClass = hint?.tone === 'danger' ? 'font-semibold text-danger' : hint?.tone === 'warning' ? 'font-semibold text-warning' : 'text-muted';

  return (
    <Link
      to={`/projects/${project.id}`}
      className={cn('grid grid-cols-1 items-center gap-x-5 gap-y-3 px-5 py-4 transition-colors hover:bg-surface-2/60', COLS, finished && 'opacity-60')}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f`, color }}>
          <FolderKanban className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-semibold">{project.name}</p>
          <p className="truncate text-[12px] text-muted">{project.description || 'Без опису'}</p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex justify-between gap-2 text-[12px]">
          <span className="text-muted">
            {prog.total ? `${prog.done} з ${prog.total} ${plural(prog.total, ['задачі', 'задач', 'задач'])}` : 'Задач поки немає'}
            {prog.overdue > 0 && <span className="text-danger"> · прострочено {prog.overdue}</span>}
          </span>
          <span className="font-semibold tabular-nums">{prog.percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={prog.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Прогрес: ${project.name}`}>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${prog.percent}%`, backgroundColor: color }} />
        </div>
      </div>

      {/* Status, deadline and open tasks: separate columns on wide screens, one line on phones. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] md:contents">
        <span className="md:block">
          <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11.5px] font-medium', STATUS_PILL[project.status])}>{PROJECT_STATUS_LABEL[project.status]}</span>
        </span>
        <span className="text-[13px] md:block">
          {project.targetDate ? (
            <>
              <span className="font-medium">{formatDateKey(project.targetDate, 'd MMM')}</span>
              {hint && <span className={cn('text-[12px] md:block', toneClass)}><span className="md:hidden"> · </span>{hint.text}</span>}
            </>
          ) : (
            <span className="text-subtle">Без дедлайну</span>
          )}
        </span>
        <span className="text-[13px] text-muted md:block">{open > 0 ? `${open} ${plural(open, ['відкрита', 'відкриті', 'відкритих'])}` : '—'}</span>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const { projects, tasks } = useCollections();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  useOpenFromQuery(() => setCreating(true));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);
  const openTasks = useMemo(
    () => tasks.filter((t) => t.projectId && (t.status === 'todo' || t.status === 'in_progress') && projects.some((p) => p.id === t.projectId && p.status === 'active')).length,
    [tasks, projects],
  );

  const groups = ORDER.filter((s) => filter === 'all' || filter === s)
    .map((s) => ({
      status: s,
      list: projects
        .filter((p) => p.status === s)
        .sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3">
        <h1 className="text-[26px] font-bold tracking-tight sm:text-[28px]">Проєкти</h1>
        <span className="text-[13.5px] text-muted">
          {counts.active ?? 0} {plural(counts.active ?? 0, ['активний', 'активні', 'активних'])} · {openTasks} {plural(openTasks, ['відкрита задача', 'відкриті задачі', 'відкритих задач'])}
        </span>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto sm:flex-none">
            <Segmented
              ariaLabel="Фільтр проєктів"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={(['all', 'active', 'on_hold', 'completed', 'archived'] as Filter[])
                .filter((v) => v === 'all' || v === 'active' || (counts[v] ?? 0) > 0)
                .map((v) => ({ value: v, label: v === 'all' ? 'Усі' : GROUP_LABEL[v], count: counts[v] ?? 0 }))}
            />
          </div>
          <Button variant="dark" size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Проєкт
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[20px] border border-line/60 bg-surface shadow-soft">
          <EmptyState
            icon={<FolderKanban />}
            title={projects.length ? 'Немає проєктів із цим статусом' : 'Проєктів поки немає'}
            description="Проєкти об’єднують пов’язані задачі, нотатки й цілі — наприклад, ремонт, навчання чи власний продукт."
            action={
              <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> Створити проєкт
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className={cn('hidden gap-5 px-5 pb-2 text-[11.5px] font-semibold uppercase tracking-wide text-subtle md:grid', COLS)}>
            <span>Проєкт</span>
            <span>Прогрес</span>
            <span>Статус</span>
            <span>Дедлайн</span>
            <span>Задачі</span>
          </div>
          {groups.map((g) => (
            <section key={g.status} className="mt-6 first-of-type:mt-3">
              <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {GROUP_LABEL[g.status]} <span className="font-normal">{g.list.length}</span>
              </h2>
              <div className="divide-y divide-line/70 overflow-hidden rounded-[20px] border border-line/60 bg-surface shadow-soft">
                {g.list.map((p) => (
                  <ProjectRow key={p.id} project={p} today={today} />
                ))}
              </div>
            </section>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 flex w-full items-center gap-2 rounded-[20px] border-2 border-dashed border-line px-5 py-3.5 text-[13.5px] text-subtle transition-colors hover:border-subtle hover:text-ink"
          >
            <Plus className="h-4 w-4" /> Новий проєкт
          </button>
        </>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </div>
  );
}
