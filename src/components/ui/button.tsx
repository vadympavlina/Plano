import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'dark' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-fg hover:brightness-105 active:brightness-95',
  dark: 'bg-accent text-surface hover:opacity-90 active:opacity-80',
  secondary: 'bg-surface-2 text-ink hover:bg-line/70 active:bg-line',
  outline: 'bg-surface-2 text-ink hover:bg-line/70 active:bg-line',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink active:bg-line/70',
  danger: 'bg-danger text-on-fill hover:brightness-105 active:brightness-95',
  link: 'text-primary hover:underline underline-offset-2 px-0 h-auto',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-3 text-xs gap-1 rounded-full',
  sm: 'h-8 px-3.5 text-[13px] gap-1.5 rounded-full',
  md: 'h-10 px-[18px] text-sm gap-2 rounded-full',
  lg: 'h-11 px-6 text-[15px] gap-2 rounded-full',
  icon: 'h-10 w-10 rounded-full',
  'icon-sm': 'h-8 w-8 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition-[background-color,color,opacity,filter,transform] duration-150 motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
