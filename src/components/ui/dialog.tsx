import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** When true, clicks outside and Escape do not close the dialog (e.g. unsaved form). */
  preventDismiss?: boolean;
  onDismissBlocked?: () => void;
  hideTitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
  headerActions?: ReactNode;
}

const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

/**
 * Centered dialog on larger screens, bottom sheet on phones.
 * Content scrolls inside the sheet so it never exceeds the viewport.
 */
export function DialogContent({
  title,
  description,
  children,
  className,
  preventDismiss,
  onDismissBlocked,
  hideTitle,
  size = 'md',
  headerActions,
}: DialogContentProps) {
  const block = (e: Event) => {
    if (preventDismiss) {
      e.preventDefault();
      onDismissBlocked?.();
    }
  };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b0f17]/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        onInteractOutside={block}
        onEscapeKeyDown={block}
        aria-describedby={description ? undefined : undefined}
        className={cn(
          'fixed z-50 flex max-h-[92dvh] w-full flex-col border border-line bg-surface shadow-pop focus:outline-none',
          'inset-x-0 bottom-0 rounded-t-[22px] pb-safe data-[state=open]:animate-slide-up',
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-0 sm:data-[state=open]:animate-scale-in',
          sizes[size],
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <div className={cn('flex items-start gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-5', hideTitle && 'sr-only')}>
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : 'Діалог'}</DialogPrimitive.Description>
            )}
          </div>
          {headerActions}
          <DialogPrimitive.Close
            className="-mr-1 rounded-lg p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Закрити"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-5 -mb-5 mt-6 flex flex-col-reverse gap-2 border-t border-line bg-surface px-5 py-3 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-end sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Right-hand side panel on desktop, bottom sheet on phones. */
export function SheetContent({
  title,
  children,
  className,
  headerActions,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b0f17]/30 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col border-line bg-surface shadow-pop focus:outline-none',
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[22px] border-t pb-safe data-[state=open]:animate-slide-up',
          'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:border-l md:border-t-0 md:pb-0 md:data-[state=open]:animate-slide-in-right',
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line md:hidden" aria-hidden />
        <div className="flex items-center gap-1 px-4 pb-1 pt-3 md:pt-4">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Деталі</DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Закрити"
          >
            <X className="h-4 w-4" />
            <span>Закрити</span>
          </DialogPrimitive.Close>
          <div className="ml-auto flex items-center gap-1">{headerActions}</div>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 pb-6 md:px-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
