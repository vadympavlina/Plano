import { useAuth } from '@/app/providers/AuthProvider';
import { useData } from '@/app/providers/DataProvider';

/** Display name / avatar: Plano profile first, then the auth provider. */
export function useProfile() {
  const { state } = useAuth();
  const { data } = useData();
  const user = state.status === 'signedIn' ? state.user : null;
  // Without a display name, derive one from the email: "vadym.pavlina@…" → "Vadym Pavlina".
  const fromEmail = user?.email
    ? user.email
        .split('@')[0]
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')
    : '';
  const name = data.profile.displayName || user?.displayName || fromEmail || '';
  return {
    name,
    firstName: name.split(/\s+/)[0] ?? '',
    email: user?.email ?? null,
    avatarUrl: data.profile.avatarUrl || user?.photoURL || null,
    mode: state.status === 'signedIn' ? state.mode : null,
  };
}
