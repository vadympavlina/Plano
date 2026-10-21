import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { FolderKanban, Hash } from 'lucide-react';
import { CategoryIcon, categoryIcon } from '@/components/common/CategoryMark';
import { colorOf } from '@/lib/utils/colors';
import { cn } from '@/lib/utils/cn';
import type { Category, Project } from '@/types';
import { sameName, type Span } from './parse';

const TONE: Record<Span['type'], string> = {
  date: 'bg-primary/15',
  time: 'bg-primary/15',
  duration: 'bg-primary/15',
  repeat: 'bg-primary/15',
  tag: 'bg-[#8B5CF6]/15',
  project: 'bg-[#8B5CF6]/15',
  priority: 'bg-warning/20',
  reminder: 'bg-success/15',
  kind: 'bg-line',
  note: 'bg-surface-2',
};

type Suggestion = { kind: 'category'; item: Category } | { kind: 'project'; item: Project };

export interface SmartFieldHandle {
  focus: () => void;
}

/**
 * One text field that shows what it understood: recognised words are tinted in
 * place (a mirror under a transparent textarea), # and @ suggest categories and
 * projects, Enter adds.
 */
export const SmartField = forwardRef<SmartFieldHandle, {
  value: string;
  onChange: (v: string) => void;
  spans: Span[];
  onSubmit: () => void;
  categories: Category[];
  projects: Project[];
  placeholder?: string;
  big?: boolean;
  autoFocus?: boolean;
  className?: string;
  label?: string;
}>(function SmartField({ value, onChange, spans, onSubmit, categories, projects, placeholder, big, autoFocus, className, label = 'Назва для швидкого додавання' }, ref) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState(false);
  // Focus with the caret at the end (after a suggestion added words).
  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = area.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      setCaret(el.value.length);
    },
  }));

  // Grow with the text.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, big]);

  // «#ро» or «@Pla» right before the caret → suggestions.
  const token = useMemo(() => {
    const m = value.slice(0, caret).match(/(^|\s)([#@])([\p{L}\d_'ʼ’-]*)$/u);
    return m ? { sym: m[2], query: m[3], start: caret - m[3].length - 1 } : null;
  }, [value, caret]);
  const suggestions = useMemo<Suggestion[]>(() => {
    if (!token || closed) return [];
    const q = token.query.toLowerCase().replace(/_/g, ' ');
    const hit = (name: string) => !q || name.toLowerCase().includes(q) || sameName(name, token.query);
    return [
      ...(token.sym === '#' ? categories.filter((c) => hit(c.name)).map((item) => ({ kind: 'category' as const, item })) : []),
      ...projects.filter((p) => p.status !== 'archived' && hit(p.name)).map((item) => ({ kind: 'project' as const, item })),
    ].slice(0, 6);
  }, [token, closed, categories, projects]);
  // Already typed in full: Enter adds instead of picking it again.
  const open = suggestions.length > 0 && !(suggestions.length === 1 && token && sameName(suggestions[0].item.name, token.query));

  const pick = (s: Suggestion) => {
    if (!token) return;
    const insert = `${token.sym}${s.item.name.replace(/\s+/g, '_')} `;
    const next = value.slice(0, token.start) + insert + value.slice(caret).replace(/^\S*\s?/, '');
    onChange(next);
    const pos = token.start + insert.length;
    requestAnimationFrame(() => {
      area.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(suggestions[Math.min(active, suggestions.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setClosed(true);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  // The mirror: same text, recognised pieces tinted (no padding or bold, so it lines up exactly).
  const mirror: ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start < at) continue;
    mirror.push(value.slice(at, s.start));
    mirror.push(
      <mark key={s.start} className={cn('rounded-[4px] text-ink', TONE[s.type])}>
        {value.slice(s.start, s.end)}
      </mark>,
    );
    at = s.end;
  }
  mirror.push(value.slice(at) + '​');

  // 16px on phones: iOS zooms into smaller inputs.
  const text = big ? 'text-[19px] leading-[1.5]' : 'text-[16px] leading-[1.5] sm:text-[15px] sm:leading-[1.6]';
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <div aria-hidden className={cn('pointer-events-none absolute inset-0 whitespace-pre-wrap break-words py-2 text-ink', text)}>
        {mirror}
      </div>
      <textarea
        ref={area}
        rows={1}
        value={value}
        autoFocus={autoFocus}
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        maxLength={300}
        placeholder={placeholder}
        spellCheck={false}
        enterKeyHint="done"
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setClosed(false);
          setActive(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setClosed(true), 150)}
        onFocus={() => setClosed(false)}
        className={cn('relative block w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent py-2 text-transparent caret-ink outline-none placeholder:text-subtle', text)}
      />
      {open && (
        <ul role="listbox" className="absolute left-0 top-full z-30 mt-1 w-[260px] max-w-full rounded-xl border border-line bg-surface p-1 shadow-pop">
          {suggestions.map((s, i) => (
            <li key={s.item.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px]', i === active ? 'bg-surface-2' : 'hover:bg-surface-2')}
              >
                <span className="flex w-4 justify-center" style={{ color: colorOf(s.item.color) }}>
                  {s.kind === 'project' ? <FolderKanban className="h-4 w-4" /> : categoryIcon(s.item) ? <CategoryIcon category={s.item} className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.item.name}</span>
                <span className="text-[11px] text-subtle">{s.kind === 'category' ? 'категорія' : 'проєкт'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
