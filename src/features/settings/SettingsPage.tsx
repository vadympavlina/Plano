import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bell, Check, Database, Download, Monitor, Moon, Palette, Pencil, Plug, Plus, Search, SlidersHorizontal, Sun, Tags, Trash2, Upload, UserRound } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge, Segmented } from '@/components/ui/misc';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ColorPicker } from '@/components/ui/color-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { Avatar } from '@/components/layout/Avatar';
import { useSyncSummary } from '@/components/layout/SyncIndicator';
import { useData } from '@/app/providers/DataProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { useActions } from '@/hooks/useActions';
import { useCollections } from '@/hooks/useCollections';
import { useProfile } from '@/hooks/useProfile';
import { settleWrite } from '@/services/sync';
import { updateAuthProfile } from '@/services/auth';
import { GoogleCalendarSettings } from '@/features/integrations/GoogleCalendarSettings';
import { backupNow, fetchBackup, listBackups, type BackupMeta } from '@/services/backup';
import { clearErrors, listErrors } from '@/services/errors';
import { usesTokenServer } from '@/services/integrations/google/server';
import { disablePush, enablePush, needsHomeScreen, pushEnabledHere, pushSupported, sendTestPush } from '@/services/push';
import { deviceTimeZone, formatDateKey, plural, todayKey } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { AccentColor, Category, Settings, ThemePreference } from '@/types';
import { buildExport, validateImport, type ImportResult } from './dataTransfer';

