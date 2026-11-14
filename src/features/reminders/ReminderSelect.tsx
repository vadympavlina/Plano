import { Bell, BellOff } from 'lucide-react';
import { Select } from '@/components/ui/select';

const label = (m: number) => (m >= 1440 && m % 1440 === 0 ? `За ${m / 1440} д` : m >= 60 && m % 60 === 0 ? `За ${m / 60} год` : `За ${m} хв`);
const CHOICES = [5, 10, 15, 30, 60, 120, 1440];

/** Per-item reminder: default (from settings), off, or N minutes before. */
export function ReminderSelect({
  value,
  onChange,
  fallback,
  variant = 'chip',
}: {
  value?: number;
  onChange: (v: number | undefined) => void;
  fallback: string;
  variant?: 'chip' | 'row';
}) {
  return (
    <Select
      variant={variant}
      label="Нагадування"
      aria-label="Нагадування"
      icon={value === 0 ? <BellOff /> : <Bell />}
      value={value === undefined ? 'default' : String(value)}
      onChange={(v) => onChange(v === 'default' ? undefined : Number(v))}
      options={[
        variant === 'row'
          ? { value: 'default', label: fallback.charAt(0).toUpperCase() + fallback.slice(1), hint: 'За замовчуванням' }
          : { value: 'default', label: `Нагадування: ${fallback}` },
        { value: '0', label: 'Без нагадування' },
        ...CHOICES.map((m) => ({ value: String(m), label: label(m) })),
      ]}
    />
  );
}

export const reminderLabel = (m: number) => (m > 0 ? label(m).toLowerCase() : 'вимкнено');
