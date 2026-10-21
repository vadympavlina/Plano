import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CalendarEvent, DateKey, Task } from '@/types';
import type { CapturePreset } from '@/features/capture/useCapture';

const TaskFormDialog = lazy(() => import('@/features/tasks/TaskForm'));
const TaskDetailSheet = lazy(() => import('@/features/tasks/TaskDetail'));
const EventFormDialog = lazy(() => import('@/features/calendar/EventForm'));
const EventDetailDialog = lazy(() => import('@/features/calendar/EventDetail'));
const SearchCommand = lazy(() => import('@/features/search/SearchCommand'));
const QuickAddSheet = lazy(() => import('@/features/capture/QuickAddSheet'));

type TaskEditor = { task?: Task; defaults?: Partial<Task> } | null;
type EventEditor = { event?: CalendarEvent; defaults?: Partial<CalendarEvent> } | null;

interface UIContextValue {
  openTaskForm: (opts?: { task?: Task; defaults?: Partial<Task> }) => void;
  openTask: (taskId: string) => void;
  openEventForm: (opts?: { event?: CalendarEvent; defaults?: Partial<CalendarEvent> }) => void;
  openEvent: (eventId: string, date?: DateKey) => void;
  openSearch: () => void;
  openQuickAdd: (preset?: CapturePreset) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [taskEditor, setTaskEditor] = useState<TaskEditor>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [eventEditor, setEventEditor] = useState<EventEditor>(null);
  const [eventDetail, setEventDetail] = useState<{ id: string; date?: DateKey } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quick, setQuick] = useState<{ preset?: CapturePreset } | null>(null);

  const openTaskForm = useCallback((opts?: { task?: Task; defaults?: Partial<Task> }) => setTaskEditor(opts ?? {}), []);
  const openTask = useCallback((id: string) => setTaskId(id), []);
  const openEventForm = useCallback(
    (opts?: { event?: CalendarEvent; defaults?: Partial<CalendarEvent> }) => setEventEditor(opts ?? {}),
    [],
  );
  const openEvent = useCallback((id: string, date?: DateKey) => setEventDetail({ id, date }), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openQuickAdd = useCallback((preset?: CapturePreset) => setQuick({ preset }), []);

  const value = useMemo(
    () => ({ openTaskForm, openTask, openEventForm, openEvent, openSearch, openQuickAdd }),
    [openTaskForm, openTask, openEventForm, openEvent, openSearch, openQuickAdd],
  );

  return (
    <UIContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {taskEditor && (
          <TaskFormDialog task={taskEditor.task} defaults={taskEditor.defaults} onClose={() => setTaskEditor(null)} />
        )}
        {taskId && <TaskDetailSheet taskId={taskId} onClose={() => setTaskId(null)} />}
        {eventEditor && (
          <EventFormDialog event={eventEditor.event} defaults={eventEditor.defaults} onClose={() => setEventEditor(null)} />
        )}
        {eventDetail && (
          <EventDetailDialog eventId={eventDetail.id} date={eventDetail.date} onClose={() => setEventDetail(null)} />
        )}
        {searchOpen && <SearchCommand onClose={() => setSearchOpen(false)} />}
        {quick && <QuickAddSheet preset={quick.preset} onClose={() => setQuick(null)} />}
      </Suspense>
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
}
