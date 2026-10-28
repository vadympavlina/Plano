import * as DM from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }: ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'glass-panel z-50 min-w-[200px] overflow-hidden rounded-[20px] p-1.5 text-sm text-ink data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  icon,
  danger,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DM.Item> & { icon?: ReactNode; danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-[14px] px-3 py-2 outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-[var(--lg-highlight)] data-[disabled]:opacity-50 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted',
        danger && 'text-danger [&_svg]:text-danger',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </DM.Item>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn('px-2.5 pb-1 pt-2 text-xs font-medium text-subtle', className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <DM.Separator className={cn('my-1 h-px bg-line', className)} />;
}
