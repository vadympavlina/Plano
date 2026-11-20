import type { CaptureKind } from './useCapture';

const KEY = 'plano:slotKind';

/**
 * What a calendar gesture (a press-and-hold, a drag over a slot, a tap on a day) creates: an event or a task.
 * It is the choice made last time, so someone who plans with tasks does not have to switch it every time.
 */
export function readSlotKind(): Extract<CaptureKind, 'event' | 'task'> {
  try {
    return localStorage.getItem(KEY) === 'task' ? 'task' : 'event';
  } catch {
    return 'event';
  }
}

export function rememberSlotKind(kind: CaptureKind) {
  if (kind !== 'event' && kind !== 'task') return;
  try {
    localStorage.setItem(KEY, kind);
  } catch {
    /* private mode: the choice just is not kept */
  }
}
