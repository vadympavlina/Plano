import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckSquare, ChevronDown, FolderKanban, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Progress, Segmented } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { projectStatusOptions } from '@/components/common/options';
import { EmptyState } from '@/components/common/States';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useUI } from '@/app/providers/UIProvider';
import { useNow } from '@/hooks/useNow';
import { useCreateNote } from '@/components/layout/CreateMenu';
import { colorOf } from '@/lib/utils/colors';
import { formatDateKey, formatTimeRange, relativeDayLabel, todayKey } from '@/lib/date';
import { markdownExcerpt } from '@/lib/utils/markdown';
import { cn } from '@/lib/utils/cn';
import { TaskBoard, TaskRow } from '@/features/tasks/TaskViews';
import { boardColumns } from '@/features/tasks/lists';
import { isOpen, sortTasks } from '@/features/tasks/logic';
import { upcomingOccurrences } from '@/features/calendar/logic';
import { goalPercent } from '@/features/goals/logic';
import { deadlineHint, projectProgress } from './logic';
import { ProjectForm } from './ProjectForm';

export default function ProjectPage() {
  const { projectId = '' } = useParams();
  const { projects, tasks, notes, goals, events } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const navigate = useNavigate();
  const { openTaskForm, openEvent } = useUI();
  const createNote = useCreateNote();
  const now = useNow();
  const today = todayKey(now);
  const [editing, setEditing] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [mode, setMode] = useState<'list' | 'board'>('list');
  const project = projects.find((p) => p.id === projectId);

  const related = useMemo(() => {
    const list = tasks.filter((t) => t.projectId === projectId);
    return {
      open: sortTasks(list.filter(isOpen), 'due'),
      done: sortTasks(list.filter((t) => !isOpen(t)), 'due', 'completed'),
      notes: notes.filter((n) => n.projectId === projectId).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
      goals: goals.filter((g) => g.projectIds.includes(projectId)),
      events: upcomingOccurrences(
        events.filter((e) => e.projectId === projectId),
        now,
        today,
        60,
        5,
      ),
    };
  }, [tasks, notes, goals, events, projectId, now, today]);

  if (!project) {
    return (
      <PageContainer>
        <EmptyState
          icon={<CheckSquare />}
          title="Проєкт не знайдено"
          description="Можливо, його видалили."
          action={
            <Link to="/projects">
              <Button variant="outline" size="sm">
                До проєктів
              </Button>
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const color = colorOf(project.color);
  const prog = projectProgress(project, tasks, today);

  const remove = async () => {
    const ok = await confirm({
      title: 'Видалити проєкт?',
      description: `«${project.name}» буде видалено. Його задачі, нотатки й події залишаться, але без прив’язки до проєкту.`,
      confirmLabel: 'Видалити проєкт',
      danger: true,
    });
    if (!ok) return;
    try {
      await actions.projects.remove(project.id);
      toast.success('Проєкт видалено');
      navigate('/projects');
    } catch {
      /* toast from sync layer */
    }
  };

  const side = 'rounded-[20px] border border-line/60 bg-surface p-5 shadow-soft';
  const hint = project.targetDate && project.status !== 'completed' && project.status !== 'archived' ? deadlineHint(project.targetDate, today) : undefined;
  const stats: [string, string, boolean?][] = [
    ['Виконано', `${prog.done} з ${prog.total}`],
    ['Відкриті', String(prog.total - prog.done)],
    ['Прострочені', String(prog.overdue), prog.overdue > 0],
    ['Найближчий дедлайн', prog.nextDeadline ? relativeDayLabel(prog.nextDeadline, today) : '—'],
  ];

  return (
    <PageContainer className="pb-8">
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Проєкти
      </Link>

      <section className="rounded-[20px] border border-line/60 bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}1f`, color }}>
            <FolderKanban className="h-6 w-6" />
          </span>
          <div className="min-w-[calc(100%-4.5rem)] flex-1 sm:min-w-0">
            <h1 className="truncate text-[22px] font-bold tracking-tight sm:text-[26px]">{project.name}</h1>
            <p className="mt-0.5 text-[13.5px] text-muted">
              {project.startDate && `з ${formatDateKey(project.startDate, 'd MMMM')}`}
              {project.startDate && project.targetDate && ' · '}
              {project.targetDate && `до ${formatDateKey(project.targetDate, 'd MMMM yyyy')}`}
              {hint && <span className={cn(' font-semibold', hint.tone === 'danger' ? 'text-danger' : hint.tone === 'warning' ? 'text-warning' : '')}> · {hint.text}</span>}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Select
              variant="chip"
              className="h-9 flex-1 sm:flex-none"
              aria-label="Статус проєкту"
              value={project.status}
              onChange={(status) => void actions.projects.update(project.id, { status }).catch(() => undefined)}
              options={projectStatusOptions}
            />
            <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Редагувати
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Видалити проєкт" onClick={() => void remove()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {project.description && <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[14px] leading-relaxed text-muted">{project.description}</p>}

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">Прогрес</span>
            <span className="text-[22px] font-bold tabular-nums">{prog.percent}%</span>
          </div>
          <Progress value={prog.percent} color={color} className="h-2.5" label="Прогрес проєкту" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(([l, v, bad]) => (
            <div key={l} className="rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-[12px] text-muted">{l}</p>
              <p className={cn('mt-0.5 truncate text-[18px] font-bold tabular-nums', bad && 'text-danger')}>{v}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={cn(side, 'min-w-0 p-0')}>
          <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-5">
            <h2 className="mr-auto text-[15px] font-semibold">
              Задачі <span className="font-normal text-muted">{related.open.length}</span>
            </h2>
            <Segmented
              size="sm"
              ariaLabel="Вигляд задач"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'list', label: 'Список' },
                { value: 'board', label: 'Дошка' },
              ]}
            />
            <Button size="sm" variant="dark" onClick={() => openTaskForm({ defaults: { projectId: project.id } })}>
              <Plus className="h-3.5 w-3.5" /> Задача
            </Button>
          </div>
          {mode === 'board' ? (
            <div className="px-3 pb-4">
              <TaskBoard
                columns={boardColumns({ open: related.open, done: related.done })}
                today={today}
                onAdd={(status) => openTaskForm({ defaults: { projectId: project.id, status } })}
              />
            </div>
          ) : (
            <div className="px-2 pb-3">
              {related.open.length === 0 ? (
                <EmptyState compact icon={<CheckSquare />} title="Відкритих задач немає" description="Додайте першу задачу цього проєкту." />
              ) : (
                related.open.map((t) => <TaskRow key={t.id} task={t} today={today} showProject={false} />)
              )}
              {related.done.length > 0 && (
                <>
                  <button type="button" onClick={() => setShowDone((s) => !s)} className="mt-1 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-ink" aria-expanded={showDone}>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showDone && '-rotate-90')} />
                    Виконані ({related.done.length})
                  </button>
                  {showDone && related.done.map((t) => <TaskRow key={t.id} task={t} today={today} showProject={false} />)}
                </>
              )}
            </div>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={side}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Нотатки</h2>
              <Button size="sm" variant="ghost" onClick={() => createNote({ projectId: project.id })}>
                <Plus className="h-3.5 w-3.5" /> Нова
              </Button>
            </div>
            {related.notes.length === 0 ? (
              <p className="text-[13px] text-muted">Нотаток поки немає.</p>
            ) : (
              related.notes.slice(0, 5).map((n) => (
                <Link key={n.id} to={`/notes/${n.id}`} className="-mx-2 block rounded-lg px-2 py-2 hover:bg-surface-2">
                  <p className="truncate text-[13.5px] font-medium">
                    {n.icon && `${n.icon} `}
                    {n.title || 'Без назви'}
                  </p>
                  <p className="truncate text-xs text-muted">{markdownExcerpt(n.content, 80) || 'Порожня'}</p>
                </Link>
              ))
            )}
          </section>
          <section className={side}>
            <h2 className="mb-3 text-[15px] font-semibold">Цілі</h2>
            {related.goals.length === 0 ? (
              <p className="text-[13px] text-muted">
                Немає пов’язаних цілей.{' '}
                <Link to="/goals" className="font-medium text-ink hover:underline">
                  <Target className="mb-0.5 inline h-3.5 w-3.5" /> До цілей
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {related.goals.map((g) => (
                  <Link key={g.id} to="/goals" className="block">
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="truncate font-medium">{g.title}</span>
                      <span className="text-xs tabular-nums text-muted">{goalPercent(g)}%</span>
                    </div>
                    <Progress value={goalPercent(g)} color={color} label={g.title} />
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className={side}>
            <h2 className="mb-2 text-[15px] font-semibold">Найближчі події</h2>
            {related.events.length === 0 ? (
              <p className="text-[13px] text-muted">Подій у найближчі 60 днів немає.</p>
            ) : (
              related.events.map((o) => (
                <button key={o.key} type="button" onClick={() => openEvent(o.event.id, o.date)} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{o.event.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {relativeDayLabel(o.date, today)} {o.event.allDay ? '' : formatTimeRange(o.event.startTime, undefined, settings.timeFormat)}
                  </span>
                </button>
              ))
            )}
          </section>
        </div>
      </div>
      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
    </PageContainer>
  );
}
