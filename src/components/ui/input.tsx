import { forwardRef, useId, type FormEventHandler, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { GlassInput } from './glass';
import { cn } from '@/lib/utils/cn';

/**
 * A glass field (glisse). It wraps the input in its own element, so `className` styles
 * the field and the usual props (id, aria, value, onChange…) go to the input inside.
 */
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; onValueChange?: (value: string) => void }
>(function Input(
  { className, onChange, value, defaultValue, ...props },
  ref,
) {
  return (
    <GlassInput
      ref={ref}
      className={cn('ui-field h-10', className)}
      value={value == null ? undefined : String(value)}
      defaultValue={defaultValue == null ? undefined : String(defaultValue)}
      // glisse keeps its own onChange for the field's state; ours listens to the same keystrokes.
      onInput={onChange as unknown as FormEventHandler<HTMLInputElement>}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'glass-control w-full min-h-[84px] resize-y rounded-[18px] px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
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
