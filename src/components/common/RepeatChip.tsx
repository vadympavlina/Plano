import * as PP from '@radix-ui/react-popover';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { describeRecurrence } from '@/lib/date/recurrence';
import { popoverPanel, triggerClass, type ControlVariant } from '@/components/ui/select';
import type { RecurrenceRule } from '@/types';
import { RecurrenceEditor } from './RecurrenceEditor';

/** Compact trigger that opens the recurrence editor in a popover. */
export function RepeatChip({
  value,
  onChange,
  startDate,
  variant = 'chip',
  className,
  showIcon = true,
}: {
  value?: RecurrenceRule;
  onChange: (rule: RecurrenceRule | undefined) => void;
  startDate?: string;
  variant?: ControlVariant;
  className?: string;
  showIcon?: boolean;
}) {
  return (
    <PP.Root>
      <PP.Trigger type="button" className={cn(triggerClass(variant, { empty: !value }), className)} aria-label="Повторення">
        {showIcon && <Repeat className="h-4 w-4 shrink-0 text-muted" />}
        <span className="min-w-0 truncate">{value ? describeRecurrence(value) : 'Не повторюється'}</span>
      </PP.Trigger>
      <PP.Portal>
        <PP.Content align="start" sideOffset={6} collisionPadding={12} className={cn(popoverPanel, 'w-[320px] p-3')}>
          <RecurrenceEditor value={value} onChange={onChange} startDate={startDate} />
        </PP.Content>
      </PP.Portal>
    </PP.Root>
  );
}
