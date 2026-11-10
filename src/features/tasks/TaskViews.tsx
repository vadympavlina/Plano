import { memo, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { CategoryChip } from '@/components/common/CategoryMark';
import { Check, ChevronDown, CornerDownRight, FolderKanban, Plus, Repeat } from 'lucide-react';
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
import { reducedMotion, rubberBand, runSpring, VelocityTracker, type SpringHandle } from '@/lib/gesture/spring';

/** Ring colour of the completion circle: orange for high priority, red for urgent. */
const RING: Partial<Record<Task['priority'], string>> = { urgent: 'rgb(var(--danger))', high: 'rgb(var(--warning))' };

/** Round completion toggle. The ring flags high/urgent priority; half-filled means "in progress". */
export function TaskCheck({ task }: { task: Task }) {
  const actions = useActions();
  const done = task.status === 'completed';
  const doing = task.status === 'in_progress';
  const ring = RING[task.priority] ?? (doing ? 'rgb(var(--danger))' : undefined);
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
        'relative flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition-colors before:absolute before:-inset-2 before:content-[""]',
        done ? 'border-transparent bg-accent text-surface' : 'border-subtle/70 hover:border-ink',
      )}
      style={
        !done
          ? {
              ...(ring ? { borderColor: ring } : {}),
              ...(doing ? { backgroundImage: `linear-gradient(90deg, ${ring ?? 'rgb(var(--danger))'} 50%, transparent 50%)` } : {}),
            }
          : undefined
      }
    >
      {done && <Check className="h-3.5 w-3.5 stroke-[3.2]" />}
    </button>
  );
}

/** Small line under the title: time or date, project, subtasks, repeat. */
function TaskMeta({ task, today, showDate, showProject = true, hideSubtasks }: { task: Task; today: DateKey; showDate: boolean; showProject?: boolean; hideSubtasks?: boolean }) {
  const { projectById, categoryById } = useCollections();
  const category = task.categoryId ? categoryById(task.categoryId) : undefined;
  const settings = useSettings();
  const project = showProject && task.projectId ? projectById(task.projectId) : undefined;
  const d = taskDate(task);
  const overdue = d && d < today && task.status !== 'completed';
  const subDone = task.subtasks.filter((s) => s.done).length;
  const parts: ReactNode[] = [];
  if (showDate && d && d !== today)
    parts.push(
      <span key="d">{relativeDayLabel(d, today, 'EEEEEE, d MMM')}</span>,
    );
  if (task.startTime)
    parts.push(
      <span key="t" className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'font-semibold text-danger')}>
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
  if (category) parts.push(<CategoryChip key="c" category={category} />);
  if (!parts.length) return null;
  return <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted">{parts}</p>;
}

/** Subtask progress as a small bar with "2 з 5". */
function SubtaskProgress({ task }: { task: Task }) {
  const done = task.subtasks.filter((s) => s.done).length;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-muted">
      <span className="h-1 w-8 overflow-hidden rounded-full bg-line">
        <span className="block h-full w-full rounded-full bg-success transition-transform motion-reduce:transition-none" style={{ transform: `translateX(${(done / task.subtasks.length) * 100 - 100}%)` }} />
      </span>
      {done} з {task.subtasks.length}
    </span>
  );
}

const SWIPE = 80;

/**
 * Touch swipe on a row: right completes, left moves to tomorrow. Vertical scrolling stays native.
 * The row follows the finger through direct style writes (no React state per move); the reveal
 * layer's opacity derives from the same offset. On release a spring takes the row home, seeded
 * with the finger's velocity; a quick flick triggers the action even over a short distance.
 */
