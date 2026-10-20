import { useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { CategoryChip } from '@/components/common/CategoryMark';
import { Check, ChevronDown, Clock, CornerDownRight, FolderKanban, Plus, Repeat } from 'lucide-react';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { addDaysKey, formatTime, relativeDayLabel } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/components/ui/toast';
import type { DateKey, Task } from '@/types';
import { taskDate } from './logic';
import { BOARD_COLUMNS, type BoardColumn } from './lists';
import { haptic } from '@/lib/utils/haptic';

const RING: Partial<Record<Task['priority'], string>> = { urgent: '#E5484D', high: '#E09232' };

/** Round completion toggle; the ring colour flags urgent and high priority. */
export function TaskCheck({ task }: { task: Task }) {
  const actions = useActions();
  const done = task.status === 'completed';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Повернути «${task.title}»` : `Виконати «${task.title}»`}
      onClick={(e) => {
        e.stopPropagation();
        haptic();
        void actions.tasks.setDone(task, !done).catch(() => undefined);
      }}
      className={cn(
        'relative flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-[1.7px] transition-colors before:absolute before:-inset-2 before:content-[""]',
        done ? 'border-transparent bg-accent text-surface' : 'border-subtle/80 hover:border-ink',
      )}
      style={!done && RING[task.priority] ? { borderColor: RING[task.priority] } : undefined}
    >
      {done && <Check className="h-3 w-3 stroke-[3.2]" />}
    </button>
  );
}

/** Small line under the title: time or date, project, subtasks, repeat. */
function TaskMeta({ task, today, showDate, showProject = true, hideSubtasks }: { task: Task; today: DateKey; showDate: boolean; showProject?: boolean; hideSubtasks?: boolean }) {
  const { projectById } = useCollections();
  const settings = useSettings();
  const project = showProject && task.projectId ? projectById(task.projectId) : undefined;
  const d = taskDate(task);
  const overdue = d && d < today && task.status !== 'completed';
  const subDone = task.subtasks.filter((s) => s.done).length;
  const parts: ReactNode[] = [];
  if (showDate && d && d !== today)
    parts.push(
      <span key="d" className={cn(overdue && 'font-medium text-danger')}>
        {relativeDayLabel(d, today, 'EEEEEE, d MMM')}
      </span>,
    );
  if (task.startTime)
    parts.push(
      <span key="t" className="inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        {formatTime(task.startTime, settings.timeFormat)}
      </span>,
    );
  if (project)
    parts.push(
      <span key="p" className="inline-flex min-w-0 items-center gap-1">
        <FolderKanban className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{project.name}</span>
      </span>,
    );
  if (task.subtasks.length && !hideSubtasks)
    parts.push(
      <span key="s" className="inline-flex items-center gap-1 tabular-nums">
        <CornerDownRight className="h-3.5 w-3.5" />
        {subDone} з {task.subtasks.length}
      </span>,
    );
  if (task.recurrence) parts.push(<Repeat key="r" className="h-3.5 w-3.5" aria-label="Повторюється" />);
  if (!parts.length) return null;
  return <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted">{parts}</p>;
}

function CategoryDot({ task }: { task: Task }) {
  const { categoryById } = useCollections();
  const c = task.categoryId ? categoryById(task.categoryId) : undefined;
  if (!c) return null;
  return <CategoryChip category={c} compact />;
}

/** Subtask progress as a small bar with "2 з 5". */
function SubtaskProgress({ task }: { task: Task }) {
  const done = task.subtasks.filter((s) => s.done).length;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-muted">
      <span className="h-1 w-8 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full bg-success transition-[width]" style={{ width: `${(done / task.subtasks.length) * 100}%` }} />
      </span>
      {done} з {task.subtasks.length}
    </span>
  );
}

const SWIPE = 80;

/** Touch swipe on a row: right completes, left moves to tomorrow. Vertical scrolling stays native. */
function useSwipe(onRight: () => void, onLeft: () => void) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const moved = useRef(false);
  return {
    dx,
    /** True right after a swipe, so the click that ends it is ignored. */
    swallowClick: () => moved.current && !(moved.current = false),
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        start.current = { x: e.clientX, y: e.clientY, on: false };
        moved.current = false;
      },
      onPointerMove: (e: PointerEvent) => {
        const s = start.current;
        if (!s) return;
        const x = e.clientX - s.x;
        if (!s.on) {
          if (Math.abs(e.clientY - s.y) > 10) return void (start.current = null);
          if (Math.abs(x) < 12) return;
          s.on = moved.current = true;
        }
        setDx(Math.max(-140, Math.min(140, x)));
      },
      onPointerUp: () => {
        if (start.current?.on) {
          if (dx >= SWIPE) onRight();
          else if (dx <= -SWIPE) onLeft();
        }
        start.current = null;
        setDx(0);
      },
      onPointerCancel: () => {
        start.current = null;
        setDx(0);
      },
    },
  };
}

export function TaskRow({ task, today, showDate = true, showProject = true }: { task: Task; today: DateKey; showDate?: boolean; showProject?: boolean }) {
  const { openTask } = useUI();
  const actions = useActions();
  const [open, setOpen] = useState(false);
  const done = task.status === 'completed';
  const swipe = useSwipe(
    () => {
      haptic();
      void actions.tasks.setDone(task, !done).catch(() => undefined);
    },
    () => {
      const was = taskDate(task);
      const tomorrow = addDaysKey(today, 1);
      if (was === tomorrow) return;
      haptic();
      void actions.tasks.reschedule(task, tomorrow).then(
        () => toast.success('Перенесено на завтра', { action: { label: 'Скасувати', onClick: () => void actions.tasks.reschedule(task, was).catch(() => undefined) } }),
        () => undefined,
      );
    },
  );
  const reveal = swipe.dx > 0 ? (done ? 'Повернути' : 'Виконано') : 'Завтра';
  return (
    <div className="relative overflow-hidden rounded-xl [contain-intrinsic-size:auto_52px] [content-visibility:auto]">
      {swipe.dx !== 0 && (
        <div
          aria-hidden
          className={cn('absolute inset-0 flex items-center px-4 text-[13px] font-semibold text-white', swipe.dx > 0 ? 'justify-start bg-success' : 'justify-end bg-primary')}
          style={{ opacity: Math.min(1, Math.abs(swipe.dx) / SWIPE) }}
        >
          {reveal}
        </div>
      )}
      <div
        {...swipe.handlers}
        className={cn('group relative flex touch-pan-y items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2/70', done && 'opacity-55', swipe.dx !== 0 && 'bg-surface')}
        style={swipe.dx ? { transform: `translateX(${swipe.dx}px)` } : undefined}
      >
        <span className="pt-0.5">
          <TaskCheck task={task} />
        </span>
        <button type="button" onClick={() => !swipe.swallowClick() && openTask(task.id)} className="min-w-0 flex-1 text-left">
          <span className={cn('block truncate text-[14.5px]', done && 'line-through')}>{task.title}</span>
          <TaskMeta task={task} today={today} showDate={showDate} showProject={showProject} hideSubtasks />
        </button>
        {task.status === 'in_progress' && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11.5px] font-medium text-primary">В роботі</span>}
        {task.subtasks.length > 0 && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`Підзадачі: ${task.subtasks.filter((s) => s.done).length} з ${task.subtasks.length}`}
            onClick={() => setOpen((o) => !o)}
            className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-surface-2"
          >
            <SubtaskProgress task={task} />
            <ChevronDown className={cn('h-3.5 w-3.5 text-subtle transition-transform', open && 'rotate-180')} />
          </button>
        )}
        <CategoryDot task={task} />
      </div>
      {open && (
        <ul className="relative mb-1 ml-[42px] mr-3 space-y-0.5">
          {[...task.subtasks]
            .sort((a, b) => a.order - b.order)
            .map((st) => (
              <li key={st.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] hover:bg-surface-2/70">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--success))]" checked={st.done} onChange={() => void actions.tasks.toggleSubtask(task, st.id).catch(() => undefined)} />
                  <span className={cn('min-w-0 flex-1 truncate', st.done && 'text-muted line-through')}>{st.title}</span>
                </label>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function TaskCard({ task, today, onDragStart }: { task: Task; today: DateKey; onDragStart: (e: DragEvent, t: Task) => void }) {
  const { openTask } = useUI();
  const done = task.status === 'completed';
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => openTask(task.id)}
      onKeyDown={(e) => e.key === 'Enter' && openTask(task.id)}
      role="button"
      tabIndex={0}
      className={cn(
        'cursor-grab rounded-2xl bg-surface p-3 shadow-[0_1px_2px_rgba(16,24,40,.06)] ring-1 ring-line/70 transition-shadow hover:shadow-soft active:cursor-grabbing',
        done && 'opacity-55',
      )}
    >
      <div className="flex items-start gap-2.5">
        <TaskCheck task={task} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-[14px] leading-snug', done && 'line-through')}>{task.title}</p>
          <TaskMeta task={task} today={today} showDate hideSubtasks />
        </div>
        <CategoryDot task={task} />
      </div>
      {task.subtasks.length > 0 && !done && (
        <div className="ml-[30px] mt-2">
          <SubtaskProgress task={task} />
        </div>
      )}
    </div>
  );
}

const COLUMN_META: Record<BoardColumn, { label: string; color?: string }> = {
  todo: { label: 'До виконання' },
  in_progress: { label: 'В роботі', color: 'rgb(var(--primary))' },
  completed: { label: 'Виконано', color: 'rgb(var(--success))' },
};

/** Status board: drag a card into another column to change its status. */
export function TaskBoard({
  columns,
  today,
  onAdd,
}: {
  columns: Record<BoardColumn, Task[]>;
  today: DateKey;
  onAdd: (status: BoardColumn) => void;
}) {
  const actions = useActions();
  const [over, setOver] = useState<BoardColumn | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);

  const onDragStart = (e: DragEvent, t: Task) => {
    setDragging(t);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t.id);
  };
  const drop = (status: BoardColumn) => {
    setOver(null);
    const t = dragging;
    setDragging(null);
    if (!t || t.status === status) return;
    void actions.tasks.setStatus(t, status).then(
      () => toast.success(`«${t.title}» → ${COLUMN_META[status].label}`),
      () => undefined,
    );
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-3">
      {BOARD_COLUMNS.map((status) => {
        const meta = COLUMN_META[status];
        const list = columns[status];
        return (
          <section
            key={status}
            aria-label={meta.label}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              if (over !== status) setOver(status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(status);
            }}
            className="flex min-h-0 min-w-0 flex-col"
          >
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <span className="text-[14px] font-semibold" style={meta.color ? { color: meta.color } : undefined}>
                {meta.label}
              </span>
              <span className="text-[12.5px] text-subtle">{list.length}</span>
              <button
                type="button"
                onClick={() => onAdd(status)}
                aria-label={`Додати задачу: ${meta.label}`}
                className="ml-auto rounded-lg p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div
              className={cn(
                'scrollbar-thin min-h-[120px] flex-1 space-y-2 overflow-y-auto rounded-2xl bg-surface-2/70 p-2 transition-colors',
                over === status && 'bg-primary/[0.07] ring-2 ring-primary/25',
              )}
            >
              {list.map((t) => (
                <TaskCard key={t.id} task={t} today={today} onDragStart={onDragStart} />
              ))}
              {status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => onAdd(status)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[13px] text-subtle transition-colors hover:text-ink"
                >
                  <Plus className="h-3.5 w-3.5" /> Додати
                </button>
              )}
              {status === 'completed' && list.length === 0 && <p className="px-2 py-2 text-[12.5px] text-subtle">Перетягніть сюди виконану задачу</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
