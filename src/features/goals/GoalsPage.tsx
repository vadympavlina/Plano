import { useState, type FormEvent } from 'react';
import { CalendarClock, MoreHorizontal, Pencil, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, Card, Progress, Segmented } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Stepper } from '@/components/ui/controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { EmptyState } from '@/components/common/States';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useToday } from '@/hooks/useNow';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';
import { settleWrite } from '@/services/sync';
import { colorOf } from '@/lib/utils/colors';
import { diffDaysKey, formatDateKey, plural } from '@/lib/date';
import type { Goal } from '@/types';
import { GOAL_STATUS_LABEL, PACE_LABEL, goalPace, goalPercent } from './logic';
import { GoalForm } from './GoalForm';

const PACE_COLOR = { done: '#35B98A', ahead: '#35B98A', on_track: '#4778F5', behind: '#F0A54A', overdue: '#E5484D', no_deadline: undefined };

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

function GoalCard({ goal, onEdit, onProgress }: { goal: Goal; onEdit: () => void; onProgress: () => void }) {
  const { categoryById, projectById } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const today = useToday();
  const [showHistory, setShowHistory] = useState(false);
  const category = categoryById(goal.categoryId);
  const color = colorOf(category?.color ?? 'blue');
  const pct = goalPercent(goal);
  const pace = goalPace(goal, today);
  const daysLeft = goal.targetDate ? diffDaysKey(goal.targetDate, today) : null;

  const remove = async () => {
    const ok = await confirm({ title: 'Видалити ціль?', description: `«${goal.title}» та історію прогресу буде видалено.`, confirmLabel: 'Видалити', danger: true });
    if (ok) await actions.goals.remove(goal.id).then(() => toast.success('Ціль видалено'), () => undefined);
  };

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {category && <Badge color={color}>{category.name}</Badge>}
            {goal.status !== 'active' ? <Badge>{GOAL_STATUS_LABEL[goal.status]}</Badge> : <Badge color={PACE_COLOR[pace]}>{PACE_LABEL[pace]}</Badge>}
          </div>
          <h3 className="text-[15px] font-semibold leading-snug">{goal.title}</h3>
          {goal.description && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{goal.description}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-ink" aria-label={`Дії для «${goal.title}»`}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>Редагувати</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => void remove()}>Видалити</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-5 flex items-baseline justify-between">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {goal.currentValue}
          <span className="text-sm font-normal text-muted"> / {goal.targetValue} {goal.unit}</span>
        </p>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <Progress value={pct} color={color} className="mt-2 h-2" label={goal.title} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {goal.targetDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDateKey(goal.targetDate, settings.dateFormat)}
            {daysLeft != null && daysLeft >= 0 && ` · залишилось ${daysLeft} ${plural(daysLeft, ['день', 'дні', 'днів'])}`}
          </span>
        )}
        {goal.projectIds.map((id) => projectById(id)).filter(Boolean).map((p) => <span key={p!.id}>{p!.name}</span>)}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-4">
        {goal.status === 'active' && (
          <Button size="sm" variant="dark" onClick={onProgress}>
            <TrendingUp className="h-3.5 w-3.5" /> Оновити прогрес
          </Button>
        )}
        {goal.history.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory}>
            Історія ({goal.history.length})
          </Button>
        )}
      </div>
      {showHistory && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto border-t border-line pt-3 text-xs scrollbar-thin">
          {[...goal.history].reverse().map((h) => (
            <li key={h.id} className="flex justify-between gap-3">
              <span className="text-muted">{new Date(h.date).toLocaleDateString('uk-UA')}{h.note ? ` · ${h.note}` : ''}</span>
              <span className="font-medium tabular-nums">{h.value} {goal.unit}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function GoalsPage() {
  const { goals } = useCollections();
  const [filter, setFilter] = useState<'active' | 'completed' | 'other'>('active');
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  useOpenFromQuery(() => setEditing('new'));

  const list = goals
    .filter((g) => (filter === 'active' ? g.status === 'active' : filter === 'completed' ? g.status === 'completed' : g.status === 'paused' || g.status === 'abandoned'))
    .sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999'));

  return (
    <PageContainer>
      <PageHeader
        title="Цілі"
        subtitle="Довгострокові результати з вимірюваним прогресом."
        actions={
          <Button variant="dark" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Нова ціль
          </Button>
        }
      />
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: 'Активні', count: goals.filter((g) => g.status === 'active').length },
          { value: 'completed', label: 'Досягнуті', count: goals.filter((g) => g.status === 'completed').length },
          { value: 'other', label: 'На паузі', count: goals.filter((g) => g.status === 'paused' || g.status === 'abandoned').length },
        ]}
      />
      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Target />}
            title={goals.length ? 'Тут цілей немає' : 'Цілей поки немає'}
            description="Наприклад: прочитати 12 книжок цього року, завершити власний проєкт або прокачати навичку."
            action={
              <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
                <Plus className="h-3.5 w-3.5" /> Створити ціль
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} onProgress={() => setProgressGoal(g)} />
          ))}
        </div>
      )}
      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {progressGoal && <ProgressDialog goal={progressGoal} onClose={() => setProgressGoal(null)} />}
    </PageContainer>
  );
}
