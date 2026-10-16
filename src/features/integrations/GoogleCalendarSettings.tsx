import { useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Loader2, LogIn, RefreshCw, Send, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { Checkbox } from '@/components/ui/controls';
import { Select } from '@/components/ui/select';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { plural } from '@/lib/date';
import { GoogleAuthError } from '@/services/integrations/google/auth';
import { usesTokenServer } from '@/services/integrations/google/server';
import { useGoogleSync } from './GoogleSyncProvider';

function timeAgo(iso?: string) {
  if (!iso) return 'ще не було';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'щойно';
  if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
  return new Date(iso).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const errorText = (e: unknown) => (e instanceof GoogleAuthError || e instanceof Error ? e.message : 'Не вдалося підключитися до Google.');

export function GoogleCalendarSettings() {
  const g = useGoogleSync();
  const [busy, setBusy] = useState<null | 'connect' | 'auth' | 'push' | 'disconnect'>(null);
  const calendars = g.state?.calendars ?? [];
  const selected = new Set(g.state?.calendarIds ?? []);
  const writable = calendars.filter((c) => c.writable);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof GoogleAuthError && e.code === 'popup_closed')) toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <div className="flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2">
        <CalendarDays className="h-5 w-5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">Google Calendar</p>
          {g.phase === 'off' || g.phase === 'unavailable' ? (
            <Badge>Не підключено</Badge>
          ) : g.phase === 'needs_auth' ? (
            <Badge color="#E0922F">Потрібен вхід у Google</Badge>
          ) : g.phase === 'error' ? (
            <Badge color="#E5484D">Помилка</Badge>
          ) : (
            <Badge color="#35B98A">Підключено</Badge>
          )}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Двостороння синхронізація подій: події з Google з’являються в Plano, а події з Plano — у Google. Задачі не синхронізуються.
        </p>
      </div>
    </div>
  );

  if (g.phase === 'unavailable') {
    return (
      <div className="rounded-xl border border-line p-4">
        {header}
        <p className="mt-3 text-[13px] text-muted">Доступно після входу в Plano через Firebase (не в локальному перегляді).</p>
      </div>
    );
  }

  if (g.phase === 'off') {
    return (
      <div className="rounded-xl border border-line p-4">
        {header}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="dark" loading={busy === 'connect'} onClick={() => void run('connect', g.connect)}>
            {busy !== 'connect' && <LogIn className="h-4 w-4" />} Підключити Google Calendar
          </Button>
          <p className="text-xs text-muted">Відкриється вікно Google, де потрібно дозволити доступ до календаря.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line p-4">
        {header}

        {g.phase === 'needs_auth' && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 p-3">
            <p className="min-w-0 flex-1 text-[13px] text-ink">
              {usesTokenServer
                ? 'Увійдіть у Google ще раз — після цього підключення працюватиме постійно, без повторних входів'
                : 'Доступ від Google діє близько години. Увійдіть ще раз, щоб продовжити синхронізацію'}
              {g.pending ? `: ${g.pending} ${plural(g.pending, ['зміна чекає', 'зміни чекають', 'змін чекають'])} на відправку` : ''}.
            </p>
            <Button size="sm" variant="dark" loading={busy === 'auth'} onClick={() => void run('auth', g.reauthorize)}>
              Увійти в Google
            </Button>
          </div>
        )}
        {g.error && g.phase !== 'needs_auth' && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-[13px] text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {g.error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            {g.phase === 'syncing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-success" />}
            {g.phase === 'syncing' ? 'Синхронізація…' : `Остання синхронізація: ${timeAgo(g.state?.lastSyncAt)}`}
          </span>
          {g.pending > 0 && g.phase !== 'syncing' && <span>Чекають на відправку: {g.pending}</span>}
          <Button size="sm" variant="outline" className="ml-auto" disabled={g.phase === 'syncing' || g.phase === 'needs_auth'} onClick={() => void g.syncNow()}>
            <RefreshCw className="h-3.5 w-3.5" /> Синхронізувати
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-line p-4">
        <p className="text-sm font-semibold">Календарі в Plano</p>
        <p className="mt-0.5 text-xs text-muted">Події з позначених календарів показуються в Plano.</p>
        <ul className="mt-3 space-y-1">
          {calendars.map((c) => (
            <li key={c.id}>
              <Checkbox
                className="w-full rounded-lg px-2 py-2 hover:bg-surface-2"
                checked={selected.has(c.id)}
                onChange={(on) => {
                  const next = on ? [...selected, c.id] : [...selected].filter((x) => x !== c.id);
                  void g.setSelected(next).catch(() => undefined);
                }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color ?? '#4778F5' }} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.primary && <span className="text-xs text-muted">основний</span>}
                {!c.writable && <span className="text-xs text-muted">лише читання</span>}
              </Checkbox>
            </li>
          ))}
          {calendars.length === 0 && <li className="px-2 py-2 text-[13px] text-muted">Список календарів з’явиться після першої синхронізації.</li>}
        </ul>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Нові події з Plano</p>
          <p className="mt-0.5 text-xs text-muted">У який календар Google додавати події, створені в Plano.</p>
        </div>
        <Select
          aria-label="Календар для нових подій"
          className="sm:w-[240px]"
          placeholder="Не додавати в Google"
          value={g.state?.targetCalendarId}
          onChange={(id) => void g.setTarget(id).catch(() => undefined)}
          options={writable.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          loading={busy === 'push'}
          disabled={!g.state?.targetCalendarId}
          onClick={() =>
            void run('push', async () => {
              const n = await g.pushExisting();
              toast.success(n ? `${n} ${plural(n, ['подію', 'події', 'подій'])} буде надіслано в Google` : 'Усі майбутні події вже в Google');
            })
          }
        >
          {busy !== 'push' && <Send className="h-4 w-4" />} Надіслати наявні події Plano
        </Button>
        <Button
          variant="ghost"
          loading={busy === 'disconnect'}
          onClick={async () => {
            const ok = await confirm({
              title: 'Відключити Google Calendar?',
              description: 'Події, імпортовані з Google, буде прибрано з Plano. Ваші події Plano залишаться, але більше не синхронізуватимуться. У самому Google Calendar нічого не зміниться.',
              confirmLabel: 'Відключити',
              danger: true,
            });
            if (ok) await run('disconnect', () => g.disconnect(true));
          }}
        >
          {busy !== 'disconnect' && <Unplug className="h-4 w-4" />} Відключити
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-subtle">
        Синхронізація працює, поки Plano відкритий: одразу після змін і кожні 5 хвилин. Синхронізуються події від 60 днів тому до року вперед.
        Токен доступу Google зберігається лише в цій вкладці браузера.
      </p>
    </div>
  );
}
