import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, Segmented } from '@/components/ui/misc';
import { useInstall } from '@/lib/pwa/install';
import { Select } from '@/components/ui/select';
import { useData } from '@/app/providers/DataProvider';
import { deviceTimeZone, formatDateKey, todayKey } from '@/lib/date';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { Row, Group } from './shared';
import type { Settings } from '@/types';

function InstallRow() {
  const { state, install } = useInstall();
  if (state === 'unsupported') return null;
  return (
    <Row
      label="Застосунок на пристрої"
      hint={
        state === 'installed'
          ? 'Plano встановлено: відкривається окремим вікном, працює без мережі.'
          : state === 'ios'
            ? 'У Safari: «Поділитися» → «На початковий екран». Так Plano відкривається як застосунок і працює без мережі.'
            : 'Окреме вікно, іконка на екрані й робота без мережі.'
      }
      keywords="встановити pwa іконка екран додому застосунок"
    >
      {state === 'available' && (
        <Button variant="outline" size="sm" onClick={() => void install()}>
          <Download className="h-4 w-4" /> Встановити
        </Button>
      )}
      {state === 'installed' && <Badge>Встановлено</Badge>}
    </Row>
  );
}

export function PreferencesSection() {
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
            className="-my-2 py-2 font-medium text-muted hover:text-ink"
            onClick={() =>
              set({
                weekStartsOn: DEFAULT_SETTINGS.weekStartsOn,
                timeFormat: DEFAULT_SETTINGS.timeFormat,
                dateFormat: DEFAULT_SETTINGS.dateFormat,
                defaultCalendarView: DEFAULT_SETTINGS.defaultCalendarView,
              })
            }
          >
            Скинути до стандартних
          </button>
        </div>
      }
    >
      <InstallRow />
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
          options={(['d MMMM yyyy', 'd MMM yyyy', 'dd.MM.yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'] as const).map((f) => ({
            value: f,
            label: formatDateKey(sample, f),
          }))}
        />
      </Row>
      <Row label="Календар відкривається" hint="На телефоні календар завжди відкривається на сьогоднішньому дні.">
        <Segmented
          wrap
          ariaLabel="Вигляд календаря за замовчуванням"
          value={s.defaultCalendarView}
          onChange={(defaultCalendarView) => set({ defaultCalendarView })}
          options={[
            { value: 'day', label: 'День' },
            { value: '3days', label: '3 дні' },
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
