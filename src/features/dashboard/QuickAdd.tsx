import { useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, CheckSquare, NotebookPen } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
    <form onSubmit={onSubmit} className={cn('space-y-3', className)}>
      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === 'task' ? 'Додати задачу…' : kind === 'event' ? 'Додати подію…' : 'Почати нотатку…'}
          aria-label="Назва для швидкого додавання"
          maxLength={300}
        />
        <Button type="submit" variant="dark" size="icon" aria-label="Додати" loading={busy} disabled={!title.trim()}>
          {!busy && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Тип" className="inline-flex rounded-lg bg-surface-2 p-0.5">
          {KINDS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                kind === value ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {kind !== 'note' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <DatePicker
              variant="chip"
              className="h-7 text-xs"
              aria-label="Дата"
              clearable={kind === 'task'}
              placeholder="Без дати"
              value={date || undefined}
              onChange={(d) => setDate(d ?? '')}
            />
            {kind === 'event' && (
              <TimePicker variant="chip" className="h-7 text-xs" aria-label="Час початку" value={time} onChange={(t) => t && setTime(t)} />
            )}
          </div>
        )}
      </div>
    </form>
  );
}
