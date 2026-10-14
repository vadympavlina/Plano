import { useRef, useState, type FormEvent } from 'react';
import { Flag, FolderKanban, Plus, Tag, Target, X } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DatePicker, TimePicker } from '@/components/ui/date-time';
import { Checkbox } from '@/components/ui/controls';
import { TagInput } from '@/components/ui/tag-input';
import { RepeatChip } from '@/components/common/RepeatChip';
import { categoryOptions, priorityOptions, projectOptions, statusOptions } from '@/components/common/options';
import { confirm } from '@/components/common/ConfirmDialog';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useFormDialog } from '@/hooks/useFormDialog';
import { minutesToTime, timeToMinutes } from '@/lib/date';
import { cn } from '@/lib/utils/cn';
import type { Subtask, Task } from '@/types';

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
  if (d.startTime && d.endTime && timeToMinutes(d.endTime) <= timeToMinutes(d.startTime))
    errors.time = 'Час завершення має бути пізніше за початок.';
  if ((d.startTime || d.recurrence) && !d.dueDate && !d.startDate) errors.dueDate = 'Оберіть дату для запланованої чи повторюваної задачі.';
  if (d.startDate && d.dueDate && d.startDate > d.dueDate) errors.startDate = 'Дата початку не може бути пізніше за термін.';
  return errors;
}

let subtaskSeq = 0;
const newSubtaskId = () => `st_${Date.now().toString(36)}${(subtaskSeq++).toString(36)}`;

export default function TaskFormDialog({
  task,
  defaults,
  onClose,
}: {
  task?: Task;
  defaults?: Partial<Task>;
  onClose: () => void;
}) {
  const { categories, projects, goals, tasks } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const { draft, patch, dirty, saving, submitError, submit } = useFormDialog<Draft>(toDraft(task, defaults), onClose);
  const [showErrors, setShowErrors] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [showMore, setShowMore] = useState(!!(task && (task.startDate || task.notes || task.tags.length || task.goalId)));
  const subtaskInput = useRef<HTMLInputElement>(null);
  const errors = validate(draft);
  const visible = showErrors ? errors : {};
  const firstError = Object.values(visible)[0];
  const allTags = [...new Set(tasks.flatMap((t) => t.tags))];

  const requestClose = async () => {
    if (!dirty || (await confirm({ title: 'Скасувати зміни?', description: 'Ваші зміни в задачі буде втрачено.', confirmLabel: 'Скасувати зміни', danger: true })))
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
    if (Object.keys(errors).length) return;
    const pending = newSubtask.trim();
    const subtasks = pending ? [...draft.subtasks, { id: newSubtaskId(), title: pending, done: false, order: draft.subtasks.length }] : draft.subtasks;
    const clean: Draft = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      subtasks: subtasks.filter((s) => s.title.trim()).map((s, i) => ({ ...s, order: i })),
      completedAt: draft.status === 'completed' ? (draft.completedAt ?? new Date().toISOString()) : undefined,
    };
    if (task) void submit(() => actions.tasks.update(task.id, clean), 'Задачу оновлено');
    else void submit(() => actions.tasks.create(clean).write, 'Задачу створено');
  };

  return (
    <Dialog open onOpenChange={(open) => !open && void requestClose()}>
      <DialogContent quietTitle title={task ? 'Редагувати задачу' : 'Нова задача'} size="lg" preventDismiss={dirty} onDismissBlocked={() => void requestClose()}>
        <form onSubmit={onSubmit} noValidate>
          <input
            autoFocus
            aria-label="Назва"
            aria-invalid={visible.title ? true : undefined}
            placeholder="Що потрібно зробити?"
            value={draft.title}
            maxLength={300}
            onChange={(e) => patch({ title: e.target.value })}
            className="w-full bg-transparent text-[21px] font-semibold tracking-tight text-ink outline-none placeholder:text-subtle/80 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Textarea
            aria-label="Опис"
            rows={2}
            placeholder="Додайте опис"
            value={draft.description ?? ''}
            onChange={(e) => patch({ description: e.target.value })}
            className="mt-1 min-h-0 resize-none border-0 px-0 text-[14px] text-muted shadow-none hover:border-0 focus:ring-0"
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
                            ? minutesToTime(Math.min(timeToMinutes(startTime) + timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime), 23 * 60 + 59))
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
            {task && (
              <Select variant="chip" aria-label="Статус" value={draft.status} onChange={(status) => patch({ status })} options={statusOptions} />
            )}
          </div>

          {firstError && (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {firstError}
            </p>
          )}

          <section className="mt-6">
            <h3 className="mb-2 text-[13px] font-semibold text-ink">Підзадачі</h3>
            {draft.subtasks.length > 0 && (
              <ul className="mb-1">
                {draft.subtasks.map((s, i) => (
                  <li key={s.id} className="group flex items-center gap-3 rounded-lg py-1.5 pr-1">
                    <Checkbox
                      checked={s.done}
                      label={`Виконано: ${s.title}`}
                      onChange={() => patch({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                    />
                    <input
                      className={cn('min-w-0 flex-1 bg-transparent text-sm outline-none', s.done && 'text-subtle line-through')}
                      value={s.title}
                      aria-label={`Підзадача ${i + 1}`}
                      onChange={(e) => patch({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })}
                    />
                    <button
                      type="button"
                      aria-label="Видалити підзадачу"
                      className="rounded-md p-1 text-subtle opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                      onClick={() => patch({ subtasks: draft.subtasks.filter((x) => x.id !== s.id) })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-3 py-1.5">
              <button type="button" aria-label="Додати підзадачу" onClick={() => (newSubtask.trim() ? addSubtask() : subtaskInput.current?.focus())} className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-subtle hover:text-ink">
                <Plus className="h-4 w-4" />
              </button>
              <input
                ref={subtaskInput}
                placeholder="Додати підзадачу"
                value={newSubtask}
                aria-label="Нова підзадача"
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              />
            </div>
          </section>

          {!showMore ? (
            <button type="button" onClick={() => setShowMore(true)} className="mt-4 text-[13px] font-medium text-primary hover:underline">
              Дата початку, ціль, теги, нотатки
            </button>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Теги">
                {(p) => <TagInput id={p.id} value={draft.tags} suggestions={allTags} onChange={(tags) => patch({ tags })} />}
              </Field>
              <Field label="Нотатки">
                {(p) => <Textarea {...p} rows={3} placeholder="Посилання, контекст, думки…" value={draft.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} />}
              </Field>
            </div>
          )}

          {submitError && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          )}

          <DialogFooter>
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
