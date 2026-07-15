import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/services/auth.service';
import type { Lang } from '@/utils/i18n';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  type: ToastType;
}

const LANG_KEY = 'fl:lang';
const MSG_LANG_KEY = 'fl:msgLang';

interface UIState {
  user: User | null;
  authLoading: boolean;
  unlocked: boolean;
  ownerName: string;
  lang: Lang;
  msgLang: Lang;
  toast: ToastState | null;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setUnlocked: (unlocked: boolean) => void;
  setOwnerName: (name: string) => void;
  setLang: (lang: Lang) => void;
  setMsgLang: (lang: Lang) => void;
  loadLang: () => Promise<void>;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  user: null,
  authLoading: true,
  unlocked: false,
  ownerName: '',
  lang: 'en',
  msgLang: 'en',
  toast: null,
  setUser: (user) => set({ user }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setUnlocked: (unlocked) => set({ unlocked }),
  setOwnerName: (ownerName) => set({ ownerName }),
  setLang: (lang) => {
    set({ lang });
    AsyncStorage.setItem(LANG_KEY, lang).catch(() => undefined);
  },
  setMsgLang: (msgLang) => {
    set({ msgLang });
    AsyncStorage.setItem(MSG_LANG_KEY, msgLang).catch(() => undefined);
  },
  loadLang: async () => {
    const [v, m] = await Promise.all([
      AsyncStorage.getItem(LANG_KEY),
      AsyncStorage.getItem(MSG_LANG_KEY),
    ]);
    if (v) set({ lang: v as Lang });
    // Message language defaults to the app language until set explicitly.
    set({ msgLang: (m as Lang | null) ?? (v as Lang | null) ?? 'en' });
  },
  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),
}));
