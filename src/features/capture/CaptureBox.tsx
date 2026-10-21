import { useRef, type FormEvent, type ReactNode } from 'react';
import { AlignLeft, ArrowLeftRight, Bell, HelpCircle, ListChecks, ListPlus, CalendarDays, CalendarPlus, CheckSquare, Clock, Flag, FolderKanban, Hash, Mic, NotebookPen, Plus, Repeat, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-time';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { CategoryIcon } from '@/components/common/CategoryMark';
import { toast } from '@/components/ui/toast';
import { useDictation } from '@/hooks/useDictation';
import { CreateMenu } from '@/components/layout/CreateMenu';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { plural } from '@/lib/date';
import { SmartField, type SmartFieldHandle } from './SmartField';
import { useCapture, type CaptureChip, type CaptureKind } from './useCapture';

const KIND_ICON = { task: CheckSquare, event: CalendarPlus, note: NotebookPen };
const CHIP_ICON: Partial<Record<CaptureChip['type'], typeof Clock>> = { date: CalendarDays, time: Clock, repeat: Repeat, priority: Flag, reminder: Bell, project: FolderKanban, tag: Hash, note: AlignLeft, subtasks: ListChecks };
const EXAMPLES: [string, string][] = [
  ['Коли', 'завтра, у пʼятницю, наступного вівторка, через 3 дні, 5 листопада, 25.10, до кінця тижня'],
  ['Час', 'о 15, о 9:30, о 7 вечора, ввечері, з 10 до 12, на годину, через 30 хв, цілий день'],
  ['Повтор', 'щодня, по буднях, щопонеділка та пʼятниці, кожні 3 дні, кожного 5 числа, щодня до 31 грудня'],
  ['Куди', '#категорія або #проєкт, @проєкт'],
  ['Ще', '!! важливо, !!! терміново, нагадай за 30 хв, // опис, «Купити: молоко, хліб» — підзадачі'],
  ['Кілька', 'вставте список — кожен рядок стане окремим записом'],
];

function Help() {
  return (
    <Popover>
      <PopoverTrigger className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-ink" aria-label="Що можна писати">
        <HelpCircle className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-3">
        <p className="mb-2 text-[13px] font-semibold">Пишіть як звичайно — Plano зрозуміє</p>
        <dl className="space-y-1.5 text-[12.5px]">
          {EXAMPLES.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[64px_1fr] gap-2">
              <dt className="font-medium text-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

const chip = 'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold transition-colors';

/**
 * The quick-capture box: a smart field that reads dates, times, repeats and
 * #categories from the text, chips for what it understood, voice input.
 * `sheet` is the bigger version opened by «+» / N.
 */
export function CaptureBox({ sheet, onDone, className }: { sheet?: boolean; onDone?: () => void; className?: string }) {
  const c = useCapture();
  const field = useRef<SmartFieldHandle>(null);
  const before = useRef('');
  const voice = useDictation(
    (t) => c.setText(`${before.current} ${t}`.trim()),
    (err) => toast.error(err === 'not-allowed' || err === 'service-not-allowed' ? 'Немає доступу до мікрофона' : 'Не вдалося розпізнати мову'),
  );
  const toggleVoice = () => {
    if (voice.listening) return voice.stop();
    before.current = c.text.trim();
    voice.start();
  };
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (await c.save()) {
      if (sheet) onDone?.();
      else field.current?.focus();
    }
  };
  /** Suggestion buttons append words, so the field stays the one source of truth. */
  const append = (words: string) => {
    // «о » and «#» wait for more typing; whole words get a space after them.
    c.setText(`${c.text.trimEnd()} ${words}${/[\s#]$/.test(words) ? '' : ' '}`.trimStart());
    requestAnimationFrame(() => field.current?.focus());
  };
  const KindIcon = KIND_ICON[c.kind];
  const empty = !c.text.trim();

  // The first date is the picker chip; a range's end («по 30 жовт») stays a chip.
  const chips = c.chips.filter((x) => x.type !== 'kind' && !(x.type === 'date' && !x.label.startsWith('по ')));
  const row = c.lines ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn(chip, 'bg-primary/10 text-primary')}>
        <ListPlus className="h-3.5 w-3.5" /> {c.lines} {plural(c.lines, ['запис', 'записи', 'записів'])} — кожен рядок окремо
      </span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-1.5">
      {!empty && (
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(chip, 'bg-surface-2 text-ink hover:bg-line/60')} aria-label="Тип">
            <ArrowLeftRight className="h-3.5 w-3.5 text-muted" />
            <KindIcon className="h-3.5 w-3.5" />
            {c.kind === 'event' ? 'Подія' : c.kind === 'note' ? 'Нотатка' : 'Задача'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(['task', 'event', 'note'] as CaptureKind[]).map((k) => {
              const I = KIND_ICON[k];
              return (
                <DropdownMenuItem key={k} icon={<I />} onSelect={() => c.setKind(k)}>
                  {k === 'task' ? 'Задача' : k === 'event' ? 'Подія' : 'Нотатка'}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {c.kind !== 'note' && (!empty || !sheet) && (
        <DatePicker variant="chip" aria-label="Дата" placeholder="Дата" value={c.date} onChange={c.setDate} className="h-8" />
      )}
      {chips.map((x) => {
        const I = CHIP_ICON[x.type];
        const color = x.category ? colorOf(x.category.color) : x.project ? colorOf(x.project.color) : undefined;
        return (
          <span key={x.key} className={cn(chip, 'pr-1.5', color ? '' : 'bg-primary/10 text-primary')} style={color ? { backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`, color } : undefined}>
            {x.category ? <CategoryIcon category={x.category} /> : I && <I className="h-3.5 w-3.5" />}
            <span className="max-w-[180px] truncate">{x.label}</span>
            {x.spans.length > 0 && (
              <button type="button" aria-label={`Прибрати «${x.label}»`} onClick={() => c.removeChip(x)} className="rounded p-0.5 opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      })}
      {c.suggested && (
        <button
          type="button"
          onClick={c.acceptSuggestion}
          title="Як минулого разу"
          className={cn(chip, 'border border-dashed border-line text-muted hover:text-ink')}
          style={{ color: colorOf(c.suggested.color) }}
        >
          <CategoryIcon category={c.suggested} /> {c.suggested.name}?
        </button>
      )}
    </div>
  );

  const suggestions = sheet && (
    <div className="flex flex-wrap gap-1.5">
      {[
        [Sun, 'Сьогодні', 'сьогодні'],
        [CalendarDays, 'Завтра', 'завтра'],
        [CalendarDays, 'На вихідних', 'на вихідних'],
        [Clock, '+ Час', 'о '],
        [Repeat, 'Щодня', 'щодня'],
        [Hash, 'Категорія', '#'],
        [Flag, 'Важливо', '!!'],
      ].map(([I, label, words]) => {
        const Icon = I as typeof Sun;
        return (
          <button key={label as string} type="button" onClick={() => append(words as string)} className={cn(chip, 'h-9 bg-surface-2 text-ink hover:bg-line/60')}>
            <Icon className="h-3.5 w-3.5 text-muted" /> {label as string}
          </button>
        );
      })}
    </div>
  );

  const mic: ReactNode = voice.supported && (
    <button
      type="button"
      onClick={toggleVoice}
      aria-pressed={voice.listening}
      aria-label={voice.listening ? 'Зупинити диктування' : 'Надиктувати'}
      title={voice.listening ? 'Слухаю… натисніть, щоб зупинити' : 'Надиктувати'}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full transition-colors',
        sheet ? 'h-12 w-12 bg-surface-2' : 'h-9 w-9',
        voice.listening ? 'bg-danger text-white' : 'text-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      {voice.listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" aria-hidden />}
      <Mic className={cn('relative', sheet ? 'h-5 w-5' : 'h-4 w-4')} />
    </button>
  );

  const fieldEl = (
    <SmartField
      ref={field}
      value={c.text}
      onChange={c.setText}
      spans={c.spans}
      onSubmit={() => void submit()}
      categories={c.categories}
      projects={c.projects}
      big={sheet}
      autoFocus={sheet}
      placeholder={sheet ? 'Що додати?' : 'Додати… напр. «Зустріч завтра о 15 #робота»'}
    />
  );

  if (sheet)
    return (
      <form onSubmit={submit} className={cn('space-y-3', className)}>
        {fieldEl}
        {empty ? suggestions : row}
        <div className="flex items-center gap-2 pt-1">
          {mic}
          <Help />
          <CreateMenu
            align="center"
            onPick={onDone}
            trigger={
              <button type="button" className="ml-auto rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink">
                Повна форма…
              </button>
            }
          />
          <Button type="submit" variant="dark" className="h-11 px-6 text-[15px]" loading={c.busy} disabled={empty}>
            Додати
          </Button>
        </div>
      </form>
    );

  return (
    <form onSubmit={submit} className={cn('card p-2 transition-colors focus-within:border-subtle/60', className)}>
      <div className="flex items-start gap-2 pl-2">
        <Plus className="mt-[13px] h-4 w-4 shrink-0 text-subtle" aria-hidden />
        {fieldEl}
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <span className="hidden sm:inline-flex">
            <Help />
          </span>
          {mic}
          <Button type="submit" variant="dark" size="sm" className="h-9 px-4" loading={c.busy} disabled={empty}>
            Додати
          </Button>
        </div>
      </div>
      {!empty && <div className="pb-1 pl-8 pt-1">{row}</div>}
    </form>
  );
}
