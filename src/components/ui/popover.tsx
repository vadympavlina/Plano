import * as PP from '@radix-ui/react-popover';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils/cn';

export const Popover = PP.Root;
export const PopoverTrigger = PP.Trigger;
export const PopoverClose = PP.Close;
export const PopoverAnchor = PP.Anchor;

export function PopoverContent({ className, align = 'start', sideOffset = 6, ...props }: ComponentPropsWithoutRef<typeof PP.Content>) {
  return (
    <PP.Portal>
      <PP.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          'z-50 rounded-xl border border-line bg-surface p-3 text-sm text-ink shadow-pop focus:outline-hidden origin-(--radix-popover-content-transform-origin) data-[state=open]:animate-scale-in data-[state=closed]:animate-pop-out',
          className,
        )}
        {...props}
      />
    </PP.Portal>
  );
}
