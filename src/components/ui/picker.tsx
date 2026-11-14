import { createContext, forwardRef, useContext, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import * as PP from '@radix-ui/react-popover';
import * as DP from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDragDismiss } from '@/lib/gesture/useDragDismiss';
import { cn } from '@/lib/utils/cn';

/** Phones (the same breakpoint as the bottom sheets): pickers open as a sheet, not as a small floating panel. */
export const PHONE_QUERY = '(max-width: 639px)';
export const useIsPhone = () => useMediaQuery(PHONE_QUERY);

const PhoneCtx = createContext(false);

/**
 * A picker (date, time, list of choices, repeat): a popover next to its button on a desktop, a bottom sheet on a phone.
 * Use `Picker` > `PickerTrigger` + `PickerContent` exactly like Radix's Popover.
 */
export function Picker({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode }) {
  const phone = useIsPhone();
  const Root = phone ? DP.Root : PP.Root;
  return (
    <PhoneCtx.Provider value={phone}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </PhoneCtx.Provider>
  );
}

export const PickerTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(function PickerTrigger(props, ref) {
  const phone = useContext(PhoneCtx);
  return phone ? <DP.Trigger ref={ref} {...props} /> : <PP.Trigger ref={ref} {...props} />;
});

export function PickerContent({
  title,
  children,
  className,
  sheetClassName,
  align = 'start',
  onPopoverOpenAutoFocus,
}: {
  /** Heading of the sheet (phones). */
  title: string;
  children: ReactNode;
  /** Popover panel classes (desktop). */
  className?: string;
  sheetClassName?: string;
  align?: 'start' | 'center' | 'end';
  onPopoverOpenAutoFocus?: (e: Event) => void;
}) {
  const phone = useContext(PhoneCtx);
  if (!phone)
    return (
      <PP.Portal>
        <PP.Content align={align} sideOffset={6} collisionPadding={12} className={className} onOpenAutoFocus={onPopoverOpenAutoFocus}>
          {children}
        </PP.Content>
      </PP.Portal>
    );
  return (
    <PickerSheet title={title} className={sheetClassName}>
      {children}
    </PickerSheet>
  );
}

function PickerSheet({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const sheet = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const drag = useDragDismiss({
    target: sheet,
    overlay: shade,
    axis: 'y',
    dir: 1,
    allow: (e) => e.pointerType === 'touch' && !(e.target as HTMLElement).closest('button'),
    onDismiss: () => closeBtn.current?.click(),
  });
  return (
    <DP.Portal>
      <DP.Overlay ref={shade} className="fixed inset-0 z-[60] bg-[#0b0f17]/40 enter-fade" />
      <DP.Content
        ref={sheet}
        aria-describedby={undefined}
        // A sheet that opens by a tap must not raise the keyboard: focus stays on the sheet itself.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          sheet.current?.focus({ preventScroll: true });
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[60] flex max-h-[86dvh] flex-col rounded-t-[22px] border border-line bg-surface pb-safe shadow-pop outline-hidden enter-dialog',
          className,
        )}
      >
        <div className="touch-none" {...drag}>
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden />
          <div className="flex items-center gap-3 px-5 pb-1 pt-3">
            <DP.Title className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-ink">{title}</DP.Title>
            <DP.Close
              ref={closeBtn}
              aria-label="Закрити"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </DP.Close>
          </div>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1">{children}</div>
      </DP.Content>
    </DP.Portal>
  );
}
