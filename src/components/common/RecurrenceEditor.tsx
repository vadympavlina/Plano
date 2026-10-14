import type { RecurrenceRule, RecurrenceFreq } from '@/types';
import { Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { describeRecurrence } from '@/lib/date/recurrence';

type Preset = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LETTER = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAME = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];

function presetOf(rule?: RecurrenceRule): Preset {
  if (!rule) return 'none';
  if (rule.interval !== 1) return 'custom';
  if (rule.freq === 'weekly') {
    const d = rule.byWeekday ?? [];
    if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return 'weekdays';
    if (d.length > 1) return 'custom';
    return 'weekly';
  }
  return rule.freq;
}

export function RecurrenceEditor({
  value,
  onChange,
  startDate,
  id,
}: {
  value?: RecurrenceRule;
  onChange: (rule: RecurrenceRule | undefined) => void;
  /** Date of the first occurrence; used for the default weekday. */
  startDate?: string;
  id?: string;
}) {
  const preset = presetOf(value);
  const startDay = startDate ? new Date(`${startDate}T12:00:00`).getDay() : new Date().getDay();

  const setPreset = (p: Preset) => {
    const until = value?.until;
    switch (p) {
      case 'none':
        return onChange(undefined);
      case 'weekdays':
        return onChange({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5], until });
      case 'custom':
        return onChange({ freq: 'weekly', interval: 1, byWeekday: [startDay], until });
      default:
        return onChange({ freq: p, interval: 1, until });
    }
  };

  const days = value?.byWeekday && value.byWeekday.length ? value.byWeekday : [startDay];

  return (
    <div className="space-y-3">
      <Select id={id} value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
        <option value="none">Не повторювати</option>
        <option value="daily">Щодня</option>
        <option value="weekdays">Щобудня (пн–пт)</option>
        <option value="weekly">Щотижня</option>
        <option value="monthly">Щомісяця</option>
        <option value="yearly">Щороку</option>
        <option value="custom">Власний…</option>
      </Select>

      {value && preset === 'custom' && (
        <div className="space-y-3 rounded-xl border border-line bg-surface-2/60 p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Кожні</span>
            <Input
              type="number"
              min={1}
              max={99}
              aria-label="Інтервал"
              className="h-9 w-16 text-center"
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
            />
            <Select
              aria-label="Одиниця"
              className="h-9 w-auto"
              value={value.freq}
              onChange={(e) => {
                const freq = e.target.value as RecurrenceFreq;
                onChange({ ...value, freq, byWeekday: freq === 'weekly' ? days : undefined });
              }}
            >
              <option value="daily">{value.interval === 1 ? 'день' : 'дні'}</option>
              <option value="weekly">{value.interval === 1 ? 'тиждень' : 'тижні'}</option>
              <option value="monthly">{value.interval === 1 ? 'місяць' : 'місяці'}</option>
              <option value="yearly">{value.interval === 1 ? 'рік' : 'роки'}</option>
            </Select>
          </div>
          {value.freq === 'weekly' && (
            <div className="flex gap-1.5" role="group" aria-label="Дні тижня">
              {DAY_ORDER.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={DAY_NAME[d]}
                    onClick={() => {
                      const next = on ? days.filter((x) => x !== d) : [...days, d];
                      if (next.length) onChange({ ...value, byWeekday: next.sort() });
                    }}
                    className={cn(
                      'h-8 w-9 rounded-full text-[11px] font-semibold transition-colors',
                      on ? 'bg-accent text-surface' : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
                    )}
                  >
                    {DAY_LETTER[d]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-muted">До</span>
          <Input
            type="date"
            aria-label="Повторювати до"
            className="h-9"
            value={value.until ?? ''}
            min={startDate}
            onChange={(e) => onChange({ ...value, until: e.target.value || undefined })}
          />
        </div>
      )}
      {value && <p className="text-xs text-muted">{describeRecurrence(value)}</p>}
    </div>
  );
}
