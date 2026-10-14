import { memo } from 'react';
import { CalendarClock, CalendarDays, Copy, ListChecks, MoreHorizontal, Pencil, Repeat, StickyNote, Trash2 } from 'lucide-react';
import type { Task } from '@/types';
import { CheckCircle, Badge, Dot } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { cn } from '@/lib/utils/cn';
import { colorOf } from '@/lib/utils/colors';
import { addDaysKey, formatTimeRange, relativeDayLabel } from '@/lib/date';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useUI } from '@/app/providers/UIProvider';
import { useToday } from '@/hooks/useNow';
import { PRIORITY_LABEL, isOverdue, taskDate } from './logic';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';

export { PRIORITY_COLOR } from '@/components/common/options';
import { PRIORITY_COLOR } from '@/components/common/options';

export async function deleteTaskWithConfirm(task: Task, remove: (id: string) => Promise<void>) {
  const ok = await confirm({
    title: 'Видалити задачу?',
    description: `«${task.title}» буде видалено назавжди.`,
    confirmLabel: 'Видалити',
    danger: true,
  });
  if (!ok) return false;
  try {
    await remove(task.id);
    toast.success('Задачу видалено');
    return true;
  } catch {
    return false;
  }
}

interface TaskItemProps {
  task: Task;
  showDate?: boolean;
  showCategory?: boolean;
  showProject?: boolean;
  compact?: boolean;
}

export const TaskItem = memo(function TaskItem({ task, showDate = true, showCategory = true, showProject, compact }: TaskItemProps) {
  const { categoryById, projectById } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const { openTask, openTaskForm } = useUI();
  const today = useToday();
  const category = categoryById(task.categoryId);
  const project = projectById(task.projectId);
  const done = task.status === 'completed';
  const cancelled = task.status === 'cancelled';
  const overdue = isOverdue(task, today);
  const date = taskDate(task);
  const subDone = task.subtasks.filter((s) => s.done).length;

  const toggle = (checked: boolean) => {
    void actions.tasks.setDone(task, checked).then(
      () => {
        if (checked && task.recurrence) toast.success('Готово — наступну заплановано');
      },
      () => undefined,
    );
  };

  const move = (d: string | undefined, label: string) =>
    void actions.tasks.reschedule(task, d).then(() => toast.success(`Перенесено: ${label}`), () => undefined);

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl px-3 transition-colors hover:bg-surface-2',
        compact ? 'py-2' : 'py-2.5',
      )}
    >
      <div className="pt-[1px]">
        <CheckCircle checked={done} onChange={toggle} label={`Позначити «${task.title}» як ${done ? 'невиконану' : 'виконану'}`} disabled={cancelled} />
      </div>
      <button type="button" onClick={() => openTask(task.id)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-[13.5px] font-medium text-ink', (done || cancelled) && 'text-subtle line-through')}>
            {task.title}
          </span>
          {task.recurrence && <Repeat className="h-3 w-3 shrink-0 text-subtle" aria-label="Повторюється" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          {showDate && date && (
            <span className={cn('inline-flex items-center gap-1', overdue && 'font-medium text-danger')}>
              {relativeDayLabel(date, today)}
            </span>
          )}
          {task.startTime && <span className="tabular-nums">{formatTimeRange(task.startTime, task.endTime, settings.timeFormat)}</span>}
          {task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {subDone}/{task.subtasks.length}
            </span>
          )}
          {task.notes && <StickyNote className="h-3 w-3" aria-label="Має нотатки" />}
          {showProject && project && (
            <span className="inline-flex items-center gap-1">
              <Dot color={colorOf(project.color)} className="h-1.5 w-1.5" />
              {project.name}
            </span>
          )}
          {cancelled && <span>Скасовано</span>}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-1.5 pt-[1px]">
        {showCategory && category && (
          <Badge color={colorOf(category.color)} className="hidden sm:inline-flex">
            {category.name}
          </Badge>
        )}
        {!done && !cancelled && (task.priority === 'high' || task.priority === 'urgent') && (
          <Badge color={PRIORITY_COLOR[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-lg p-1 text-subtle opacity-100 transition-opacity hover:bg-line/60 hover:text-ink lg:opacity-0 lg:group-hover:opacity-100 lg:data-[state=open]:opacity-100"
            aria-label={`Дії для «${task.title}»`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem icon={<Pencil />} onSelect={() => openTaskForm({ task })}>
              Редагувати
            </DropdownMenuItem>
            <DropdownMenuItem
              icon={<Copy />}
              onSelect={() => {
                const { id: _i, createdAt: _c, updatedAt: _u, completedAt: _d, seriesId: _s, seriesStart: _ss, ...rest } = task;
                openTaskForm({ defaults: { ...rest, title: `${task.title} (копія)`, status: 'todo' } });
              }}
            >
              Дублювати
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Перенести на</DropdownMenuLabel>
            <DropdownMenuItem icon={<CalendarDays />} onSelect={() => move(today, 'сьогодні')}>
              Сьогодні
            </DropdownMenuItem>
            <DropdownMenuItem icon={<CalendarClock />} onSelect={() => move(addDaysKey(today, 1), 'завтра')}>
              Завтра
            </DropdownMenuItem>
            <DropdownMenuItem icon={<CalendarClock />} onSelect={() => move(addDaysKey(today, 7), 'наступний тиждень')}>
              Наступний тиждень
            </DropdownMenuItem>
            {date && (
              <DropdownMenuItem icon={<CalendarClock />} onSelect={() => move(undefined, 'без дати')}>
                Без дати
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => void deleteTaskWithConfirm(task, actions.tasks.remove)}>
              Видалити
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
