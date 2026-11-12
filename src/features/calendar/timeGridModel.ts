import type { GridItem } from './items';

/** Pixels per hour: the day view is roomier than the multi-day views. */
export const HOUR_PX_DAY = 68;
export const HOUR_PX_MULTI = 52;
export const SNAP = 15;
export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const LONG_PRESS_MS = 350;
/** A finger has to rest this long on a block before it can be carried. */
export const PICK_UP_MS = 380;
export const DAY_END = 24 * 60;

/** Anything on the grid that can be moved: a one-off event or a task with a time. */
export type MovableItem = GridItem;

export interface DragState {
  mode: 'move' | 'resize';
  item: MovableItem;
  pointerId: number;
  startX: number;
  startY: number;
  dayIndex: number;
  deltaMin: number;
  deltaDays: number;
  moved: boolean;
  /** Scroll position when the drag began: scrolling while dragging counts as movement. */
  startScroll: number;
}

/** Range being drawn on the time grid to create an event. */
export interface Selection {
  pointerId: number;
  dayIndex: number;
  anchor: number;
  pointer: number;
  startY: number;
  startX: number;
  /** Touch selections start only after a long press. */
  active: boolean;
  moved: boolean;
}

/** Range of days being drawn in the all-day row. */
export interface DaySelection {
  pointerId: number;
  from: number;
  to: number;
}
