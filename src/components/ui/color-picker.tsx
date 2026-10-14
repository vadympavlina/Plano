import { Check } from 'lucide-react';
import { COLOR_KEYS, type ColorKey } from '@/types';
import { COLORS } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';

export function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={COLORS[key].label}
          title={COLORS[key].label}
          onClick={() => onChange(key)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110',
            value === key && 'ring-2',
          )}
          style={{ backgroundColor: COLORS[key].solid, ['--tw-ring-color' as string]: COLORS[key].solid }}
        >
          {value === key && <Check className="h-3.5 w-3.5 stroke-[3] text-white" />}
        </button>
      ))}
    </div>
  );
}
