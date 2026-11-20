import type { CalendarHeader } from '@/types';

/** What the phone's calendar top does, from the setting: compact (one row), folds away on scroll, merges with the app bar. */
export const headerFlags = (h: CalendarHeader | undefined) => ({
  compact: !!h && h !== 'classic',
  collapse: !!h && h.endsWith('collapse'),
  single: !!h && h.startsWith('single'),
});
