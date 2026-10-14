import { useRef, useState, type ReactNode } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { CalendarDays, Database, Download, Monitor, Moon, Palette, Plug, Plus, SlidersHorizontal, Sun, Tags, Trash2, Upload, UserRound } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, Badge, Segmented } from '@/components/ui/misc';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ColorPicker } from '@/components/ui/color-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { Avatar } from '@/components/layout/Avatar';
import { useData } from '@/app/providers/DataProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { useActions } from '@/hooks/useActions';
import { useCollections } from '@/hooks/useCollections';
import { useProfile } from '@/hooks/useProfile';
import { settleWrite } from '@/services/sync';
import { updateAuthProfile } from '@/services/auth';
import { googleCalendarProvider } from '@/services/integrations/googleCalendar';
import { deviceTimeZone, formatDateKey, todayKey } from '@/lib/date';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { Category, Settings, ThemePreference } from '@/types';
import { buildExport, validateImport, type ImportResult } from './dataTransfer';

const SECTIONS = [
  { id: 'profile', label: 'Профіль', icon: UserRound },
  { id: 'appearance', label: 'Вигляд', icon: Palette },
  { id: 'preferences', label: 'Параметри', icon: SlidersHorizontal },
  { id: 'categories', label: 'Категорії', icon: Tags },
  { id: 'data', label: 'Дані', icon: Database },
  { id: 'integrations', label: 'Інтеграції', icon: Plug },
] as const;

const SUMMARY_LABEL: Record<string, string> = {
  categories: 'Категорії',
  tasks: 'Задачі',
  events: 'Події',
  projects: 'Проєкти',
  habits: 'Звички',
  goals: 'Цілі',
  notes: 'Нотатки',
};

function PrefRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function ProfileSection() {
  const { data, repos, backendKind } = useData();
  const profile = useProfile();
  const { state } = useAuth();
  const [name, setName] = useState(data.profile.displayName ?? profile.name);
  const [avatar, setAvatar] = useState(data.profile.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const avatarError = avatar && !/^https:\/\/\S+$/i.test(avatar) ? 'Вкажіть посилання на зображення, що починається з https://' : undefined;
  const user = state.status === 'signedIn' ? state.user : null;

  const save = async () => {
    if (avatarError) return;
    setBusy(true);
    try {
      await settleWrite(repos.profile.update({ displayName: name.trim() || undefined, avatarUrl: avatar.trim() || undefined }));
      if (backendKind === 'firebase') await updateAuthProfile({ displayName: name.trim() || null }).catch(() => undefined);
      toast.success('Профіль збережено');
    } catch {
      /* toast from sync layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Профіль" description="Ім’я використовується у привітаннях у Plano.">
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={name || profile.name} src={avatar && !avatarError ? avatar : profile.avatarUrl} className="h-14 w-14 text-base" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">{name || profile.name || 'Ім’я не вказано'}</p>
          <p className="truncate text-muted">{user?.email ?? (backendKind === 'local' ? 'Локальний перегляд (без входу)' : '')}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ім’я">{(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Посилання на аватар" error={avatarError} hint="Необов’язково. Залиште порожнім, щоб використати фото акаунта.">
          {(p) => <Input {...p} type="url" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} />}
        </Field>
      </div>
      {user && (
        <p className="mt-4 break-all text-xs text-subtle">
          ID користувача: <code className="font-mono">{user.uid}</code>
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="dark" onClick={() => void save()} loading={busy} disabled={!!avatarError}>
          Зберегти профіль
        </Button>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const { data, repos } = useData();
  const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Світла', icon: Sun },
    { value: 'dark', label: 'Темна', icon: Moon },
    { value: 'system', label: 'Системна', icon: Monitor },
  ];
  return (
    <Section title="Вигляд" description="За замовчуванням — світла тема. Системна повторює налаштування пристрою.">
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Тема">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={data.settings.theme === value}
            onClick={() => void repos.settings.update({ theme: value }).catch(() => undefined)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors',
              data.settings.theme === value ? 'border-accent bg-surface-2' : 'border-line text-muted hover:text-ink',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function PreferencesSection() {
  const { data, repos } = useData();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => void repos.settings.update(patch).catch(() => undefined);
  const sample = todayKey();
  return (
    <Section title="Параметри">
      <div className="divide-y divide-line">
        <PrefRow label="Початок тижня">
          <Segmented
            ariaLabel="Початок тижня"
            value={String(s.weekStartsOn) as '0' | '1'}
            onChange={(v) => set({ weekStartsOn: Number(v) as 0 | 1 })}
            options={[
              { value: '1', label: 'Понеділок' },
              { value: '0', label: 'Неділя' },
            ]}
          />
        </PrefRow>
        <PrefRow label="Формат часу">
          <Segmented
            ariaLabel="Формат часу"
            value={s.timeFormat}
            onChange={(timeFormat) => set({ timeFormat })}
            options={[
              { value: '24h', label: '14:30' },
              { value: '12h', label: '2:30 PM' },
            ]}
          />
        </PrefRow>
        <PrefRow label="Формат дати">
          <Select
            aria-label="Формат дати"
            className="w-[200px]"
            value={s.dateFormat}
            onChange={(dateFormat) => set({ dateFormat })}
            options={(['d MMMM yyyy', 'd MMM yyyy', 'dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] as const).map((f) => ({ value: f, label: formatDateKey(sample, f) }))}
          />
        </PrefRow>
        <PrefRow label="Календар відкривається" hint="На телефоні тиждень показується як день.">
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
        </PrefRow>
        <PrefRow label="Часовий пояс" hint="Час показується в часовому поясі пристрою. Окремий пояс поки не налаштовується.">
          <span className="text-sm font-medium text-ink">{deviceTimeZone()}</span>
        </PrefRow>
      </div>
      <p className="mt-4 text-xs text-subtle">Зміни зберігаються автоматично й синхронізуються з іншими пристроями.</p>
      <Button
        variant="link"
        size="sm"
        className="mt-2 px-0"
        onClick={() => set({ weekStartsOn: DEFAULT_SETTINGS.weekStartsOn, timeFormat: DEFAULT_SETTINGS.timeFormat, dateFormat: DEFAULT_SETTINGS.dateFormat, defaultCalendarView: DEFAULT_SETTINGS.defaultCalendarView })}
      >
        Скинути до стандартних
      </Button>
    </Section>
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
    <li className="flex items-center gap-3 py-2">
      <Popover>
        <PopoverTrigger className="h-6 w-6 shrink-0 rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-line" style={{ backgroundColor: colorOf(category.color) }} aria-label={`Змінити колір «${category.name}»`} />
        <PopoverContent className="w-[220px]">
          <ColorPicker value={category.color} onChange={(color) => void actions.categories.update(category.id, { color }).catch(() => undefined)} />
        </PopoverContent>
      </Popover>
      <Input
        className="h-9 flex-1"
        aria-label="Назва категорії"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="hidden w-20 text-right text-xs text-muted sm:block">елементів: {usage}</span>
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
    </li>
  );
}

function CategoriesSection() {
  const { categories, tasks, events, goals } = useCollections();
  const actions = useActions();
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const colors = ['blue', 'green', 'purple', 'pink', 'orange', 'teal', 'yellow', 'red', 'slate'] as const;
    actions.categories.create({ name: n, color: colors[categories.length % colors.length], order: categories.length }).write.catch(() => undefined);
    setName('');
  };
  return (
    <Section title="Категорії" description="Кольори для задач, подій і цілей.">
      <ul className="divide-y divide-line">
        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            usage={tasks.filter((t) => t.categoryId === c.id).length + events.filter((e) => e.categoryId === c.id).length + goals.filter((g) => g.categoryId === c.id).length}
          />
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input placeholder="Нова категорія" aria-label="Назва нової категорії" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="outline" disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Додати
        </Button>
      </form>
    </Section>
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
    <>
      <Section title="Експорт" description="Завантажте всі дані Plano у файлі JSON.">
        <Button variant="outline" onClick={exportData}>
          <Download className="h-4 w-4" /> Експорт JSON
        </Button>
      </Section>
      <Section title="Імпорт" description="Відновлення з експорту Plano. Файл перевіряється до того, як щось буде записано.">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Обрати файл…
        </Button>
        {result && !result.ok && (
          <div role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">
            <p className="font-medium">Цей файл не можна імпортувати:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {result?.ok && (
          <div className="mt-4 rounded-xl border border-line p-4">
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
        )}
      </Section>
      <Section title="Видалення даних" description={backendKind === 'local' ? 'Видаляє всі дані перегляду з цього браузера.' : 'Назавжди видаляє всі ваші дані з Firebase.'}>
        <Button variant="danger" onClick={() => void deleteAll()}>
          <Trash2 className="h-4 w-4" /> Видалити всі дані
        </Button>
      </Section>
    </>
  );
}

function IntegrationsSection() {
  const availability = googleCalendarProvider.availability();
  return (
    <Section title="Інтеграції" description="Підключення зовнішніх сервісів до Plano.">
      <div className="flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">
          <CalendarDays className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Google Calendar</p>
            <Badge>Не підключено</Badge>
            <Badge color="#9275EF">Незабаром</Badge>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Заплановано двосторонню синхронізацію подій. Plano вже відокремлює власні події від імпортованих і зберігає зовнішні ідентифікатори, щоб уникати дублікатів.
            {!availability.available && ` ${availability.reason}`}
          </p>
        </div>
        <Button variant="outline" disabled aria-disabled title="Поки недоступно">
          Підключити
        </Button>
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const { section = 'profile' } = useParams();
  const current = SECTIONS.find((s) => s.id === section)?.id ?? 'profile';
  return (
    <PageContainer>
      <PageHeader title="Налаштування" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Розділи налаштувань" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-52 lg:shrink-0 lg:flex-col lg:px-0">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <NavLink
              key={id}
              to={`/settings/${id}`}
              className={() =>
                cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors',
                  current === id ? 'bg-surface text-ink shadow-soft ring-1 ring-line' : 'text-muted hover:text-ink',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 max-w-3xl flex-1 space-y-4">
          {current === 'profile' && <ProfileSection />}
          {current === 'appearance' && <AppearanceSection />}
          {current === 'preferences' && <PreferencesSection />}
          {current === 'categories' && <CategoriesSection />}
          {current === 'data' && <DataSection />}
          {current === 'integrations' && <IntegrationsSection />}
        </div>
      </div>
    </PageContainer>
  );
}
