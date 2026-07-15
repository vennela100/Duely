import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

// Cloud login for the single Duely owner. First run creates the account; later
// runs sign in. Firebase persists the session (AsyncStorage), so after the first
// connect the owner stays signed in across app restarts — no re-entering creds.

export const signInOwner = async (email: string, password: string): Promise<User> => {
  const e = email.trim();
  try {
    const cred = await createUserWithEmailAndPassword(auth, e, password);
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, e, password);
      return cred.user;
    }
    throw err;
  }
};

export const signOutOwner = (): Promise<void> => signOut(auth);

export const onCloudAuth = (cb: (user: User | null) => void): (() => void) =>
  onAuthStateChanged(auth, cb);

export const currentUid = (): string | null => auth.currentUser?.uid ?? null;
