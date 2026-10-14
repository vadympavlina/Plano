import { useState } from 'react';
import type { RecurrenceFreq, RecurrenceRule } from '@/types';
import { cn } from '@/lib/utils/cn';
import { describeRecurrence } from '@/lib/date/recurrence';
import { Select } from '@/components/ui/select';
import { Stepper } from '@/components/ui/controls';
import { DatePicker } from '@/components/ui/date-time';
import { fromDateKey, plural } from '@/lib/date';

type Preset = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
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

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'none', label: 'Не повторювати' },
  { value: 'daily', label: 'Щодня' },
  { value: 'weekdays', label: 'Щобудня (пн–пт)' },
  { value: 'weekly', label: 'Щотижня' },
  { value: 'monthly', label: 'Щомісяця' },
  { value: 'yearly', label: 'Щороку' },
  { value: 'custom', label: 'Власний розклад' },
];

const UNIT_FORMS: Record<RecurrenceFreq, [string, string, string]> = {
  daily: ['день', 'дні', 'днів'],
  weekly: ['тиждень', 'тижні', 'тижнів'],
  monthly: ['місяць', 'місяці', 'місяців'],
  yearly: ['рік', 'роки', 'років'],
};

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
  // "Custom" stays open once chosen, even if the rule matches a simple preset.
  const [customMode, setCustomMode] = useState(() => presetOf(value) === 'custom');
  const preset = value && customMode ? 'custom' : presetOf(value);
  const startDay = startDate ? fromDateKey(startDate).getDay() : new Date().getDay();

  const setPreset = (p: Preset) => {
    setCustomMode(p === 'custom');
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
      <Select id={id} aria-label="Повторення" value={preset} onChange={setPreset} options={PRESETS} />

      {value && preset === 'custom' && (
        <div className="space-y-3 rounded-xl bg-surface-2 p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Кожні</span>
            <Stepper
              aria-label="Інтервал"
              className="h-9 w-[120px]"
              min={1}
              max={99}
              value={value.interval}
              onChange={(interval) => onChange({ ...value, interval: Math.round(interval) || 1 })}
            />
            <Select
              aria-label="Одиниця"
              className="h-9 w-[130px]"
              value={value.freq}
              onChange={(freq) => onChange({ ...value, freq, byWeekday: freq === 'weekly' ? days : undefined })}
              options={(Object.keys(UNIT_FORMS) as RecurrenceFreq[]).map((f) => ({ value: f, label: plural(value.interval, UNIT_FORMS[f]) }))}
            />
          </div>
          {value.freq === 'weekly' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Дні тижня">
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
                      'h-8 w-10 rounded-lg text-[12px] font-semibold transition-colors',
                      on ? 'bg-accent text-surface' : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
                    )}
                  >
                    {DAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-3 text-sm">
          <span className="shrink-0 text-muted">Закінчується</span>
          <DatePicker
            aria-label="Повторювати до"
            variant="chip"
            placeholder="Ніколи"
            value={value.until}
            min={startDate}
            onChange={(until) => onChange({ ...value, until })}
          />
        </div>
      )}
      {value && <p className="text-xs text-muted">{describeRecurrence(value)}</p>}
    </div>
  );
}
