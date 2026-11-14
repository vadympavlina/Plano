import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { describeRecurrence } from '@/lib/date/recurrence';
import { Picker, PickerContent, PickerTrigger } from '@/components/ui/picker';
import { popoverPanel, RowFace, triggerClass, type ControlVariant } from '@/components/ui/select';
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
    <Picker>
      <PickerTrigger type="button" className={cn(triggerClass(variant, { empty: !value }), className)} aria-label="Повторення">
        {variant === 'row' ? (
          <RowFace icon={<Repeat />} label="Повторення" empty={!value} value={value ? describeRecurrence(value) : 'Не повторюється'} />
        ) : (
          <>
            {showIcon && <Repeat className="h-4 w-4 shrink-0 text-muted" />}
            <span className="min-w-0 truncate">{value ? describeRecurrence(value) : 'Не повторюється'}</span>
          </>
        )}
      </PickerTrigger>
      <PickerContent title="Повторення" className={cn(popoverPanel, 'w-[320px] p-3')} sheetClassName="pb-2">
        <div className="px-2 pb-2">
          <RecurrenceEditor value={value} onChange={onChange} startDate={startDate} />
        </div>
      </PickerContent>
    </Picker>
  );
}