const SECTIONS = [
  { id: 'profile', label: 'Профіль', icon: UserRound },
  { id: 'appearance', label: 'Вигляд', icon: Palette },
  { id: 'preferences', label: 'Параметри', icon: SlidersHorizontal },
  { id: 'categories', label: 'Категорії', icon: Tags },
  { id: 'notifications', label: 'Сповіщення', icon: Bell },
  { id: 'integrations', label: 'Інтеграції', icon: Plug },
  { id: 'data', label: 'Дані', icon: Database },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const SUMMARY_LABEL: Record<string, string> = {
  categories: 'Категорії',
  tasks: 'Задачі',
  events: 'Події',
  projects: 'Проєкти',
  habits: 'Звички',
  goals: 'Цілі',
  notes: 'Нотатки',
};

const panel = 'rounded-[20px] border border-line/60 bg-surface shadow-soft';

/** Current search text; empty means "show everything". */
const SearchCtx = createContext('');
const norm = (v: string) => v.toLocaleLowerCase('uk-UA');
const matches = (q: string, ...parts: (string | undefined)[]) => !q || parts.some((p) => p && norm(p).includes(q));

/** One setting: label (and hint) on the left, control on the right. Hidden when it doesn't match the search. */
function Row({ label, hint, keywords, children }: { label: ReactNode; hint?: string; keywords?: string; children?: ReactNode }) {
  const q = useContext(SearchCtx);
  if (!matches(q, typeof label === 'string' ? label : '', hint, keywords)) return null;
  return (
    <div className="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-ink">{label}</div>
        {hint && <p className="mt-0.5 text-[12.5px] text-muted">{hint}</p>}
      </div>
      {children !== undefined && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** A titled group of rows. `keywords` lists the row labels so the group survives a search for any of them. */
function Group({
  id,
  title,
  description,
  keywords,
  footer,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  keywords: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const q = useContext(SearchCtx);
  const whole = matches(q, title, description);
  if (!whole && !matches(q, keywords)) return null;
  return (
    <section id={`settings-${id}`} data-section={id} className="mb-7 scroll-mt-6">
      <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-subtle">{title}</h2>
      {description && <p className="-mt-1 mb-2.5 px-1 text-[12.5px] text-muted">{description}</p>}
      {/* A match on the group itself shows all of its rows. */}
      <SearchCtx.Provider value={whole ? '' : q}>
        <div className={cn(panel, 'divide-y divide-line/70')}>{children}</div>
      </SearchCtx.Provider>
      {footer}
    </section>
  );
}

function ProfileCard() {
  const { data, repos, backendKind } = useData();
  const profile = useProfile();
  const sync = useSyncSummary();
  const { state } = useAuth();
  const q = useContext(SearchCtx);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.profile.displayName ?? profile.name);
  const [avatar, setAvatar] = useState(data.profile.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const avatarError = avatar && !/^https:\/\/\S+$/i.test(avatar) ? 'Вкажіть посилання на зображення, що починається з https://' : undefined;
  const user = state.status === 'signedIn' ? state.user : null;
  if (!matches(q, 'профіль', 'ім’я', 'аватар', 'акаунт', 'пошта')) return null;

  const save = async () => {
    if (avatarError) return;
    setBusy(true);
    try {
      await settleWrite(repos.profile.update({ displayName: name.trim() || undefined, avatarUrl: avatar.trim() || undefined }));
      if (backendKind === 'firebase') await updateAuthProfile({ displayName: name.trim() || null }).catch(() => undefined);
      toast.success('Профіль збережено');
      setEditing(false);
    } catch {
      /* toast from sync layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="settings-profile" data-section="profile" className={cn(panel, 'mb-7 scroll-mt-6 p-5')}>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name || profile.name} src={avatar && !avatarError ? avatar : profile.avatarUrl} className="h-14 w-14 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold tracking-tight">{profile.name || 'Ім’я не вказано'}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
            <span className="truncate">{user?.email ?? (backendKind === 'local' ? 'Локальний перегляд (без входу)' : '')}</span>
            {backendKind === 'firebase' && (
              <span className="inline-flex items-center gap-1.5">
                · <span className={cn('h-1.5 w-1.5 rounded-full', sync.tone === 'success' ? 'bg-success' : sync.tone === 'danger' ? 'bg-danger' : sync.tone === 'warning' ? 'bg-warning' : 'bg-subtle')} />
                {sync.label}
              </span>
            )}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" aria-label="Редагувати профіль" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Редагувати</span>
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-5 border-t border-line/70 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ім’я" hint="Використовується у привітаннях.">
              {(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Посилання на аватар" error={avatarError} hint="Необов’язково. Порожнє — фото акаунта.">
              {(p) => <Input {...p} type="url" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} />}
            </Field>
          </div>
          {user && (
            <p className="mt-4 break-all text-xs text-subtle">
              ID користувача: <code className="font-mono">{user.uid}</code>
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setName(data.profile.displayName ?? profile.name);
                setAvatar(data.profile.avatarUrl ?? '');
                setEditing(false);
              }}
            >
              Скасувати
            </Button>
            <Button variant="dark" onClick={() => void save()} loading={busy} disabled={!!avatarError}>
              Зберегти
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

const ACCENTS: [AccentColor, string, string][] = [
  ['blue', 'Синій', '71 120 245'],
  ['violet', 'Фіолетовий', '132 94 247'],
  ['green', 'Зелений', '22 163 110'],
  ['orange', 'Помаранчевий', '232 118 30'],
  ['pink', 'Рожевий', '219 68 133'],
];

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Світла', icon: Sun },
  { value: 'dark', label: 'Темна', icon: Moon },
  { value: 'system', label: 'Системна', icon: Monitor },
];

/** Tiny picture of the app in a theme; "system" is split light/dark. */
function ThemePreview({ theme }: { theme: ThemePreference }) {
  const half = (dark: boolean) => (
    <div className={cn('flex-1 p-2', dark ? 'bg-[#151a2b]' : 'bg-[#eef1f6]')}>
      <div className={cn('h-1.5 w-8 rounded', dark ? 'bg-white/30' : 'bg-[#cfd5df]')} />
      <div className={cn('mt-2 h-5 rounded-md', dark ? 'bg-white/10' : 'bg-white')} />
      <div className={cn('mt-1.5 h-1.5 w-10 rounded', dark ? 'bg-white/15' : 'bg-[#dde2ea]')} />
    </div>
  );
  return <div className="flex h-[68px] overflow-hidden rounded-xl">{theme === 'system' ? [half(false), half(true)] : half(theme === 'dark')}</div>;
}

function AppearanceSection() {
  const { data, repos } = useData();
  return (
    <Group id="appearance" title="Вигляд" keywords="тема світла темна системна колір акцент">
      <Row label="Тема" hint="Системна повторює налаштування пристрою." keywords="світла темна системна">
        <div className="grid grid-cols-3 gap-2 sm:w-[400px]" role="radiogroup" aria-label="Тема">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={data.settings.theme === value}
              onClick={() => void repos.settings.update({ theme: value }).catch(() => undefined)}
              className={cn(
                'rounded-2xl border-2 p-1.5 text-left transition-colors',
                data.settings.theme === value ? 'border-primary' : 'border-line/70 hover:border-line',
              )}
            >
              <ThemePreview theme={value} />
              <span className="mt-1.5 flex items-center gap-1.5 px-1 pb-0.5 text-[12.5px] font-medium">
                <Icon className="h-3.5 w-3.5" /> {label}
              </span>
            </button>
          ))}
        </div>
      </Row>
      <Row label="Акцентний колір" hint="Кнопки, посилання, позначка «сьогодні»." keywords="колір акцент синій фіолетовий зелений помаранчевий рожевий">
        <div className="flex gap-2" role="radiogroup" aria-label="Акцентний колір">
          {ACCENTS.map(([value, label, rgb]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={data.settings.accent === value}
              aria-label={label}
              title={label}
              onClick={() => void repos.settings.update({ accent: value }).catch(() => undefined)}
              className={cn('flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-shadow', data.settings.accent === value ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line')}
              style={{ backgroundColor: `rgb(${rgb})` }}
            >
              {data.settings.accent === value && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </Row>
    </Group>
  );
}

function PreferencesSection() {
  const { data, repos } = useData();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => void repos.settings.update(patch).catch(() => undefined);
  const sample = todayKey();
  return (
    <Group
      id="preferences"
      title="Параметри"
      keywords="початок тижня формат часу дати календар часовий пояс"
      footer={
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-subtle">
          <span>Зберігається автоматично й синхронізується з іншими пристроями.</span>
          <button
            type="button"
            className="font-medium text-muted hover:text-ink"
            onClick={() => set({ weekStartsOn: DEFAULT_SETTINGS.weekStartsOn, timeFormat: DEFAULT_SETTINGS.timeFormat, dateFormat: DEFAULT_SETTINGS.dateFormat, defaultCalendarView: DEFAULT_SETTINGS.defaultCalendarView })}
          >
            Скинути до стандартних
          </button>
        </div>
      }
    >
      <Row label="Початок тижня" hint="Для календаря, звичок і тижневих підсумків.">
        <Segmented
          ariaLabel="Початок тижня"
          value={String(s.weekStartsOn) as '0' | '1'}
          onChange={(v) => set({ weekStartsOn: Number(v) as 0 | 1 })}
          options={[
            { value: '1', label: 'Понеділок' },
            { value: '0', label: 'Неділя' },
          ]}
        />
      </Row>
      <Row label="Формат часу">
        <Segmented
          ariaLabel="Формат часу"
          value={s.timeFormat}
          onChange={(timeFormat) => set({ timeFormat })}
          options={[
            { value: '24h', label: '14:30' },
            { value: '12h', label: '2:30 PM' },
          ]}
        />
      </Row>
      <Row label="Формат дати">
        <Select
          aria-label="Формат дати"
          className="w-[200px]"
          value={s.dateFormat}
          onChange={(dateFormat) => set({ dateFormat })}
          options={(['d MMMM yyyy', 'd MMM yyyy', 'dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] as const).map((f) => ({ value: f, label: formatDateKey(sample, f) }))}
        />
      </Row>
      <Row label="Календар відкривається" hint="На телефоні тиждень показується як день.">
        <Segmented
          ariaLabel="Вигляд календаря за замовчуванням"
          value={s.defaultCalendarView}
          onChange={(defaultCalendarView) => set({ defaultCalendarView })}
          options={[
            { value: 'day', label: 'День' },
            { value: 'week', label: 'Тиждень' },
            { value: 'month', label: 'Місяць' },
          ]}
        />
      </Row>
      <Row label="Часовий пояс" hint="Береться з пристрою, окремо поки не налаштовується.">
        <span className="text-[13px] font-medium text-muted">{deviceTimeZone()}</span>
      </Row>
    </Group>
  );
}

function CategoryRow({ category, usage }: { category: Category; usage: number }) {
  const actions = useActions();
  const [name, setName] = useState(category.name);
  const commit = () => {
    const n = name.trim();
    if (!n) setName(category.name);
    else if (n !== category.name) void actions.categories.update(category.id, { name: n }).catch(() => undefined);
  };
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <Popover>
        <PopoverTrigger className="h-6 w-6 shrink-0 rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-line" style={{ backgroundColor: colorOf(category.color) }} aria-label={`Змінити колір «${category.name}»`} />
        <PopoverContent className="w-[220px]">
          <ColorPicker value={category.color} onChange={(color) => void actions.categories.update(category.id, { color }).catch(() => undefined)} />
        </PopoverContent>
      </Popover>
      <input
        className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[14px] font-medium outline-none hover:bg-surface-2 focus:bg-surface-2"
        aria-label="Назва категорії"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="hidden text-right text-[12px] text-muted sm:block">
        {usage} {plural(usage, ['елемент', 'елементи', 'елементів'])}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Видалити «${category.name}»`}
        onClick={async () => {
          const ok = await confirm({
            title: `Видалити «${category.name}»?`,
            description: usage ? `Цю категорію використовують елементи: ${usage}. Вони залишаться без категорії.` : undefined,
            confirmLabel: 'Видалити',
            danger: true,
          });
          if (ok) await actions.categories.remove(category.id).then(() => toast.success('Категорію видалено'), () => undefined);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CategoriesSection() {
  const { categories, tasks, events, goals } = useCollections();
  const actions = useActions();
  const q = useContext(SearchCtx);
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const colors = ['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'yellow', 'red', 'slate'] as const;
    actions.categories.create({ name: n, color: colors[categories.length % colors.length], order: categories.length }).write.catch(() => undefined);
    setName('');
  };
  return (
    <Group id="categories" title="Категорії" description="Кольори для задач, подій і цілей." keywords={`колір ${categories.map((c) => c.name).join(' ')}`}>
      {categories
        .filter((c) => matches(q, c.name))
        .map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            usage={tasks.filter((t) => t.categoryId === c.id).length + events.filter((e) => e.categoryId === c.id).length + goals.filter((g) => g.categoryId === c.id).length}
          />
        ))}
      <form
        className="flex items-center gap-3 px-5 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-subtle text-subtle">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <input
          className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[14px] outline-none placeholder:text-subtle hover:bg-surface-2 focus:bg-surface-2"
          placeholder="Нова категорія"
          aria-label="Назва нової категорії"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {name.trim() && (
          <Button type="submit" variant="outline" size="sm">
            Додати
          </Button>
        )}
      </form>
    </Group>
  );
}

function NotificationsSection() {
  const { data, repos, backendKind } = useData();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => void repos.settings.update(patch).catch(() => undefined);
  const [on, setOn] = useState(pushEnabledHere);
  const [busy, setBusy] = useState(false);
  const supported = backendKind === 'firebase' && pushSupported();
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не вдалося');
    } finally {
      setBusy(false);
      setOn(pushEnabledHere());
    }
  };
  const times = (label: string) => [{ value: '', label }, ...['06:00', '07:00', '08:00', '09:00', '10:00', '19:00', '20:00', '21:00', '22:00'].map((t) => ({ value: t, label: t }))];
  return (
    <Group id="notifications" title="Сповіщення" keywords="сповіщення нагадування push пуш ранок звички" description="Нагадування приходять, навіть коли Plano закритий.">
      <Row
        label="На цьому пристрої"
        hint={
          !supported
            ? backendKind !== 'firebase'
              ? 'Доступно після входу в Plano.'
              : 'Цей браузер не підтримує сповіщення.'
            : needsHomeScreen()
              ? 'На iPhone спершу додайте Plano на домашній екран (Поділитися → На екран «Додому») і відкрийте звідти.'
              : on
                ? 'Увімкнено.'
                : 'Вимкнено.'
        }
      >
        {supported && !needsHomeScreen() && (
          <div className="flex gap-2">
            {on && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(sendTestPush, 'Тестове сповіщення надіслано')}>
                Перевірити
              </Button>
            )}
            <Button variant={on ? 'outline' : 'dark'} size="sm" loading={busy} onClick={() => void run(on ? disablePush : enablePush, on ? undefined : 'Сповіщення увімкнено')}>
              {on ? 'Вимкнути' : 'Увімкнути'}
            </Button>
          </div>
        )}
      </Row>
      <Row label="Події" hint="Нагадування перед початком.">
        <Select
          aria-label="Нагадування про події"
          className="w-[170px]"
          value={String(s.remindEventsMin)}
          onChange={(v) => set({ remindEventsMin: Number(v) })}
          options={[['0', 'Вимкнено'], ['5', 'За 5 хв'], ['10', 'За 10 хв'], ['15', 'За 15 хв'], ['30', 'За 30 хв'], ['60', 'За 1 год']].map(([value, label]) => ({ value, label }))}
        />
      </Row>
      <Row label="Задачі з часом" hint="У час початку задачі.">
        <Segmented
          ariaLabel="Нагадування про задачі"
          value={s.remindTasks ? 'on' : 'off'}
          onChange={(v) => set({ remindTasks: v === 'on' })}
          options={[
            { value: 'on', label: 'Так' },
            { value: 'off', label: 'Ні' },
          ]}
        />
      </Row>
      <Row label="Ранковий підсумок" hint="Скільки задач і подій сьогодні.">
        <Select aria-label="Ранковий підсумок" className="w-[170px]" value={s.digestAt} onChange={(digestAt) => set({ digestAt })} options={times('Вимкнено')} />
      </Row>
      <Row label="Звички" hint="Якщо щось ще не відмічено.">
        <Select aria-label="Нагадування про звички" className="w-[170px]" value={s.habitsReminderAt} onChange={(habitsReminderAt) => set({ habitsReminderAt })} options={times('Вимкнено')} />
      </Row>
    </Group>
  );
}

function IntegrationsSection() {
  return (
    <Group id="integrations" title="Інтеграції" keywords="google calendar календар гугл синхронізація">
      <div className="p-4 sm:p-5">
        <GoogleCalendarSettings />
      </div>
    </Group>
  );
}

function DataSection() {
  const { data, repos, backendKind } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(buildExport(data), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plano-export-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Експорт завантажено');
  };

  // Server backups (weekly, automatic) and error reports.
  const cloud = backendKind === 'firebase' && usesTokenServer;
  const [backups, setBackups] = useState<BackupMeta[] | null>(null);
  const [errorCount, setErrorCount] = useState<number | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => {
    if (!cloud) return;
    void listBackups().then(setBackups, () => setBackups([]));
    void listErrors().then((r) => setErrorCount(r.errors.length), () => undefined);
  }, [cloud]);
  const when = (iso: string) => new Date(iso).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не вдалося');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(validateImport(await file.text()));
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyImport = async () => {
    if (!result?.ok) return;
    const ok = await confirm({
      title: 'Замінити всі дані цим файлом?',
      description: 'Усе, що зараз є в Plano, буде замінено імпортованими даними. Якщо сумніваєтеся, спершу зробіть експорт.',
      confirmLabel: 'Замінити дані',
      danger: true,
      typeToConfirm: 'ІМПОРТ',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await settleWrite(repos.replaceAll({ ...result.file.data, settings: { ...DEFAULT_SETTINGS, ...result.file.data.settings } }));
      toast.success('Дані імпортовано');
      setResult(null);
    } catch {
      /* toast from sync layer */
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Видалити всі ваші дані?',
      description: 'Задачі, події, проєкти, звички, цілі, нотатки, категорії та налаштування буде видалено назавжди. Це не можна скасувати.',
      confirmLabel: 'Видалити все',
      danger: true,
      typeToConfirm: 'ВИДАЛИТИ',
    });
    if (!ok) return;
    try {
      await settleWrite(repos.removeAll());
      toast.success('Усі дані видалено');
    } catch {
      /* toast from sync layer */
    }
  };

  return (
    <Group id="data" title="Дані" keywords="експорт імпорт json резервна копія видалити">
      <Row label="Експорт" hint="Усі дані Plano одним файлом JSON." keywords="резервна копія json">
        <Button variant="outline" size="sm" onClick={exportData}>
          <Download className="h-4 w-4" /> Завантажити
        </Button>
      </Row>
      <Row label="Імпорт" hint="Відновлення з експорту. Файл перевіряється до того, як щось буде записано." keywords="json відновити">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Обрати файл…
        </Button>
      </Row>
      {cloud && (
        <Row
          label="Резервні копії"
          hint={`Автоматично раз на тиждень, зберігаються 8 останніх (зашифровано). ${backups?.length ? `Остання: ${when(backups[0].at)}.` : 'Поки немає.'}`}
          keywords="резервна копія backup відновити"
        >
          <div className="flex flex-wrap items-center gap-2">
            {!!backups?.length && (
              <Select
                aria-label="Копія для відновлення"
                className="w-[190px]"
                placeholder="Відновити з копії…"
                value={pick}
                onChange={(at) => {
                  setPick(at);
                  void run(async () => setResult(validateImport(await fetchBackup(at))));
                }}
                options={backups.map((b) => ({ value: b.at, label: when(b.at) }))}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await backupNow(data);
                  setBackups(await listBackups());
                  toast.success('Копію збережено');
                })
              }
            >
              Зробити зараз
            </Button>
          </div>
        </Row>
      )}
      {cloud && (
        <Row label="Звіти про помилки" hint={errorCount ? `Збережено помилок: ${errorCount}. Скопіюйте й надішліть розробнику.` : 'Помилок не було.'} keywords="помилки журнал errors">
          {!!errorCount && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(JSON.stringify((await listErrors()).errors, null, 2));
                    toast.success('Скопійовано');
                  })
                }
              >
                Копіювати
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void run(async () => (await clearErrors(), setErrorCount(0)))}>
                Очистити
              </Button>
            </div>
          )}
        </Row>
      )}
      {result && !result.ok && (
        <div role="alert" className="m-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">
          <p className="font-medium">Цей файл не можна імпортувати:</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && (
        <div className="p-4">
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-medium">Коректний експорт від {new Date(result.file.exportedAt).toLocaleString('uk-UA')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(result.summary).map(([k, v]) => (
                <Badge key={k}>
                  {SUMMARY_LABEL[k] ?? k}: {v}
                </Badge>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                Скасувати
              </Button>
              <Button variant="dark" size="sm" loading={busy} onClick={() => void applyImport()}>
                Замінити мої дані
              </Button>
            </div>
          </div>
        </div>
      )}
      <Row
        label={<span className="text-danger">Видалити всі дані</span>}
        hint={backendKind === 'local' ? 'Видаляє всі дані перегляду з цього браузера.' : 'Назавжди видаляє всі ваші дані з Firebase. Це не можна скасувати.'}
        keywords="видалити всі дані"
      >
        <Button variant="danger" size="sm" onClick={() => void deleteAll()}>
          <Trash2 className="h-4 w-4" /> Видалити
        </Button>
      </Row>
    </Group>
  );
}

export default function SettingsPage() {
  const { section } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<SectionId>('profile');
  const q = norm(query.trim());
  const picked = useRef<{ id: SectionId; until: number } | null>(null);

  // /settings/<section> (also used by links elsewhere in the app) scrolls to that section.
  useEffect(() => {
    if (!section || !SECTIONS.some((x) => x.id === section)) return;
    setActive(section as SectionId);
    picked.current = { id: section as SectionId, until: Date.now() + 1200 };
    const raf = requestAnimationFrame(() => document.getElementById(`settings-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(raf);
  }, [section]);

  // Highlight the section being read: the last one whose top has passed the upper part of the screen,
  // or the section that was just picked (the last ones can't scroll to the top).
  useEffect(() => {
    const onScroll = () => {
      const pick = picked.current;
      if (pick && pick.until > Date.now()) return setActive(pick.id);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      // At the very bottom keep a picked section (e.g. "Дані"), otherwise follow the scroll position.
      if (atBottom && pick) return setActive(pick.id);
      picked.current = null;
      let current: SectionId | null = null;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(`settings-${id}`);
        if (el && (atBottom || el.getBoundingClientRect().top <= window.innerHeight * 0.25)) current = id;
      }
      if (current) setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [q]);

  const go = (id: SectionId) => {
    setQuery('');
    if (id === section) document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else navigate(`/settings/${id}`, { replace: true });
  };

  return (
    <PageContainer className="pb-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-start">
          <h1 className="mb-4 text-[26px] font-bold tracking-tight sm:text-[28px]">Налаштування</h1>
          <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] focus-within:border-subtle">
            <Search className="h-4 w-4 shrink-0 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Знайти налаштування"
              aria-label="Знайти налаштування"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle"
            />
          </label>
          <nav aria-label="Розділи налаштувань" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={active === id && !q ? 'true' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-colors',
                  active === id && !q ? 'bg-surface font-semibold text-ink shadow-soft' : 'text-muted hover:text-ink',
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 lg:pt-[3.25rem]">
          <SearchCtx.Provider value={q}>
            <ProfileCard />
            <AppearanceSection />
            <PreferencesSection />
            <CategoriesSection />
            <NotificationsSection />
            <IntegrationsSection />
            <DataSection />
          </SearchCtx.Provider>
          {q && <NoResults />}
        </div>
      </div>
    </PageContainer>
  );
}

/** Shown under the results; visible only when every group hid itself. */
function NoResults() {
  return <p className="hidden py-10 text-center text-[13.5px] text-muted only:block">Нічого не знайдено.</p>;
}
