import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckSquare, ChevronDown, NotebookPen, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Progress } from '@/components/ui/misc';
import { Select } from '@/components/ui/input';
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
import { PROJECT_STATUSES, type Project } from '@/types';
import { TaskItem } from '@/features/tasks/TaskItem';
import { isOpen, sortTasks } from '@/features/tasks/logic';
import { upcomingOccurrences } from '@/features/calendar/logic';
import { goalPercent } from '@/features/goals/logic';
import { PROJECT_STATUS_LABEL, projectProgress } from './logic';
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

  return (
    <PageContainer>
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Проєкти
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="truncate text-[24px] font-semibold tracking-tight">{project.name}</h2>
          </div>
          {project.description && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-muted">{project.description}</p>}
          <p className="mt-2 text-xs text-muted">
            {project.startDate && `Початок: ${formatDateKey(project.startDate, settings.dateFormat)}`}
            {project.startDate && project.targetDate && ' · '}
            {project.targetDate && `Мета: ${formatDateKey(project.targetDate, settings.dateFormat)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Статус проєкту"
            className="h-9 w-auto text-[13px]"
            value={project.status}
            onChange={(e) => void actions.projects.update(project.id, { status: e.target.value as Project['status'] }).catch(() => undefined)}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Редагувати
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Видалити проєкт" onClick={() => void remove()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted">Прогрес</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{prog.percent}%</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-muted">Виконано</p>
                <p className="font-semibold tabular-nums">{prog.done}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Відкриті</p>
                <p className="font-semibold tabular-nums">{prog.total - prog.done}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Прострочені</p>
                <p className={cn('font-semibold tabular-nums', prog.overdue && 'text-danger')}>{prog.overdue}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Найближчий дедлайн</p>
                <p className="font-semibold">{prog.nextDeadline ? relativeDayLabel(prog.nextDeadline, today) : '—'}</p>
              </div>
            </div>
          </div>
          <Progress value={prog.percent} color={color} className="mt-4 h-2" label="Прогрес проєкту" />
          <p className="mt-2 text-[11px] text-subtle">Обчислюється за задачами проєкту (скасовані не враховуються).</p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Задачі"
            subtitle={`Відкритих: ${related.open.length}`}
            action={
              <Button size="sm" variant="outline" onClick={() => openTaskForm({ defaults: { projectId: project.id } })}>
                <Plus className="h-3.5 w-3.5" /> Додати задачу
              </Button>
            }
          />
          <div className="p-2 sm:p-3">
            {related.open.length === 0 ? (
              <EmptyState compact icon={<CheckSquare />} title="Відкритих задач немає" />
            ) : (
              related.open.map((t) => <TaskItem key={t.id} task={t} />)
            )}
            {related.done.length > 0 && (
              <>
                <button type="button" onClick={() => setShowDone((s) => !s)} className="mt-2 flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted hover:text-ink" aria-expanded={showDone}>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !showDone && '-rotate-90')} />
                  Виконані ({related.done.length})
                </button>
                {showDone && related.done.map((t) => <TaskItem key={t.id} task={t} />)}
              </>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Нотатки"
              action={
                <Button size="sm" variant="ghost" onClick={() => createNote({ projectId: project.id })}>
                  <Plus className="h-3.5 w-3.5" /> Нова
                </Button>
              }
            />
            <div className="space-y-1 p-3">
              {related.notes.length === 0 ? (
                <EmptyState compact icon={<NotebookPen />} title="Нотаток немає" className="!py-4" />
              ) : (
                related.notes.slice(0, 5).map((n) => (
                  <Link key={n.id} to={`/notes/${n.id}`} className="block rounded-lg px-2 py-2 hover:bg-surface-2">
                    <p className="truncate text-[13px] font-medium">{n.title || 'Без назви'}</p>
                    <p className="truncate text-xs text-muted">{markdownExcerpt(n.content, 80) || 'Порожня'}</p>
                  </Link>
                ))
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Цілі" />
            <div className="space-y-3 p-5 pt-3">
              {related.goals.length === 0 ? (
                <p className="text-xs text-muted">Немає пов’язаних цілей. Пов’яжіть ціль із цим проєктом на сторінці «Цілі».</p>
              ) : (
                related.goals.map((g) => (
                  <Link key={g.id} to="/goals" className="block">
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="truncate font-medium">{g.title}</span>
                      <span className="text-xs tabular-nums text-muted">{goalPercent(g)}%</span>
                    </div>
                    <Progress value={goalPercent(g)} color={color} label={g.title} />
                  </Link>
                ))
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Найближчі події" />
            <div className="p-3">
              {related.events.length === 0 ? (
                <EmptyState compact icon={<CalendarDays />} title="Найближчих подій немає" className="!py-4" />
              ) : (
                related.events.map((o) => (
                  <button key={o.key} type="button" onClick={() => openEvent(o.event.id, o.date)} className="flex w-full justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-2">
                    <span className="truncate text-[13px] font-medium">{o.event.title}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {relativeDayLabel(o.date, today)} {o.event.allDay ? '' : formatTimeRange(o.event.startTime, undefined, settings.timeFormat)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </Card>
          {related.goals.length === 0 && goals.length === 0 && (
            <Link to="/goals?new=1" className="inline-flex items-center gap-1 px-1 text-xs text-muted hover:text-ink">
              <Target className="h-3.5 w-3.5" /> Створити ціль
            </Link>
          )}
        </div>
      </div>
      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
    </PageContainer>
  );
}
