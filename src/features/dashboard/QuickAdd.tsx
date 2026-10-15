import { useState, type FormEvent } from 'react';
import { Plus, CalendarDays, CheckSquare, NotebookPen } from 'lucide-react';
import { DatePicker, TimePicker } from '@/components/ui/date-time';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useActions } from '@/hooks/useActions';
import { useToday } from '@/hooks/useNow';
import { useCreateNote } from '@/components/layout/CreateMenu';
import { deviceTimeZone, minutesToTime, roundUpTime, timeToMinutes } from '@/lib/date';
import { settleWrite } from '@/services/sync';
import { toast } from '@/components/ui/toast';

type Kind = 'task' | 'event' | 'note';

const KINDS: { value: Kind; label: string; icon: typeof CheckSquare }[] = [
  { value: 'task', label: 'Задача', icon: CheckSquare },
  { value: 'event', label: 'Подія', icon: CalendarDays },
  { value: 'note', label: 'Нотатка', icon: NotebookPen },
];

/** One-line capture: type a title, choose what it is, optionally a date. */
export function QuickAdd({ className }: { className?: string }) {
  const today = useToday();
  const actions = useActions();
  const createNote = useCreateNote();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('task');
  const [date, setDate] = useState<string>(today);
  const [time, setTime] = useState<string>(() => roundUpTime(new Date()));
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    if (kind === 'note') {
      createNote({ title: t });
      setTitle('');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'task') {
        await settleWrite(
          actions.tasks.create({ title: t, status: 'todo', priority: 'medium', subtasks: [], tags: [], dueDate: date || undefined }).write,
        );
        toast.success('Задачу додано');
      } else {
        const start = time || '09:00';
        await settleWrite(
          actions.events.create({
            title: t,
            date: date || today,
            allDay: false,
            startTime: start,
            endTime: minutesToTime(Math.min(timeToMinutes(start) + 60, 23 * 60 + 59)),
            exdates: [],
            source: 'plano',
            timezone: deviceTimeZone(),
          }).write,
        );
        toast.success('Подію додано');
      }
      setTitle('');
    } catch {
      /* failure toast is shown by the sync layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'card flex flex-col gap-2 p-2 transition-colors focus-within:border-subtle/60 lg:flex-row lg:items-center lg:gap-3',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
        <Plus className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'task' ? 'Швидко додати задачу…' : kind === 'event' ? 'Швидко додати подію…' : 'Почати нотатку…'}
          aria-label="Назва для швидкого додавання"
          maxLength={300}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-2 lg:flex-nowrap lg:pl-0">
        <div role="radiogroup" aria-label="Тип" className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {KINDS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                kind === value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {kind !== 'note' && (
          <DatePicker
            variant="chip"
            aria-label="Дата"
            clearable={kind === 'task'}
            placeholder="Без дати"
            value={date || undefined}
            onChange={(d) => setDate(d ?? '')}
          />
        )}
        {kind === 'event' && <TimePicker variant="chip" aria-label="Час початку" value={time} onChange={(t) => t && setTime(t)} />}
        <Button type="submit" variant="dark" size="sm" className="ml-auto h-9 px-4" loading={busy} disabled={!title.trim()}>
          Додати
        </Button>
      </div>
    </form>
  );
}
