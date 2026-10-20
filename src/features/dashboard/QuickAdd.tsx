import { useMemo, useState, type FormEvent } from 'react';
import { Plus, CalendarDays, CheckSquare, NotebookPen } from 'lucide-react';
import { DatePicker, TimePicker } from '@/components/ui/date-time';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useActions } from '@/hooks/useActions';
import { useToday } from '@/hooks/useNow';
import { useCreateNote } from '@/components/layout/CreateMenu';
import { deviceTimeZone, formatDuration, formatTimeRange, minutesToTime, relativeDayLabel, roundUpTime, timeToMinutes } from '@/lib/date';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { parseQuick } from './parse';
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
  const { categories, projects } = useCollections();
  const settings = useSettings();

  // «Зустріч завтра о 15 на годину #робота»: date, time, length and #category/#project come from the text.
  const parsed = useMemo(() => {
    const p = parseQuick(title, today);
    const find = <T extends { name: string }>(list: T[]) => list.find((x) => p.tags.some((t) => t.toLowerCase() === x.name.toLowerCase().replace(/\s+/g, '')));
    const category = find(categories);
    const project = find(projects);
    const tags = p.tags.filter((t) => ![category?.name, project?.name].some((n) => n && n.toLowerCase().replace(/\s+/g, '') === t.toLowerCase()));
    return { ...p, category, project, tags };
  }, [title, today, categories, projects]);
  const effective: Kind = kind === 'note' ? 'note' : kind === 'event' || parsed.duration ? 'event' : 'task';
  const chips = [
    effective !== kind && 'Подія',
    parsed.date && relativeDayLabel(parsed.date, today, 'EEEEEE, d MMM'),
    parsed.time && formatTimeRange(parsed.time, parsed.duration ? minutesToTime(Math.min(timeToMinutes(parsed.time) + parsed.duration, 23 * 60 + 59)) : undefined, settings.timeFormat),
    !parsed.time && parsed.duration && formatDuration(parsed.duration),
    parsed.category && `🏷 ${parsed.category.name}`,
    parsed.project && `📁 ${parsed.project.name}`,
    ...parsed.tags.map((t) => `#${t}`),
    parsed.priority && (parsed.priority === 'urgent' ? 'Терміново' : 'Важливо'),
  ].filter(Boolean) as string[];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    const t = (kind === 'note' ? title : parsed.title).trim() || title.trim();
    if (kind === 'note') {
      createNote({ title: t });
      setTitle('');
      return;
    }
    setBusy(true);
    try {
      const day = parsed.date ?? date;
      const links = { categoryId: parsed.category?.id, projectId: parsed.project?.id };
      if (effective === 'task') {
        await settleWrite(
          actions.tasks.create({
            title: t,
            status: 'todo',
            priority: parsed.priority ?? 'medium',
            subtasks: [],
            tags: parsed.tags,
            dueDate: day || (parsed.time ? today : undefined),
            startTime: parsed.time,
            ...links,
          }).write,
        );
        toast.success('Задачу додано');
      } else {
        const start = parsed.time ?? (time || '09:00');
        await settleWrite(
          actions.events.create({
            title: t,
            date: day || today,
            allDay: false,
            startTime: start,
            endTime: minutesToTime(Math.min(timeToMinutes(start) + (parsed.duration ?? 60), 23 * 60 + 59)),
            ...links,
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
          placeholder={kind === 'note' ? 'Почати нотатку…' : 'Напр. «Зустріч завтра о 15 на годину #робота»'}
          aria-label="Назва для швидкого додавання"
          maxLength={300}
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
        />
        {kind !== 'note' && chips.length > 0 && (
          <span className="hidden max-w-[50%] shrink-0 gap-1 overflow-hidden sm:flex" aria-live="polite">
            {chips.map((c) => (
              <span key={c} className="whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-medium text-primary">
                {c}
              </span>
            ))}
          </span>
        )}
      </div>
      {kind !== 'note' && chips.length > 0 && (
        <p className="flex flex-wrap gap-1 pl-8 sm:hidden" aria-hidden>
          {chips.map((c) => (
            <span key={c} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-medium text-primary">
              {c}
            </span>
          ))}
        </p>
      )}
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
