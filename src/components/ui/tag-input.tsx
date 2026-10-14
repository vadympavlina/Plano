import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Tags as removable chips; Enter or comma adds, Backspace on empty removes the last one. */
export function TagInput({
  value,
  onChange,
  placeholder = 'Додати тег',
  id,
  className,
  suggestions = [],
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  suggestions?: string[];
}) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '');
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setText('');
  };
  const q = text.trim().toLowerCase();
  const hints = q ? suggestions.filter((s) => s.toLowerCase().startsWith(q) && !value.includes(s)).slice(0, 5) : [];

  return (
    <div className={className}>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-0.5 pl-2 pr-1 text-[12.5px] font-medium text-ink">
            #{t}
            <button
              type="button"
              aria-label={`Прибрати тег ${t}`}
              onClick={() => onChange(value.filter((x) => x !== t))}
              className="flex h-4 w-4 items-center justify-center rounded text-subtle hover:bg-line hover:text-ink"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add(v.slice(0, -1));
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length ? '' : placeholder}
          className={cn('h-7 min-w-[90px] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-subtle')}
        />
      </div>
      {hints.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {hints.map((h) => (
            <button
              key={h}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(h)}
              className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-muted hover:text-ink"
            >
              #{h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
