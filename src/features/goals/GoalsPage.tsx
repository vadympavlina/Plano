import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
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

const COLS = 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_190px_120px_auto]';
const PACE_PILL: Record<Pace, string> = {
  done: 'bg-success/10 text-success',
  ahead: 'bg-success/10 text-success',
  on_track: 'bg-primary/10 text-primary',
  behind: 'bg-warning/15 text-warning',
  overdue: 'bg-danger/10 text-danger',
  no_deadline: 'bg-surface-2 text-muted',
};

function GoalRow({ goal, onEdit, onProgress }: { goal: Goal; onEdit: () => void; onProgress: () => void }) {
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

  const remove = async () => {
    const ok = await confirm({ title: 'Видалити ціль?', description: `«${goal.title}» та історію прогресу буде видалено.`, confirmLabel: 'Видалити', danger: true });
    if (ok) await actions.goals.remove(goal.id).then(() => toast.success('Ціль видалено'), () => undefined);
  };

  return (
    <div className={cn(finished && 'opacity-70')}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o))}
        className={cn('grid cursor-pointer grid-cols-1 items-center gap-x-5 gap-y-3 px-5 py-4 transition-colors hover:bg-surface-2/60', COLS)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f`, color }}>
            <Target className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold">{goal.title}</p>
            <p className="truncate text-[12px] text-muted">
              {projects.length ? `Проєкт ${projects.map((p) => p.name).join(', ')}` : category?.name ?? 'Особиста ціль'}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 flex justify-between gap-2 text-[12px]">
            <span className="text-muted">
              <b className="text-ink">{fmt(goal.currentValue)}</b> з {fmt(goal.targetValue)} {goal.unit}
            </span>
            <span className="font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={goal.title}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            {expectedPct != null && pace !== 'done' && (
              <span
                className="absolute -top-1 h-[18px] w-[2px] -translate-x-1/2 rounded bg-ink/45"
                style={{ left: `${expectedPct}%` }}
                title={`Де треба бути сьогодні: ${fmt(Math.round(expected!))} ${goal.unit ?? ''}`}
              />
            )}
          </div>
        </div>

        {/* Pace, deadline, action: columns on wide screens, one line on phones. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:contents">
          <span className="md:block">
            <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold', finished && goal.status !== 'completed' ? 'bg-surface-2 text-muted' : PACE_PILL[pace])}>
              {finished && goal.status !== 'completed' ? GOAL_STATUS_LABEL[goal.status] : paceText(goal, today)}
            </span>
          </span>
          <span className="text-[13px] md:block">
            {goal.targetDate ? (
              <>
                <span className="font-medium">{formatDateKey(goal.targetDate, goal.targetDate.slice(0, 4) === today.slice(0, 4) ? 'd MMMM' : 'd MMM yyyy')}</span>
                {daysLeft != null && !finished && (
                  <span className={cn('text-[12px] md:block', daysLeft < 0 ? 'font-semibold text-danger' : daysLeft <= 14 ? 'font-semibold text-warning' : 'text-muted')}>
                    <span className="md:hidden"> · </span>
                    {daysLeft < 0 ? 'минув' : daysLeft === 0 ? 'сьогодні' : `${daysLeft} ${plural(daysLeft, ['день', 'дні', 'днів'])}`}
                  </span>
                )}
              </>
            ) : (
              <span className="text-subtle">Без дедлайну</span>
            )}
          </span>
          <span className="ml-auto md:ml-0 md:justify-self-end">
            {goal.status === 'active' && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onProgress();
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Додати
              </Button>
            )}
          </span>
        </div>
      </div>

      {open && (
        <div className="border-t border-line/70 bg-surface-2/50 px-5 py-4 animate-fade-in">
          {goal.description && <p className="mb-3 text-[13px] text-muted">{goal.description}</p>}
          {goal.history.length > 0 ? (
            <ul className="scrollbar-thin mb-3 max-h-48 space-y-1.5 overflow-y-auto text-[13px]">
              {[...goal.history].reverse().map((h) => (
                <li key={h.id} className="flex items-baseline gap-4">
                  <span className="w-28 shrink-0 text-muted">{new Date(h.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span className="w-24 shrink-0 font-semibold tabular-nums" style={{ color }}>
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
  const activeCount = goals.filter((g) => g.status === 'active').length;
  const doneThisYear = goals.filter((g) => g.status === 'completed' && g.updatedAt.startsWith(year)).length;
  const groups = GROUPS.filter((g) => filter === 'all' || filter === g.key)
    .map((g) => ({ ...g, list: goals.filter(g.match).sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-3">
        <h1 className="text-[26px] font-bold tracking-tight sm:text-[28px]">Цілі</h1>
        {goals.length > 0 && (
          <span className="text-[13.5px] text-muted">
            {activeCount} {plural(activeCount, ['активна', 'активні', 'активних'])}
            {doneThisYear > 0 && ` · ${doneThisYear} ${plural(doneThisYear, ['досягнута', 'досягнуті', 'досягнутих'])} цього року`}
          </span>
        )}
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto sm:flex-none">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all' as Filter, label: 'Усі', count: goals.length },
                ...GROUPS.filter((g) => g.key === 'active' || goals.some(g.match)).map((g) => ({ value: g.key as Filter, label: g.label, count: goals.filter(g.match).length })),
              ]}
            />
          </div>
          <Button variant="dark" size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Ціль
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[20px] border border-line/60 bg-surface shadow-soft">
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
        <>
          <div className={cn('hidden gap-5 px-5 pb-2 text-[11.5px] font-semibold uppercase tracking-wide text-subtle md:grid', COLS)}>
            <span>Ціль</span>
            <span>
              Прогрес <span className="font-normal normal-case">· риска — де треба бути сьогодні</span>
            </span>
            <span>Темп</span>
            <span>Дедлайн</span>
            <span />
          </div>
          {groups.map((g) => (
            <section key={g.key} className="mt-6 first-of-type:mt-3">
              <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {g.label} <span className="font-normal">{g.list.length}</span>
              </h2>
              <div className="divide-y divide-line/70 overflow-hidden rounded-[20px] border border-line/60 bg-surface shadow-soft">
                {g.list.map((goal) => (
                  <GoalRow key={goal.id} goal={goal} onEdit={() => setEditing(goal)} onProgress={() => setProgressGoal(goal)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {progressGoal && <ProgressDialog goal={progressGoal} onClose={() => setProgressGoal(null)} />}
    </div>
  );
}
