import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from 'firebase/auth';
import { signInOwner, signOutOwner } from '@/services/cloudAuth';
import { initialSync, startSync, pushLive, pushDailyBackup } from '@/services/cloudSync';

const EMAIL_KEY = 'fl:cloudEmail';

export type CloudStatus = 'off' | 'connecting' | 'syncing' | 'synced' | 'error';

interface CloudState {
  status: CloudStatus;
  uid: string | null;
  email: string | null;
  lastSyncedAt: string | null;
  errorMsg: string | null;
  _stopSync: (() => void) | null;

  loadEmail: () => Promise<void>;
  connect: (email: string, password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  bind: (user: User | null) => Promise<void>; // driven by the auth listener
  syncNow: () => Promise<void>;
  backupNow: () => Promise<void>;
}

export const useCloudStore = create<CloudState>()((set, get) => ({
  status: 'off',
  uid: null,
  email: null,
  lastSyncedAt: null,
  errorMsg: null,
  _stopSync: null,

  loadEmail: async () => {
    const e = await AsyncStorage.getItem(EMAIL_KEY);
    if (e) set({ email: e });
  },

  connect: async (email, password) => {
    set({ status: 'connecting', errorMsg: null });
    try {
      await AsyncStorage.setItem(EMAIL_KEY, email.trim());
      set({ email: email.trim() });
      await signInOwner(email, password);
      // The auth listener (bind) takes over from here.
    } catch (e) {
      set({ status: 'error', errorMsg: (e as Error).message });
      throw e;
    }
  },

  disconnect: async () => {
    get()._stopSync?.();
    set({ _stopSync: null });
    await signOutOwner();
    set({ status: 'off', uid: null, lastSyncedAt: null });
  },

  bind: async (user) => {
    if (!user) {
      get()._stopSync?.();
      set({ status: 'off', uid: null, _stopSync: null });
      return;
    }
    const uid = user.uid;
    set({ status: 'syncing', uid, errorMsg: null });
    try {
      await initialSync(uid);
      const stop = startSync(uid, (s) => {
        if (s === 'synced') set({ status: 'synced', lastSyncedAt: new Date().toISOString() });
        else if (s === 'syncing') set({ status: 'syncing' });
        else set({ status: 'error' });
      });
      set({ _stopSync: stop, status: 'synced', lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({ status: 'error', errorMsg: (e as Error).message });
    }
  },

  syncNow: async () => {
    const uid = get().uid;
    if (!uid) return;
    set({ status: 'syncing' });
    try {
      await pushLive(uid);
      set({ status: 'synced', lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({ status: 'error', errorMsg: (e as Error).message });
    }
  },

  backupNow: async () => {
    const uid = get().uid;
    if (!uid) return;
    await pushDailyBackup(uid);
  },
}));
