import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

const env = import.meta.env;

const options: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const REQUIRED: (keyof FirebaseOptions)[] = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];

export const missingFirebaseKeys = REQUIRED.filter((k) => !options[k]);
export const isFirebaseConfigured = missingFirebaseKeys.length === 0;

export type AuthMethod = 'email' | 'google';
export const authMethods: AuthMethod[] = (env.VITE_AUTH_METHODS || 'email,google')
  .split(',')
  .map((s: string) => s.trim())
  .filter((s: string): s is AuthMethod => s === 'email' || s === 'google');

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured. See README → Firebase setup.');
  if (!app) app = initializeApp(options);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(ensureApp());
  return auth;
}

export function getFirebaseDb(): Database {
  if (!db) db = getDatabase(ensureApp());
  return db;
}
