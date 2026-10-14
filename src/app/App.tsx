import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { DataProvider } from './providers/DataProvider';
import { createAppRouter } from './router';
import { ThemeController } from './ThemeController';
import { PwaUpdater } from './PwaUpdater';
import { SyncFeedback } from './SyncFeedback';
import { OfflineBanner } from './OfflineBanner';
import { Toaster } from '@/components/ui/toast';
import { ConfirmDialogHost } from '@/components/common/ConfirmDialog';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AccessDeniedScreen, AuthErrorScreen, LoginScreen, SetupScreen, SplashScreen } from '@/features/auth/AuthScreens';

function SignedInApp() {
  const router = useMemo(() => createAppRouter(), []);
  return (
    <>
      <ThemeController />
      <RouterProvider router={router} />
    </>
  );
}

function Gate() {
  const { state } = useAuth();
  switch (state.status) {
    case 'loading':
      return <SplashScreen />;
    case 'unconfigured':
      return <SetupScreen />;
    case 'signedOut':
      return <LoginScreen />;
    case 'denied':
      return <AccessDeniedScreen email={state.user.email} uid={state.user.uid} />;
    case 'error':
      return <AuthErrorScreen message={state.message} />;
    case 'signedIn':
      // Keyed by uid so nothing from a previous session can leak into the next.
      return (
        <DataProvider key={state.user.uid} backend={state.backend} uid={state.user.uid}>
          <SignedInApp />
        </DataProvider>
      );
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Gate />
      </AuthProvider>
      <SyncFeedback />
      <PwaUpdater />
      <OfflineBanner />
      <ConfirmDialogHost />
      <Toaster />
    </ErrorBoundary>
  );
}