function useSwipe(onRight: () => void, onLeft: () => void) {
  const row = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const sideRef = useRef<'left' | 'right' | null>(null);
  const start = useRef<{ x: number; y: number; on: boolean; id: number } | null>(null);
  const moved = useRef(false);
  const pos = useRef(0);
  const spring = useRef<SpringHandle | null>(null);
  const tracker = useRef(new VelocityTracker());
  const cb = useRef({ onRight, onLeft });
  cb.current = { onRight, onLeft };

  const write = (x: number) => {
    pos.current = x;
    if (row.current) row.current.style.transform = x ? `translate3d(${x}px,0,0)` : '';
    if (reveal.current) reveal.current.style.opacity = String(Math.min(1, Math.abs(x) / SWIPE));
    const next = x > 0 ? 'right' : x < 0 ? 'left' : null;
    // Re-render only when the direction flips, not on every move.
    if (next !== sideRef.current) setSide((sideRef.current = next));
  };
  const home = (v: number) => {
    spring.current?.stop();
    if (reducedMotion()) return write(0);
    spring.current = runSpring({ from: pos.current, to: 0, velocity: v, stiffness: 480, damping: 36, onUpdate: write, onDone: () => (spring.current = null) });
  };

  return {
    row,
    reveal,
    side,
    pos,
    /** True right after a swipe, so the click that ends it is ignored. */
    swallowClick: () => moved.current && !(moved.current = false),
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        const caught = spring.current !== null;
        spring.current?.stop();
        spring.current = null;
        start.current = { x: e.clientX - pos.current, y: e.clientY, on: caught, id: e.pointerId };
        tracker.current.reset(pos.current);
        moved.current = caught;
      },
      onPointerMove: (e: PointerEvent) => {
        const s = start.current;
        if (!s || e.pointerId !== s.id) return;
        const x = e.clientX - s.x;
        if (!s.on) {
          if (Math.abs(e.clientY - s.y) > 10) return void (start.current = null);
          if (Math.abs(x) < 12) return;
          s.on = moved.current = true;
        }
        tracker.current.push(x);
        write(rubberBand(x, SWIPE * 1.4));
      },
      onPointerUp: (e: PointerEvent) => {
        const s = start.current;
        start.current = null;
        if (!s || e.pointerId !== s.id || !s.on) return;
        const v = tracker.current.velocity;
        const x = pos.current;
        const fire = x >= SWIPE || (v > 600 && x > 24) ? 'right' : x <= -SWIPE || (v < -600 && x < -24) ? 'left' : null;
        if (fire === 'right') cb.current.onRight();
        else if (fire === 'left') cb.current.onLeft();
        home(v);
      },
      onPointerCancel: () => {
        start.current = null;
        home(0);
      },
    },
  };
}

/** Memoised: records keep their identity until they change, so a list only redraws the rows that did. */
export const TaskRow = memo(function TaskRow({
  task,
  today,
  showDate = true,
  showProject = true,
  selected,
  onOpen,
}: {
  task: Task;
  today: DateKey;
  showDate?: boolean;
  showProject?: boolean;
  /** Outlined, when the task is open in the page's side card. */
  selected?: boolean;
  /** Replaces the default (details sheet); keep it stable so rows stay memoised. */
  onOpen?: (id: string) => void;
}) {
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
  const revealText = swipe.side === 'right' ? (done ? 'Повернути' : 'Виконано') : 'Завтра';
  return (
    <div className="relative overflow-hidden rounded-2xl [contain-intrinsic-size:auto_58px] [content-visibility:auto]">
      {swipe.side && (
        <div
          ref={swipe.reveal}
          aria-hidden
          className={cn('absolute inset-0 flex items-center px-4 text-[13px] font-semibold text-white', swipe.side === 'right' ? 'justify-start bg-success' : 'justify-end bg-primary')}
          style={{ opacity: Math.min(1, Math.abs(swipe.pos.current) / SWIPE) }}
        >
          {revealText}
        </div>
      )}
      <div
        ref={swipe.row}
        {...swipe.handlers}
        className={cn('group relative flex touch-pan-y items-start gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-2/70', done && 'opacity-55', selected && 'ring-[1.8px] ring-inset ring-ink', swipe.side && 'bg-surface')}
      >
        <span className="pt-px">
          <TaskCheck task={task} />
        </span>
        <button type="button" onClick={() => !swipe.swallowClick() && (onOpen ?? openTask)(task.id)} className="-my-2.5 min-w-0 flex-1 py-2.5 text-left">
          <span className={cn('block truncate text-[15.5px] font-medium leading-snug', done && 'line-through')}>{task.title}</span>
          <TaskMeta task={task} today={today} showDate={showDate} showProject={showProject} hideSubtasks />
        </button>
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
});

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
                className="ml-auto rounded-full p-2 text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
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
