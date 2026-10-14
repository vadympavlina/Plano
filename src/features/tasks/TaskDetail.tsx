import { useState } from 'react';
import { CalendarDays, Clock, Flag, FolderKanban, Pencil, Repeat, Tag, Target, Trash2, CircleDot } from 'lucide-react';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge, CheckCircle, Dot, Progress } from '@/components/ui/misc';
import { Input, Select } from '@/components/ui/input';
import { EmptyState } from '@/components/common/States';
import { useData } from '@/app/providers/DataProvider';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useUI } from '@/app/providers/UIProvider';
import { useToday } from '@/hooks/useNow';
import { colorOf } from '@/lib/utils/colors';
import { describeRecurrence } from '@/lib/date/recurrence';
import { addDaysKey, formatDateKey, formatTimeRange, relativeDayLabel } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import { PRIORITIES, TASK_STATUSES, type Task } from '@/types';
import { PRIORITY_LABEL, STATUS_LABEL, isOverdue } from './logic';
import { PRIORITY_COLOR, deleteTaskWithConfirm } from './TaskItem';
import { toast } from '@/components/ui/toast';

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[36px] items-center gap-3 text-sm">
      <span className="flex w-28 shrink-0 items-center gap-2 text-muted [&_svg]:h-4 [&_svg]:w-4">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1 text-ink">{children}</div>
    </div>
  );
}

