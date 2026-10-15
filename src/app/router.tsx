import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingState } from '@/components/common/States';

const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const ProjectPage = lazy(() => import('@/features/projects/ProjectPage'));
const HabitsPage = lazy(() => import('@/features/habits/HabitsPage'));
const HabitPage = lazy(() => import('@/features/habits/HabitPage'));
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage'));
const NotesPage = lazy(() => import('@/features/notes/NotesPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

const page = (el: React.ReactNode) => <Suspense fallback={<LoadingState />}>{el}</Suspense>;

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: page(<Dashboard />) },
      { path: 'calendar', element: page(<CalendarPage />) },
      { path: 'tasks', element: page(<TasksPage />) },
      { path: 'projects', element: page(<ProjectsPage />) },
      { path: 'projects/:projectId', element: page(<ProjectPage />) },
      { path: 'habits', element: page(<HabitsPage />) },
      { path: 'habits/:habitId', element: page(<HabitPage />) },
      { path: 'goals', element: page(<GoalsPage />) },
      { path: 'notes', element: page(<NotesPage />) },
      { path: 'notes/:noteId', element: page(<NotesPage />) },
      { path: 'settings', element: page(<SettingsPage />) },
      { path: 'settings/:section', element: page(<SettingsPage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

// Hash routing keeps deep links and refreshes working on GitHub Pages,
// which cannot rewrite unknown paths to index.html.
export function createAppRouter() {
  return createHashRouter(routes);
}
