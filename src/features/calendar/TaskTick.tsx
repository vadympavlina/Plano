import { Check } from 'lucide-react';
import { useActions } from '@/hooks/useActions';
import { cn } from '@/lib/utils/cn';
import type { Task } from '@/types';
import { haptic } from '@/lib/utils/haptic';

/** Round checkbox for a task inside the calendar: ticks the task without opening it. */
export function TaskTick({ task, color, size = 14 }: { task: Task; color: string; size?: number }) {
  const actions = useActions();
  const done = task.status === 'completed';
  return (
    <span
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Повернути «${task.title}»` : `Виконати «${task.title}»`}
      tabIndex={0}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        haptic();
        void actions.tasks.setDone(task, !done).catch(() => undefined);
      }}
      onKeyDown={(e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.stopPropagation();
        e.preventDefault();
        void actions.tasks.setDone(task, !done).catch(() => undefined);
      }}
      className={cn('flex shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-colors', done ? 'border-transparent bg-success text-white' : 'bg-surface hover:bg-surface-2')}
      style={{ width: size, height: size, borderColor: done ? undefined : color }}
    >
      {done && <Check className="stroke-[3.5]" style={{ width: size * 0.65, height: size * 0.65 }} />}
    </span>
  );
}

/** Dashed, lightly tinted look that tells tasks apart from (solid) events. */
export function taskChipStyle(color: string, done: boolean) {
  return done
    ? { borderColor: 'rgb(var(--line))', backgroundColor: 'rgb(var(--surface-2))' }
    : { borderColor: `color-mix(in srgb, ${color} 70%, rgb(var(--surface)))`, backgroundColor: `color-mix(in srgb, ${color} 7%, rgb(var(--surface)))` };
}
