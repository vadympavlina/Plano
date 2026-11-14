import { useRef, useState, type FormEvent } from 'react';
import { ChevronRight, Flag, FolderKanban, Plus, Tag, Target, X } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useIsPhone } from '@/components/ui/picker';
import { ChipStrip, FormGroup, FormLabel, Segmented, stripChip } from '@/components/ui/form-rows';
import { DatePicker, TimePicker } from '@/components/ui/date-time';
import { Checkbox } from '@/components/ui/controls';
import { TagInput } from '@/components/ui/tag-input';
import { RepeatChip } from '@/components/common/RepeatChip';
import { categoryOptions, priorityOptions, projectOptions, statusOptions } from '@/components/common/options';
import { confirm } from '@/components/common/ConfirmDialog';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { addDaysKey, minutesToTime, timeToMinutes, todayKey } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { Subtask, Task } from '@/types';
import { ReminderSelect } from '@/features/reminders/ReminderSelect';
import { useSmartTitle } from '@/features/capture/useSmartTitle';
import { SmartTitleHint } from '@/features/capture/SmartTitleHint';
import { canAutoFocus } from '@/lib/utils/pointer';
import { weekendKey } from '@/features/capture/dates';
import { tint, colorOf } from '@/lib/utils/colors';
import { CategoryMark } from '@/components/common/CategoryMark';
import { PRIORITY_COLOR } from '@/components/common/options';

const FORM_ID = 'task-form';

type Draft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;

function toDraft(task: Task | undefined, defaults: Partial<Task> | undefined): Draft {
  const base: Draft = { title: '', status: 'todo', priority: 'medium', subtasks: [], tags: [] };
  if (task) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = task;
    return { ...base, ...rest };
  }
  return { ...base, ...defaults } as Draft;
}

function validate(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.title.trim()) errors.title = 'Вкажіть назву задачі.';
  if (d.endTime && !d.startTime) errors.time = 'Вкажіть також час початку.';
  if (d.startTime && d.endTime && timeToMinutes(d.endTime) <= timeToMinutes(d.startTime)) errors.time = 'Час завершення має бути пізніше за початок.';
  if ((d.startTime || d.recurrence) && !d.dueDate && !d.startDate) errors.dueDate = 'Оберіть дату для запланованої чи повторюваної задачі.';
  if (d.startDate && d.dueDate && d.startDate > d.dueDate) errors.startDate = 'Дата початку не може бути пізніше за термін.';
  return errors;
}

let subtaskSeq = 0;
const newSubtaskId = () => `st_${Date.now().toString(36)}${(subtaskSeq++).toString(36)}`;

