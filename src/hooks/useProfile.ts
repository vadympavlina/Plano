import { useAuth } from '@/app/providers/AuthProvider';
import { useData } from '@/app/providers/DataProvider';

/** Display name / avatar: Plano profile first, then the auth provider. */
export function useProfile() {
  const { state } = useAuth();
  const { data } = useData();
  const user = state.status === 'signedIn' ? state.user : null;
  const name = data.profile.displayName || user?.displayName || (user?.email ? user.email.split('@')[0] : '') || '';
  return {
    name,
    firstName: name.split(/\s+/)[0] ?? '',
    email: user?.email ?? null,
    avatarUrl: data.profile.avatarUrl || user?.photoURL || null,
    mode: state.status === 'signedIn' ? state.mode : null,
  };
}
