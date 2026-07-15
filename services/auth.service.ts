import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email.trim(), password);

export const signOut = () => fbSignOut(auth);

export const subscribeAuth = (cb: (u: User | null) => void) =>
  onAuthStateChanged(auth, cb);

export type { User };
