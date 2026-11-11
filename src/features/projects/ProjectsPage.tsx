import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { coverGradient } from '@/components/common/Pickers';
import { LineIcon } from '@/components/common/CategoryMark';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { useCollections } from '@/hooks/useCollections';
import { useToday } from '@/hooks/useNow';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';
import { colorOf } from '@/lib/utils/colors';
import { formatDateKey, plural } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { DateKey, Project, ProjectStatus } from '@/types';
import { PROJECT_STATUS_LABEL, deadlineHint, projectProgress } from './logic';
import { ProjectForm } from './ProjectForm';

type Filter = ProjectStatus | 'all';
const ORDER: ProjectStatus[] = ['active', 'on_hold', 'completed', 'archived'];
const GROUP_LABEL: Record<ProjectStatus, string> = { active: 'Активні', on_hold: 'На паузі', completed: 'Завершені', archived: 'В архіві' };
const STATUS_PILL: Record<ProjectStatus, string> = {
  active: 'bg-success/12 text-success',
  on_hold: 'bg-warning/15 text-warning-ink',
  completed: 'bg-surface text-muted',
  archived: 'bg-surface text-subtle',
};

/** A project as a card: cover band, icon, name, progress and the facts that matter. */
function ProjectCard({ project, today }: { project: Project; today: DateKey }) {
  const { tasks } = useCollections();
  const prog = projectProgress(project, tasks, today);
  const color = colorOf(project.color);
  const open = prog.total - prog.done;
  const finished = project.status === 'completed' || project.status === 'archived';
  const hint = project.targetDate && !finished ? deadlineHint(project.targetDate, today) : undefined;
  const toneClass =
    hint?.tone === 'danger' ? 'bg-danger/10 text-danger' : hint?.tone === 'warning' ? 'bg-warning/15 text-warning-ink' : 'bg-surface text-muted';

  return (
    <Link
      to={`/projects/${project.id}`}
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden rounded-[24px] bg-surface-2/70 transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-surface-2 motion-reduce:hover:translate-y-0',
        finished && 'opacity-65',
      )}
    >
      <div
        className="h-[72px] sm:h-20"
        style={{ background: project.cover ? coverGradient(project.cover, 0.5, 0.2) : `linear-gradient(120deg, ${color}2e, ${color}0f)` }}
      />
      <div className="flex flex-1 flex-col px-4 pb-4">
        <span className="-mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface shadow-soft" style={{ color }}>
          <LineIcon icon={project.icon} fallback={FolderKanban} className="h-[22px] w-[22px]" />
        </span>
        <h3 className="mt-3 truncate text-[17px] font-bold leading-tight tracking-tight">{project.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-snug text-muted">{project.description || 'Без опису'}</p>

        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="text-muted">
              {prog.total ? `${prog.done} з ${prog.total} ${plural(prog.total, ['задачі', 'задач', 'задач'])}` : 'Задач поки немає'}
            </span>
            <span className="font-bold tabular-nums">{prog.percent}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface"
            role="progressbar"
            aria-valuenow={prog.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Прогрес: ${project.name}`}
          >
            <div
              className="h-full w-full rounded-full transition-transform duration-500 motion-reduce:transition-none"
              style={{ transform: `translateX(${prog.percent - 100}%)`, backgroundColor: color }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-semibold', STATUS_PILL[project.status])}>
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
          {hint && <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-semibold', toneClass)}>{hint.text}</span>}
          {!hint && project.targetDate && (
            <span className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-medium text-muted">до {formatDateKey(project.targetDate, 'd MMM')}</span>
          )}
          {prog.overdue > 0 && (
            <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[11.5px] font-semibold text-danger">прострочено {prog.overdue}</span>
          )}
          {open > 0 && (
            <span className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-medium text-muted">
              {open} {plural(open, ['відкрита', 'відкриті', 'відкритих'])}
            </span>
          )}
        </div>
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
    () =>
      tasks.filter(
        (t) => t.projectId && (t.status === 'todo' || t.status === 'in_progress') && projects.some((p) => p.id === t.projectId && p.status === 'active'),
      ).length,
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
    <div className="w-full px-2 pb-8">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3">
        <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[38px]">Проєкти</h1>
        <span className="text-[13.5px] text-muted">
          {counts.active ?? 0} {plural(counts.active ?? 0, ['активний', 'активні', 'активних'])} · {openTasks}{' '}
          {plural(openTasks, ['відкрита задача', 'відкриті задачі', 'відкритих задач'])}
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
        <div className="rounded-[24px] bg-surface-2/70">
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
        groups.map((g) => (
          <section key={g.status} className="mt-6 first-of-type:mt-2">
            <h2 className="mb-3 px-1 text-[13px] font-bold">
              {GROUP_LABEL[g.status]} <span className="ml-1 font-medium text-subtle">{g.list.length}</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.list.map((p) => (
                <ProjectCard key={p.id} project={p} today={today} />
              ))}
              {g.status === 'active' && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-line text-[13.5px] font-medium text-subtle transition-colors hover:border-subtle hover:text-ink"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
                    <Plus className="h-5 w-5" />
                  </span>
                  Новий проєкт
                </button>
              )}
            </div>
          </section>
        ))
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </div>
  );
}
