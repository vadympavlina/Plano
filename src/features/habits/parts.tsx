import type { ReactNode } from 'react';
import { Check, ShieldCheck, X } from 'lucide-react';
import { useData } from '@/app/providers/DataProvider';
import { useActions } from '@/hooks/useActions';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { DateKey, Habit } from '@/types';
import { habitValue, isBad, isDone, nextHabitValue } from './logic';

export function Ring({ value, size, stroke, color, children }: { value: number; size: number; stroke: number; color: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </span>
  );
}

/** Logs one more unit (count habits) or toggles a check habit for a date. */
export function useHabitToggle() {
  const { data } = useData();
  const actions = useActions();
  return (habit: Habit, date: DateKey, mode: 'tap' | 'toggle' = 'tap') => {
    const next = nextHabitValue(habit, habitValue(data.habitLogs, habit.id, date), mode);
    return actions.habits.setValue(habit.id, date, next).catch(() => undefined);
  };
}

/** Round button on a habit card: a check for check habits, a progress ring with +1 for count habits. */
export function HabitQuickButton({ habit, today, size = 44 }: { habit: Habit; today: DateKey; size?: number }) {
  const { data } = useData();
  const toggle = useHabitToggle();
  const color = colorOf(habit.color);
  const value = habitValue(data.habitLogs, habit.id, today);
  const done = isDone(habit, data.habitLogs, today);
  if (isBad(habit)) {
    // Bad habit: green shield while the day is clean; a tap logs a slip.
    return (
      <button
        type="button"
        aria-label={done ? `«${habit.name}»: позначити зрив${habit.goalType === 'count' ? ` (${value} з ${habit.target})` : ''}` : `«${habit.name}»: ${habit.goalType === 'count' ? `додати ще (${value})` : 'скасувати зрив'}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void toggle(habit, today);
        }}
        className="relative shrink-0 rounded-full transition-transform active:scale-95"
      >
        {done ? (
          <span className="flex items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: tint(color, 0.14), color }}>
            <ShieldCheck className="h-5 w-5" />
          </span>
        ) : (
          <span className="flex items-center justify-center rounded-full bg-danger text-white" style={{ width: size, height: size }}>
            <X className="h-5 w-5 stroke-[3]" />
          </span>
        )}
        {habit.goalType === 'count' && value > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1.5 text-[10px] font-bold text-surface">{value}</span>
        )}
      </button>
    );
  }
  const label =
    habit.goalType === 'count'
      ? done
        ? `«${habit.name}»: виконано, натисніть щоб скинути`
        : `«${habit.name}»: додати 1 (${value} з ${habit.target})`
      : done
        ? `Зняти відмітку «${habit.name}»`
        : `Відмітити «${habit.name}»`;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={done}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(habit, today);
      }}
      className="shrink-0 rounded-full transition-transform active:scale-95"
    >
      {done ? (
        <span className="flex items-center justify-center rounded-full text-white" style={{ width: size, height: size, backgroundColor: color }}>
          <Check className="h-5 w-5 stroke-[3]" />
        </span>
      ) : habit.goalType === 'count' ? (
        <Ring value={value / Math.max(1, habit.target)} size={size} stroke={4} color={color}>
          <span className="text-[11px] font-bold" style={{ color }}>
            +1
          </span>
        </Ring>
      ) : (
        <span
          className={cn('block rounded-full border-2 border-dashed transition-colors hover:border-solid')}
          style={{ width: size, height: size, borderColor: tint(color, 0.6) }}
        />
      )}
    </button>
  );
}
