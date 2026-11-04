import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const fieldBase =
  'w-full rounded-[14px] border border-transparent bg-surface-2 px-3.5 text-sm text-ink placeholder:text-subtle transition-colors hover:bg-line/50 focus:border-ink/25 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15';

/**
 * Text field. With `icon` it gets a leading glyph (search fields); with `onValueChange` and
 * type="search" it also shows a clear button.
 */
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; onValueChange?: (value: string) => void }
>(function Input({ className, icon, onValueChange, ...props }, ref) {
  const field = <input ref={ref} className={cn(fieldBase, 'h-10', icon && 'pl-10', className)} {...props} />;
  if (!icon) return field;
  const clearable = props.type === 'search' && !!onValueChange && !!props.value && !props.disabled;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {field}
      {clearable && (
        <button
          type="button"
          aria-label="Очистити"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-subtle hover:text-ink"
          onClick={() => onValueChange?.('')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-[84px] resize-y py-2.5 leading-relaxed', className)} {...props} />;
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-[13px] font-medium text-ink', className)} {...props} />;
}

interface FieldProps {
  label?: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Label + control + error/hint, wired up for accessibility. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