export default function TaskDetailSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data } = useData();
  const task: Task | undefined = data.tasks[taskId];
  const { categories, projects, categoryById, projectById } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const { openTaskForm } = useUI();
  const today = useToday();
  const [newSubtask, setNewSubtask] = useState('');

  if (!task) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <SheetContent title="Задача">
          <EmptyState title="Задачу не знайдено" description="Можливо, її видалили." />
        </SheetContent>
      </Dialog>
    );
  }

  const category = categoryById(task.categoryId);
  const project = projectById(task.projectId);
  const goal = task.goalId ? data.goals[task.goalId] : undefined;
  const done = task.status === 'completed';
  const subDone = task.subtasks.filter((s) => s.done).length;
  const update = (patch: Partial<Task>) => void actions.tasks.update(task.id, patch).catch(() => undefined);

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    update({
      subtasks: [...task.subtasks, { id: `st_${Date.now().toString(36)}`, title, done: false, order: task.subtasks.length }],
    });
    setNewSubtask('');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={task.title}
        headerActions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Редагувати задачу"
              onClick={() => {
                onClose();
                openTaskForm({ task });
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Видалити задачу"
              onClick={async () => {
                if (await deleteTaskWithConfirm(task, actions.tasks.remove)) onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 pt-2">
          <div className="pt-1">
            <CheckCircle
              checked={done}
              label={done ? 'Позначити як невиконану' : 'Позначити як виконану'}
              onChange={(c) => void actions.tasks.setDone(task, c).catch(() => undefined)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className={cn('text-xl font-semibold leading-snug tracking-tight', done && 'text-subtle line-through')}>{task.title}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {category && <Badge color={colorOf(category.color)}>{category.name}</Badge>}
              {isOverdue(task, today) && <Badge color="#E5484D">Прострочено</Badge>}
              {task.tags.map((t) => (
                <Badge key={t}>#{t}</Badge>
              ))}
            </div>
          </div>
        </div>

        {task.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted">{task.description}</p>}

        <div className="mt-5 space-y-0.5 border-y border-line py-3">
          <Row icon={<CalendarDays />} label="Термін">
            <Input
              type="date"
              aria-label="Термін"
              className="h-8 w-auto border-transparent bg-transparent px-1.5 hover:border-line"
              value={task.dueDate ?? ''}
              onChange={(e) => update({ dueDate: e.target.value || undefined })}
            />
            {task.dueDate && (
              <span className={cn('ml-1 text-xs text-muted', isOverdue(task, today) && 'text-danger')}>
                {relativeDayLabel(task.dueDate, today)}
              </span>
            )}
          </Row>
          {task.startDate && (
            <Row icon={<CalendarDays />} label="Початок">
              {formatDateKey(task.startDate, settings.dateFormat)}
            </Row>
          )}
          {task.startTime && (
            <Row icon={<Clock />} label="Час">
              <span className="tabular-nums">{formatTimeRange(task.startTime, task.endTime, settings.timeFormat)}</span>
            </Row>
          )}
          {task.recurrence && (
            <Row icon={<Repeat />} label="Повтор">
              {describeRecurrence(task.recurrence)}
            </Row>
          )}
          <Row icon={<Flag />} label="Пріоритет">
            <div className="flex items-center gap-2">
              <Dot color={PRIORITY_COLOR[task.priority]} />
              <Select
                aria-label="Пріоритет"
                className="h-8 w-auto border-transparent bg-transparent pl-1.5 hover:border-line"
                value={task.priority}
                onChange={(e) => update({ priority: e.target.value as Task['priority'] })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            </div>
          </Row>
          <Row icon={<CircleDot />} label="Статус">
            <Select
              aria-label="Статус"
              className="h-8 w-auto border-transparent bg-transparent pl-1.5 hover:border-line"
              value={task.status}
              onChange={(e) => void actions.tasks.setStatus(task, e.target.value as Task['status']).catch(() => undefined)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Row>
          <Row icon={<Tag />} label="Категорія">
            <Select
              aria-label="Категорія"
              className="h-8 w-auto border-transparent bg-transparent pl-1.5 hover:border-line"
              value={task.categoryId ?? ''}
              onChange={(e) => update({ categoryId: e.target.value || undefined })}
            >
              <option value="">Немає</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Row>
          <Row icon={<FolderKanban />} label="Проєкт">
            <Select
              aria-label="Проєкт"
              className="h-8 w-auto max-w-full border-transparent bg-transparent pl-1.5 hover:border-line"
              value={task.projectId ?? ''}
              onChange={(e) => update({ projectId: e.target.value || undefined })}
            >
              <option value="">Немає</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {project && <Dot color={colorOf(project.color)} className="ml-1" />}
          </Row>
          {goal && (
            <Row icon={<Target />} label="Ціль">
              {goal.title}
            </Row>
          )}
        </div>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Підзадачі</h3>
            {task.subtasks.length > 0 && (
              <span className="text-xs tabular-nums text-muted">
                {subDone}/{task.subtasks.length}
              </span>
            )}
          </div>
          {task.subtasks.length > 0 && (
            <Progress value={(subDone / task.subtasks.length) * 100} className="mb-2" label="Прогрес підзадач" />
          )}
          <ul className="space-y-0.5">
            {task.subtasks.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                <CheckCircle
                  size="sm"
                  checked={s.done}
                  label={`Підзадача ${s.title}`}
                  onChange={() => void actions.tasks.toggleSubtask(task, s.id).catch(() => undefined)}
                />
                <span className={cn('text-sm', s.done && 'text-subtle line-through')}>{s.title}</span>
              </li>
            ))}
          </ul>
          <form
            className="mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              addSubtask();
            }}
          >
            <Input
              placeholder="+ Додати підзадачу"
              aria-label="Нова підзадача"
              className="h-9 border-dashed"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onBlur={addSubtask}
            />
          </form>
        </section>

        {task.notes && (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold">Нотатки</h3>
            <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm leading-relaxed text-muted">{task.notes}</p>
          </section>
        )}

        <div className="mt-6 flex gap-2">
          <Button
            variant={done ? 'outline' : 'dark'}
            className="flex-1"
            onClick={() =>
              void actions.tasks.setDone(task, !done).then(
                () => toast.success(done ? 'Задачу повернуто в роботу' : 'Задачу виконано'),
                () => undefined,
              )
            }
          >
            {done ? 'Повернути в роботу' : 'Позначити виконаною'}
          </Button>
          {!done && task.dueDate !== addDaysKey(today, 1) && (
            <Button
              variant="outline"
              onClick={() =>
                void actions.tasks.reschedule(task, addDaysKey(today, 1)).then(() => toast.success('Перенесено на завтра'), () => undefined)
              }
            >
              На завтра
            </Button>
          )}
        </div>
        <p className="mt-4 text-[11px] text-subtle">
          Створено {new Date(task.createdAt).toLocaleString('uk-UA')}
          {task.completedAt && ` · Виконано ${new Date(task.completedAt).toLocaleString('uk-UA')}`}
        </p>
      </SheetContent>
    </Dialog>
  );
}
