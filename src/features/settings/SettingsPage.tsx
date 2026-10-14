import { useRef, useState, type ReactNode } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { CalendarDays, Database, Download, Monitor, Moon, Palette, Plug, Plus, SlidersHorizontal, Sun, Tags, Trash2, Upload, UserRound } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, Badge } from '@/components/ui/misc';
import { Field, Input, Select } from '@/components/ui/input';
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
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'integrations', label: 'Integrations', icon: Plug },
] as const;

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
  const avatarError = avatar && !/^https:\/\/\S+$/i.test(avatar) ? 'Use an https:// image link.' : undefined;
  const user = state.status === 'signedIn' ? state.user : null;

  const save = async () => {
    if (avatarError) return;
    setBusy(true);
    try {
      await settleWrite(repos.profile.update({ displayName: name.trim() || undefined, avatarUrl: avatar.trim() || undefined }));
      if (backendKind === 'firebase') await updateAuthProfile({ displayName: name.trim() || null }).catch(() => undefined);
      toast.success('Profile saved');
    } catch {
      /* toast from sync layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Profile" description="Your name is used in greetings across Plano.">
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={name || profile.name} src={avatar && !avatarError ? avatar : profile.avatarUrl} className="h-14 w-14 text-base" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">{name || profile.name || 'No name set'}</p>
          <p className="truncate text-muted">{user?.email ?? (backendKind === 'local' ? 'Local preview (not signed in)' : '')}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name">{(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Avatar image URL" error={avatarError} hint="Optional. Leave empty to use your account photo.">
          {(p) => <Input {...p} type="url" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} />}
        </Field>
      </div>
      {user && (
        <p className="mt-4 break-all text-xs text-subtle">
          User ID: <code className="font-mono">{user.uid}</code>
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="dark" onClick={() => void save()} loading={busy} disabled={!!avatarError}>
          Save profile
        </Button>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const { data, repos } = useData();
  const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  return (
    <Section title="Appearance" description="Light is the default. System follows your device setting.">
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
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
    <Section title="Preferences">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Week starts on">
          {(p) => (
            <Select {...p} value={s.weekStartsOn} onChange={(e) => set({ weekStartsOn: Number(e.target.value) as 0 | 1 })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          )}
        </Field>
        <Field label="Time format">
          {(p) => (
            <Select {...p} value={s.timeFormat} onChange={(e) => set({ timeFormat: e.target.value as Settings['timeFormat'] })}>
              <option value="24h">24-hour (14:30)</option>
              <option value="12h">12-hour (2:30 PM)</option>
            </Select>
          )}
        </Field>
        <Field label="Date format">
          {(p) => (
            <Select {...p} value={s.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as Settings['dateFormat'] })}>
              {(['MMM d, yyyy', 'd MMM yyyy', 'dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] as const).map((f) => (
                <option key={f} value={f}>
                  {formatDateKey(sample, f)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Default calendar view" hint="On phones the week view opens as a day view unless chosen explicitly.">
          {(p) => (
            <Select {...p} value={s.defaultCalendarView} onChange={(e) => set({ defaultCalendarView: e.target.value as Settings['defaultCalendarView'] })}>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </Select>
          )}
        </Field>
        <Field
          label="Time zone"
          hint="Times are stored as local wall-clock times and shown in this device’s time zone. A separate time-zone override is not supported yet."
        >
          {(p) => <Input {...p} value={deviceTimeZone()} readOnly disabled />}
        </Field>
      </div>
      <p className="mt-4 text-xs text-subtle">Changes are saved automatically and sync to your other devices.</p>
      <Button
        variant="link"
        size="sm"
        className="mt-2"
        onClick={() => set({ weekStartsOn: DEFAULT_SETTINGS.weekStartsOn, timeFormat: DEFAULT_SETTINGS.timeFormat, dateFormat: DEFAULT_SETTINGS.dateFormat, defaultCalendarView: DEFAULT_SETTINGS.defaultCalendarView })}
      >
        Reset to defaults
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
        <PopoverTrigger className="h-6 w-6 shrink-0 rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-line" style={{ backgroundColor: colorOf(category.color) }} aria-label={`Change color of ${category.name}`} />
        <PopoverContent className="w-[220px]">
          <ColorPicker value={category.color} onChange={(color) => void actions.categories.update(category.id, { color }).catch(() => undefined)} />
        </PopoverContent>
      </Popover>
      <Input
        className="h-9 flex-1"
        aria-label="Category name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <span className="hidden w-20 text-right text-xs text-muted sm:block">{usage} items</span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${category.name}`}
        onClick={async () => {
          const ok = await confirm({
            title: `Delete “${category.name}”?`,
            description: usage ? `${usage} item(s) use this category. They will be kept without a category.` : undefined,
            confirmLabel: 'Delete',
            danger: true,
          });
          if (ok) await actions.categories.remove(category.id).then(() => toast.success('Category deleted'), () => undefined);
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
    <Section title="Categories" description="Used to colour tasks, events and goals.">
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
        <Input placeholder="New category" aria-label="New category name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="outline" disabled={!name.trim()}>
          <Plus className="h-4 w-4" /> Add
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
    toast.success('Export downloaded');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(validateImport(await file.text()));
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyImport = async () => {
    if (!result?.ok) return;
    const ok = await confirm({
      title: 'Replace all data with this file?',
      description: 'Everything currently in Plano will be replaced by the imported data. Export a backup first if unsure.',
      confirmLabel: 'Replace data',
      danger: true,
      typeToConfirm: 'IMPORT',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await settleWrite(repos.replaceAll({ ...result.file.data, settings: { ...DEFAULT_SETTINGS, ...result.file.data.settings } }));
      toast.success('Data imported');
      setResult(null);
    } catch {
      /* toast from sync layer */
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Delete all your data?',
      description: 'Tasks, events, projects, habits, goals, notes, categories and settings will be permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
      typeToConfirm: 'DELETE',
    });
    if (!ok) return;
    try {
      await settleWrite(repos.removeAll());
      toast.success('All data deleted');
    } catch {
      /* toast from sync layer */
    }
  };

  return (
    <>
      <Section title="Export" description="Download all your Plano data as a JSON file.">
        <Button variant="outline" onClick={exportData}>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
      </Section>
      <Section title="Import" description="Restore from a Plano export. The file is checked before anything is written.">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Choose file…
        </Button>
        {result && !result.ok && (
          <div role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">
            <p className="font-medium">This file can’t be imported:</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {result?.ok && (
          <div className="mt-4 rounded-xl border border-line p-4">
            <p className="text-sm font-medium">Valid export from {new Date(result.file.exportedAt).toLocaleString()}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(result.summary).map(([k, v]) => (
                <Badge key={k}>
                  {v} {k}
                </Badge>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                Cancel
              </Button>
              <Button variant="dark" size="sm" loading={busy} onClick={() => void applyImport()}>
                Replace my data
              </Button>
            </div>
          </div>
        )}
      </Section>
      <Section title="Delete data" description={backendKind === 'local' ? 'Removes all preview data from this browser.' : 'Permanently removes all your data from Firebase.'}>
        <Button variant="danger" onClick={() => void deleteAll()}>
          <Trash2 className="h-4 w-4" /> Delete all data
        </Button>
      </Section>
    </>
  );
}

function IntegrationsSection() {
  const availability = googleCalendarProvider.availability();
  return (
    <Section title="Integrations" description="Connect external services to Plano.">
      <div className="flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">
          <CalendarDays className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Google Calendar</p>
            <Badge>Not connected</Badge>
            <Badge color="#9275EF">Coming soon</Badge>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Two-way sync of events is planned. Plano already keeps your own events separate from imported ones and stores external ids to prevent duplicates.
            {!availability.available && ` ${availability.reason}`}
          </p>
        </div>
        <Button variant="outline" disabled aria-disabled title="Not available yet">
          Connect
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
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <nav aria-label="Settings sections" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-52 lg:shrink-0 lg:flex-col lg:px-0">
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
