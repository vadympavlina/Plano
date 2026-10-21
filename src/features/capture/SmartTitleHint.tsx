import { Sparkles, Undo2 } from 'lucide-react';

/** Under the title of a new task / event: what the title says, applied when the field is left. */
export function SmartTitleHint({ summary, found, applied, onApply, onRevert }: { summary: string[]; found: boolean; applied: boolean; onApply: () => void; onRevert: () => void }) {
  if (applied)
    return (
      <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Заповнено з назви
        <button type="button" onClick={onRevert} className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10">
          <Undo2 className="h-3 w-3" /> Повернути
        </button>
      </p>
    );
  if (!found) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted" aria-live="polite">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="min-w-0">Розпізнано: {summary.join(' · ')}</span>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onApply} className="rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10">
        Застосувати
      </button>
    </p>
  );
}
