import { useState, type FormEvent } from 'react';
import { ChevronDown, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { Ring } from '@/features/habits/parts';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Stepper } from '@/components/ui/controls';
import { EmptyState } from '@/components/common/States';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useCollections } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useToday } from '@/hooks/useNow';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';
import { settleWrite } from '@/services/sync';
import { colorOf } from '@/lib/utils/colors';
import { diffDaysKey, formatDateKey, plural } from '@/lib/date';
import type { Goal } from '@/types';
import { GOAL_STATUS_LABEL, expectedValue, goalPace, goalPercent, paceText, type Pace } from './logic';
import { cn } from '@/lib/utils/cn';
import { GoalForm } from './GoalForm';


function ProgressDialog({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const actions = useActions();
  const [value, setValue] = useState(String(goal.currentValue));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const num = Number(value);
  const invalid = value.trim() === '' || !Number.isFinite(num) || num < 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (invalid || busy) return;
    setBusy(true);
    try {
      await settleWrite(actions.goals.logProgress(goal, num, note.trim()));
      toast.success(num >= goal.targetValue ? 'Ціль досягнуто 🎉' : 'Прогрес збережено');
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Оновити прогрес" description={goal.title} size="sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-end gap-2">
            <Field label={`Поточне значення${goal.unit ? ` (${goal.unit})` : ''}`} error={invalid ? 'Введіть 0 або більше.' : undefined} className="flex-1">
              {(p) => <Stepper {...p} min={0} value={Number(value) || 0} onChange={(v) => setValue(String(v))} />}
            </Field>
          </div>
          <p className="text-xs text-muted">Мета: {goal.targetValue} {goal.unit}</p>
          <Field label="Нотатка (необов’язково)">
            {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Що змінилося?" />}
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Скасувати</Button>
            <Button type="submit" variant="dark" loading={busy} disabled={invalid}>Зберегти</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PACE_PILL: Record<Pace, string> = {
  done: 'bg-success/12 text-success',
  ahead: 'bg-success/12 text-success',
  on_track: 'bg-primary/10 text-primary',
  behind: 'bg-warning/15 text-warning',
  overdue: 'bg-danger/10 text-danger',
  no_deadline: 'bg-surface text-muted',
};

/** A goal as a card: a progress ring, the pace against the plan, the deadline, a quick «Додати». */
function GoalCard({ goal, onEdit, onProgress }: { goal: Goal; onEdit: () => void; onProgress: () => void }) {
  const { categoryById, projectById } = useCollections();
  const actions = useActions();
  const today = useToday();
  const [open, setOpen] = useState(false);
  const category = categoryById(goal.categoryId);
  const color = colorOf(category?.color ?? 'blue');
  const pct = goalPercent(goal);
  const pace = goalPace(goal, today);
  const expected = goal.status === 'active' ? expectedValue(goal, today) : undefined;
  const expectedPct = expected != null && goal.targetValue > 0 ? Math.min(100, (expected / goal.targetValue) * 100) : undefined;
  const projects = goal.projectIds.map((id) => projectById(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const daysLeft = goal.targetDate ? diffDaysKey(goal.targetDate, today) : null;
  const finished = goal.status !== 'active';
  const fmt = (n: number) => n.toLocaleString('uk-UA');
  const deadlineTone = daysLeft == null || finished ? 'bg-surface text-muted' : daysLeft < 0 ? 'bg-danger/10 text-danger' : daysLeft <= 14 ? 'bg-warning/15 text-warning' : 'bg-surface text-muted';

  const remove = async () => {
    const ok = await confirm({ title: 'Видалити ціль?', description: `«${goal.title}» та історію прогресу буде видалено.`, confirmLabel: 'Видалити', danger: true });
    if (ok) await actions.goals.remove(goal.id).then(() => toast.success('Ціль видалено'), () => undefined);
  };

  return (
    <div className={cn('flex min-w-0 flex-col rounded-[24px] bg-surface-2/70 p-4 transition-colors', finished && 'opacity-70')}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o))}
        className="flex cursor-pointer items-center gap-4"
      >
        <Ring value={pct / 100} size={68} stroke={7} color={color}>
          <span className="text-[14px] font-bold tabular-nums">{pct}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[16px] font-bold leading-snug tracking-tight">{goal.title}</h3>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">{projects.length ? `Проєкт ${projects.map((p) => p.name).join(', ')}` : (category?.name ?? 'Особиста ціль')}</p>
          <p className="mt-1 text-[13px] text-muted">
            <b className="font-bold text-ink">{fmt(goal.currentValue)}</b> з {fmt(goal.targetValue)} {goal.unit}
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 self-start text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </div>

      <div className="relative mt-4 h-2.5 rounded-full bg-surface" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={goal.title}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
        {expectedPct != null && pace !== 'done' && (
          <span className="absolute -top-1 h-[18px] w-[2px] -translate-x-1/2 rounded bg-ink/45" style={{ left: `${expectedPct}%` }} title={`Де треба бути сьогодні: ${fmt(Math.round(expected!))} ${goal.unit ?? ''}`} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-semibold', finished && goal.status !== 'completed' ? 'bg-surface text-muted' : PACE_PILL[pace])}>
          {finished && goal.status !== 'completed' ? GOAL_STATUS_LABEL[goal.status] : paceText(goal, today)}
        </span>
        {goal.targetDate && (
          <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-semibold', deadlineTone)}>
            {formatDateKey(goal.targetDate, goal.targetDate.slice(0, 4) === today.slice(0, 4) ? 'd MMM' : 'd MMM yyyy')}
            {daysLeft != null && !finished && ` · ${daysLeft < 0 ? 'минув' : daysLeft === 0 ? 'сьогодні' : `${daysLeft} ${plural(daysLeft, ['день', 'дні', 'днів'])}`}`}
          </span>
        )}
        {goal.status === 'active' && (
          <Button size="sm" variant="dark" className="ml-auto" onClick={onProgress}>
            <Plus className="h-3.5 w-3.5" /> Додати
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 rounded-2xl bg-surface px-4 py-3.5 animate-fade-in">
          {goal.description && <p className="mb-3 text-[13px] text-muted">{goal.description}</p>}
          {goal.history.length > 0 ? (
            <ul className="scrollbar-thin mb-3 max-h-48 space-y-1.5 overflow-y-auto text-[13px]">
              {[...goal.history].reverse().map((h) => (
                <li key={h.id} className="flex items-baseline gap-3">
                  <span className="w-[5.5rem] shrink-0 text-muted">{new Date(h.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</span>
                  <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
                    {fmt(h.value)} {goal.unit}
                  </span>
                  <span className="min-w-0 truncate text-muted">{h.note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-[13px] text-muted">Історії прогресу ще немає.</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Редагувати
            </Button>
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => void remove()}>
              <Trash2 className="h-3.5 w-3.5" /> Видалити
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type Filter = 'all' | 'active' | 'completed' | 'other';
const GROUPS: { key: Exclude<Filter, 'all'>; label: string; match: (g: Goal) => boolean }[] = [
  { key: 'active', label: 'Активні', match: (g) => g.status === 'active' },
  { key: 'other', label: 'На паузі', match: (g) => g.status === 'paused' || g.status === 'abandoned' },
  { key: 'completed', label: 'Досягнуті', match: (g) => g.status === 'completed' },
];

export default function GoalsPage() {
  const { goals } = useCollections();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  useOpenFromQuery(() => setEditing('new'));

  const year = new Date().getFullYear().toString();
  const active = goals.filter((g) => g.status === 'active');
  const activeCount = active.length;
  const doneThisYear = goals.filter((g) => g.status === 'completed' && g.updatedAt.startsWith(year)).length;
  const avg = active.length ? Math.round(active.reduce((n, g) => n + goalPercent(g), 0) / active.length) : 0;
  const groups = GROUPS.filter((g) => filter === 'all' || filter === g.key)
    .map((g) => ({ ...g, list: goals.filter(g.match).sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="w-full px-2 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-[38px]">Цілі</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {goals.length
              ? `${activeCount} ${plural(activeCount, ['активна', 'активні', 'активних'])}${doneThisYear > 0 ? ` · ${doneThisYear} ${plural(doneThisYear, ['досягнута', 'досягнуті', 'досягнутих'])} цього року` : ''}`
              : 'Чого ви хочете досягти'}
          </p>
        </div>
        <Button variant="dark" size="sm" className="mt-1" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Ціль
        </Button>
      </header>

      {goals.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {(
            [
              ['Активні', String(activeCount)],
              ['Досягнуто', String(doneThisYear)],
              ['Прогрес', `${avg}%`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-surface-2/70 px-3.5 py-3">
              <p className="truncate text-[11.5px] font-medium text-muted">{label}</p>
              <p className="mt-0.5 text-[22px] font-extrabold leading-none tracking-tight tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="no-scrollbar mt-4 overflow-x-auto">
        <Segmented
          size="sm"
          ariaLabel="Фільтр цілей"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all' as Filter, label: 'Усі', count: goals.length },
            ...GROUPS.filter((g) => g.key === 'active' || goals.some(g.match)).map((g) => ({ value: g.key as Filter, label: g.label, count: goals.filter(g.match).length })),
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <div className="mt-4 rounded-[24px] bg-surface-2/70">
          <EmptyState
            icon={<Target />}
            title={goals.length ? 'Тут цілей немає' : 'Цілей поки немає'}
            description="Наприклад: прочитати 12 книжок цього року, пробігти 500 км або накопичити на ноутбук."
            action={
              <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
                <Plus className="h-3.5 w-3.5" /> Створити ціль
              </Button>
            }
          />
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-6">
            <h2 className="mb-3 px-1 text-[13px] font-bold">
              {g.label} <span className="ml-1 font-medium text-subtle">{g.list.length}</span>
            </h2>
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {g.list.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onEdit={() => setEditing(goal)} onProgress={() => setProgressGoal(goal)} />
              ))}
            </div>
          </section>
        ))
      )}
      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {progressGoal && <ProgressDialog goal={progressGoal} onClose={() => setProgressGoal(null)} />}
    </div>
  );
}