export default function TaskFormDialog({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const { categories, projects, goals, tasks } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(toDraft(task, defaults), onClose);
  const phone = useIsPhone();
  const [showErrors, setShowErrors] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [showMore, setShowMore] = useState(!!(task && (task.startDate || task.notes || task.tags.length || task.goalId)));
  const subtaskInput = useRef<HTMLInputElement>(null);
  // New tasks: «Звіт у пʼятницю о 15 #робота» in the title fills the fields (on leaving the title or saving).
  const [smartOff, setSmartOff] = useState(!!task);
  const [undo, setUndo] = useState<Draft | null>(null);
  const smart = useSmartTitle(smartOff ? '' : draft.title);
  const withSmart = (d: Draft): Draft => (smart.found ? { ...d, ...smart.task(d) } : d);
  const applySmart = () => {
    if (!smart.found) return;
    setUndo(draft);
    patch(smart.task(draft));
  };
  const revertSmart = () => {
    if (undo) patch(undo);
    setUndo(null);
    setSmartOff(true);
  };
  const errors = validate(draft);
  const visible = showErrors ? errors : {};
  const firstError = Object.values(visible)[0];
  const allTags = [...new Set(tasks.flatMap((t) => t.tags))];

  const requestClose = async () => {
    if (
      !dirty ||
      (await confirm({ title: 'Скасувати зміни?', description: 'Ваші зміни в задачі буде втрачено.', confirmLabel: 'Скасувати зміни', danger: true }))
    )
      onClose();
  };

  const addSubtask = () => {
    const title = newSubtask.trim();
    if (!title) return;
    const list: Subtask[] = [...draft.subtasks, { id: newSubtaskId(), title, done: false, order: draft.subtasks.length }];
    patch({ subtasks: list });
    setNewSubtask('');
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    const final = withSmart(draft);
    if (smart.found) applySmart();
    if (Object.keys(validate(final)).length) return;
    const pending = newSubtask.trim();
    const subtasks = pending ? [...final.subtasks, { id: newSubtaskId(), title: pending, done: false, order: final.subtasks.length }] : final.subtasks;
    const clean: Draft = {
      ...final,
      title: final.title.trim(),
      description: final.description?.trim() || undefined,
      notes: final.notes?.trim() || undefined,
      subtasks: subtasks.filter((s) => s.title.trim()).map((s, i) => ({ ...s, order: i })),
      completedAt: final.status === 'completed' ? (final.completedAt ?? new Date().toISOString()) : undefined,
    };
    if (task) void submit(() => actions.tasks.update(task.id, clean), 'Задачу оновлено');
    else void submit(() => actions.tasks.create(clean).write, 'Задачу створено');
  };

  return (
    <Dialog open onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent
        quietTitle
        title={task ? 'Редагувати задачу' : 'Нова задача'}
        size="lg"
        preventDismiss={dirty}
        onDismissBlocked={() => void requestClose()}
        phoneBar={{
          onCancel: () => void requestClose(),
          submit: (
            <Button type="submit" form={FORM_ID} variant="dark" size="lg" loading={saving} className="h-10 px-5">
              {task ? 'Зберегти' : 'Додати'}
            </Button>
          ),
        }}
      >
        <form id={FORM_ID} onSubmit={onSubmit} noValidate>
          <input
            autoComplete="off"
            autoFocus={canAutoFocus()}
            aria-label="Назва"
            aria-invalid={visible.title ? true : undefined}
            placeholder="Що потрібно зробити…"
            value={draft.title}
            maxLength={300}
            onChange={(e) => patch({ title: e.target.value })}
            onBlur={applySmart}
            className="w-full bg-transparent text-[21px] font-semibold tracking-tight text-ink outline-hidden placeholder:text-subtle focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <SmartTitleHint summary={smart.summary} found={smart.found} applied={!!undo} onApply={applySmart} onRevert={revertSmart} />
          {phone ? (
            <>
              <Textarea
                aria-label="Опис"
                rows={1}
                placeholder="Додайте опис…"
                value={draft.description ?? ''}
                onChange={(e) => patch({ description: e.target.value })}
                className="mt-1 min-h-[44px] resize-none rounded-none bg-transparent px-0 py-2 text-[16px] text-muted shadow-none hover:bg-transparent focus:shadow-none backdrop-filter-none"
              />

              {/* The question people answer first: when. */}
              <ChipStrip label="Коли" className="mt-3">
                {(
                  [
                    ['Сьогодні', todayKey()],
                    ['Завтра', addDaysKey(todayKey(), 1)],
                    ['На вихідних', weekendKey(todayKey())],
                    ['Без дати', undefined],
                  ] as const
                ).map(([label, day]) => {
                  const on = label === 'Без дати' ? !draft.dueDate : draft.dueDate === day && !(label === 'На вихідних' && day === todayKey());
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => patch({ dueDate: day })}
                      className={cn(stripChip, on ? 'border-transparent bg-accent text-surface' : 'border-line bg-surface text-ink')}
                    >
                      {label}
                    </button>
                  );
                })}
              </ChipStrip>

              <FormGroup className="mt-4" label="Дата й час">
                <DatePicker
                  variant="row"
                  label="Дата"
                  aria-label="Термін"
                  aria-invalid={visible.dueDate ? true : undefined}
                  placeholder="Без дати"
                  value={draft.dueDate}
                  weekStartsOn={settings.weekStartsOn}
                  onChange={(dueDate) => patch({ dueDate })}
                />
                <TimePicker
                  variant="row"
                  label="Час"
                  aria-label="Час початку"
                  aria-invalid={visible.time ? true : undefined}
                  placeholder="Час"
                  clearable
                  timeFormat={settings.timeFormat}
                  value={draft.startTime}
                  onChange={(startTime) =>
                    patch(
                      startTime
                        ? {
                            startTime,
                            endTime:
                              draft.endTime && draft.startTime
                                ? minutesToTime(
                                    Math.min(timeToMinutes(startTime) + timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime), 23 * 60 + 59),
                                  )
                                : draft.endTime,
                          }
                        : { startTime: undefined, endTime: undefined },
                    )
                  }
                />
                {draft.startTime && (
                  <TimePicker
                    variant="row"
                    label="До"
                    aria-label="Час завершення"
                    placeholder="До"
                    clearable
                    clearLabel="Без завершення"
                    after={draft.startTime}
                    timeFormat={settings.timeFormat}
                    value={draft.endTime}
                    onChange={(endTime) => patch({ endTime })}
                  />
                )}
                <RepeatChip
                  variant="row"
                  value={draft.recurrence}
                  startDate={draft.dueDate ?? draft.startDate}
                  onChange={(recurrence) => patch({ recurrence })}
                />
                <ReminderSelect
                  variant="row"
                  value={draft.remindMin}
                  onChange={(remindMin) => patch({ remindMin })}
                  fallback={settings.remindTasks && draft.startTime ? 'на початку' : 'вимкнено'}
                />
              </FormGroup>

              <FormLabel>Важливість</FormLabel>
              <Segmented
                label="Пріоритет"
                value={draft.priority}
                onChange={(priority) => patch({ priority })}
                options={[...priorityOptions].map((o) => ({ value: o.value, label: o.label, color: PRIORITY_COLOR[o.value] }))}
              />

              {categories.length > 0 && (
                <>
                  <FormLabel>Категорія</FormLabel>
                  <ChipStrip label="Категорія">
                    {categories.map((c) => {
                      const on = draft.categoryId === c.id;
                      const color = colorOf(c.color);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => patch({ categoryId: on ? undefined : c.id })}
                          className={cn(stripChip, on ? 'text-ink' : 'border-line bg-surface text-muted')}
                          style={on ? { backgroundColor: tint(color, 0.16), borderColor: tint(color, 0.5) } : undefined}
                        >
                          <CategoryMark category={c} />
                          {c.name}
                        </button>
                      );
                    })}
                  </ChipStrip>
                </>
              )}

              {(projects.some((p) => p.status !== 'archived') || draft.projectId) && (
                <FormGroup className="mt-4" label="Проєкт">
                  <Select
                    variant="row"
                    label="Проєкт"
                    aria-label="Проєкт"
                    icon={<FolderKanban />}
                    placeholder="Проєкт"
                    value={draft.projectId ?? ''}
                    onChange={(v) => patch({ projectId: v || undefined })}
                    options={projectOptions(projects, draft.projectId)}
                  />
                </FormGroup>
              )}
              {task && (
                <FormGroup className="mt-4" label="Статус">
                  <Select
                    variant="row"
                    label="Статус"
                    aria-label="Статус"
                    value={draft.status}
                    onChange={(status) => patch({ status })}
                    options={statusOptions}
                  />
                </FormGroup>
              )}
            </>
          ) : (
            <>
              <Textarea
                aria-label="Опис"
                rows={2}
                placeholder="Додайте опис…"
                value={draft.description ?? ''}
                onChange={(e) => patch({ description: e.target.value })}
                className="mt-1 min-h-0 resize-none rounded-none bg-transparent px-0 text-[14px] text-muted shadow-none hover:bg-transparent focus:shadow-none backdrop-filter-none"
              />

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <DatePicker
                  variant="chip"
                  aria-label="Термін"
                  aria-invalid={visible.dueDate ? true : undefined}
                  placeholder="Термін"
                  value={draft.dueDate}
                  weekStartsOn={settings.weekStartsOn}
                  onChange={(dueDate) => patch({ dueDate })}
                />
                <TimePicker
                  variant="chip"
                  aria-label="Час початку"
                  aria-invalid={visible.time ? true : undefined}
                  placeholder="Час"
                  clearable
                  timeFormat={settings.timeFormat}
                  value={draft.startTime}
                  onChange={(startTime) =>
                    patch(
                      startTime
                        ? {
                            startTime,
                            endTime:
                              draft.endTime && draft.startTime
                                ? minutesToTime(
                                    Math.min(timeToMinutes(startTime) + timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime), 23 * 60 + 59),
                                  )
                                : draft.endTime,
                          }
                        : { startTime: undefined, endTime: undefined },
                    )
                  }
                />
                {draft.startTime && (
                  <TimePicker
                    variant="chip"
                    aria-label="Час завершення"
                    placeholder="До"
                    clearable
                    after={draft.startTime}
                    timeFormat={settings.timeFormat}
                    value={draft.endTime}
                    onChange={(endTime) => patch({ endTime })}
                  />
                )}
                <Select
                  variant="chip"
                  aria-label="Пріоритет"
                  icon={<Flag />}
                  value={draft.priority}
                  onChange={(priority) => patch({ priority })}
                  options={priorityOptions}
                />
                <ReminderSelect
                  value={draft.remindMin}
                  onChange={(remindMin) => patch({ remindMin })}
                  fallback={settings.remindTasks && draft.startTime ? 'на початку' : 'вимкнено'}
                />
                <Select
                  variant="chip"
                  aria-label="Категорія"
                  icon={<Tag />}
                  placeholder="Категорія"
                  value={draft.categoryId ?? (task ? '' : undefined)}
                  onChange={(v) => patch({ categoryId: v || undefined })}
                  options={categoryOptions(categories)}
                />
                <Select
                  variant="chip"
                  aria-label="Проєкт"
                  icon={<FolderKanban />}
                  placeholder="Проєкт"
                  value={draft.projectId ?? (task ? '' : undefined)}
                  onChange={(v) => patch({ projectId: v || undefined })}
                  options={projectOptions(projects, draft.projectId)}
                />
                <RepeatChip value={draft.recurrence} startDate={draft.dueDate ?? draft.startDate} onChange={(recurrence) => patch({ recurrence })} />
                {task && <Select variant="chip" aria-label="Статус" value={draft.status} onChange={(status) => patch({ status })} options={statusOptions} />}
              </div>
            </>
          )}

          {firstError && (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {firstError}
            </p>
          )}

          <section className="mt-6">
            <h3 className={cn('mb-2 text-[13px] font-semibold text-ink', phone && 'px-1 text-muted')}>Підзадачі</h3>
            {draft.subtasks.length > 0 && (
              <ul className="mb-1">
                {draft.subtasks.map((s, i) => (
                  <li key={s.id} className={cn('group flex items-center gap-3 rounded-lg py-1.5 pr-1', phone && 'min-h-11')}>
                    <Checkbox
                      checked={s.done}
                      label={`Виконано: ${s.title}`}
                      onChange={() => patch({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                    />
                    <input
                      autoComplete="off"
                      className={cn('min-w-0 flex-1 bg-transparent text-sm outline-hidden', s.done && 'text-subtle line-through')}
                      value={s.title}
                      aria-label={`Підзадача ${i + 1}`}
                      onChange={(e) => patch({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })}
                    />
                    <button
                      type="button"
                      aria-label="Видалити підзадачу"
                      className="rounded-md p-1 text-subtle opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      onClick={() => patch({ subtasks: draft.subtasks.filter((x) => x.id !== s.id) })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-3 py-1.5">
              <button
                type="button"
                aria-label="Додати підзадачу"
                onClick={() => (newSubtask.trim() ? addSubtask() : subtaskInput.current?.focus())}
                className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-subtle hover:text-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
              <input
                autoComplete="off"
                ref={subtaskInput}
                placeholder="Додати підзадачу…"
                value={newSubtask}
                aria-label="Нова підзадача"
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-sm outline-hidden placeholder:text-subtle"
              />
            </div>
          </section>

          {!showMore ? (
            phone ? (
              <FormGroup className="mt-5">
                <button
                  type="button"
                  onClick={() => setShowMore(true)}
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left text-[15px] text-muted transition-colors hover:bg-line/30"
                >
                  <Plus className="h-[19px] w-[19px] shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">Дата початку, ціль, теги, нотатки</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                </button>
              </FormGroup>
            ) : (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"
              >
                Дата початку, ціль, теги, нотатки
              </button>
            )
          ) : (
            <div className={cn('space-y-4', phone ? 'mt-5' : 'mt-6')}>
              {phone ? (
                <FormGroup label="Ще">
                  <DatePicker
                    variant="row"
                    label="Дата початку"
                    aria-label="Дата початку"
                    aria-invalid={visible.startDate ? true : undefined}
                    placeholder="Без дати"
                    value={draft.startDate}
                    weekStartsOn={settings.weekStartsOn}
                    onChange={(startDate) => patch({ startDate })}
                  />
                  {goals.length > 0 && (
                    <Select
                      variant="row"
                      label="Ціль"
                      aria-label="Ціль"
                      icon={<Target />}
                      value={draft.goalId ?? ''}
                      onChange={(v) => patch({ goalId: v || undefined })}
                      options={[{ value: '', label: 'Без цілі' }, ...goals.map((g) => ({ value: g.id, label: g.title }))]}
                    />
                  )}
                </FormGroup>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Дата початку" error={visible.startDate} hint="Коли плануєте почати роботу.">
                    {(p) => <DatePicker {...p} value={draft.startDate} weekStartsOn={settings.weekStartsOn} onChange={(startDate) => patch({ startDate })} />}
                  </Field>
                  {goals.length > 0 && (
                    <Field label="Ціль">
                      {(p) => (
                        <Select
                          {...p}
                          icon={<Target />}
                          value={draft.goalId ?? ''}
                          onChange={(v) => patch({ goalId: v || undefined })}
                          options={[{ value: '', label: 'Без цілі' }, ...goals.map((g) => ({ value: g.id, label: g.title }))]}
                        />
                      )}
                    </Field>
                  )}
                </div>
              )}
              <Field label="Теги">{(p) => <TagInput id={p.id} value={draft.tags} suggestions={allTags} onChange={(tags) => patch({ tags })} />}</Field>
              <Field label="Нотатки">
                {(p) => (
                  <Textarea
                    {...p}
                    rows={3}
                    placeholder="Посилання, контекст, думки…"
                    value={draft.notes ?? ''}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                )}
              </Field>
            </div>
          )}

          {submitError && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          )}

          <DialogFooter className="max-sm:hidden">
            <Button variant="ghost" onClick={() => void requestClose()} disabled={saving}>
              Скасувати
            </Button>
            <Button type="submit" variant="dark" loading={saving}>
              {task ? 'Зберегти' : 'Створити задачу'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
