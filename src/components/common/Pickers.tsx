import { useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { colorOf, tint } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import { COLOR_KEYS, type ColorKey } from '@/types';

/** Gradient used for note and project covers. */
export const coverGradient = (c: ColorKey, strong = 0.3, soft = 0.12) => `linear-gradient(120deg, ${tint(colorOf(c), strong)}, ${tint(colorOf(c), soft)})`;

const EMOJIS = ['💡', '📝', '📌', '📚', '🎯', '🚀', '💼', '🏠', '🛒', '✈️', '🧳', '🍳', '💪', '🧘', '🎨', '🎵', '🎬', '📷', '💻', '🧠', '❤️', '⭐', '🔥', '🌱', '☕', '🗓️', '💰', '🛠️', '📈', '✅', '❓', '🎉'];

export function EmojiPicker({ value, onChange, children, label = 'Іконка' }: { value?: string; onChange: (v: string | undefined) => void; children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[264px] p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onChange(e);
                setOpen(false);
              }}
              className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-[18px] hover:bg-surface-2', value === e && 'bg-surface-2 ring-1 ring-line')}
            >
              {e}
            </button>
          ))}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
          >
            Прибрати іконку
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function CoverPicker({ value, onChange, children, label = 'Обкладинка' }: { value?: ColorKey; onChange: (v: ColorKey | undefined) => void; children?: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ? (
          <button type="button" aria-label={label} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            {children}
          </button>
        ) : (
          <button type="button" className="rounded-lg bg-surface/85 px-2.5 py-1 text-[12px] font-medium text-ink shadow-soft backdrop-blur hover:bg-surface">
            Змінити обкладинку
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[232px] p-3">
        <div className="grid grid-cols-5 gap-2">
          {COLOR_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={cn('h-9 rounded-lg ring-offset-2 ring-offset-surface', value === c && 'ring-2 ring-ink/40')}
              style={{ background: coverGradient(c, 0.45, 0.18) }}
            />
          ))}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-lg py-1.5 text-[12.5px] text-muted hover:bg-surface-2 hover:text-ink"
          >
            Прибрати обкладинку
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
