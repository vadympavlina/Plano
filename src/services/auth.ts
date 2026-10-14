import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';
import type { Backend } from '@/lib/backend/types';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function toAppUser(user: User): AppUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL };
}

export function watchAuth(cb: (user: AppUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (u) => cb(u ? toAppUser(u) : null));
}

export async function signInWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOutFirebase() {
  await fbSignOut(getFirebaseAuth());
}

export async function updateAuthProfile(patch: { displayName?: string | null; photoURL?: string | null }) {
  const user = getFirebaseAuth().currentUser;
  if (user) await updateProfile(user, patch);
}

/**
 * Checks the server-side allowlist (/allowlist/{uid} === true). The same check
 * is enforced by the database rules, so this only decides which screen to show.
 */
export async function checkAccess(backend: Backend, uid: string): Promise<boolean> {
  try {
    return (await backend.get(`allowlist/${uid}`)) === true;
  } catch {
    return false;
  }
}

export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Неправильна пошта або пароль.';
    case 'auth/too-many-requests':
      return 'Забагато спроб. Зачекайте трохи й спробуйте знову.';
    case 'auth/network-request-failed':
      return 'Помилка мережі. Перевірте з’єднання.';
    case 'auth/unauthorized-domain':
      return 'Цей домен не додано в Authorized domains у Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Вхід за поштою й паролем не ввімкнено у Firebase.';
    default:
      return (error as Error)?.message || 'Не вдалося увійти.';
  }
}
