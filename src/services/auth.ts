import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
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

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Popups are blocked in some standalone PWAs — fall back to a redirect.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
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
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised in Firebase Authentication settings.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase.';
    default:
      return (error as Error)?.message || 'Sign-in failed.';
  }
}
