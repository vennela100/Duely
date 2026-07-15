import { create } from 'zustand';
import type { CollectionEntry } from '@/types';
import { subscribeEntriesByDate } from '@/services/collections.service';
import { today } from '@/utils/date';

interface CollectionState {
  todayEntries: CollectionEntry[];
  todaySubscribed: boolean;
  todayUnsubscribe: (() => void) | null;
  loading: boolean;
  subscribeToday: (uid: string) => void;
  unsubscribeToday: () => void;
  wasCollectedToday: (customerId: string) => boolean;
  totalCollectedToday: () => number;
}

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  todayEntries: [],
  todaySubscribed: false,
  todayUnsubscribe: null,
  loading: false,

  subscribeToday: (uid: string) => {
    if (get().todaySubscribed) return;
    set({ loading: true, todaySubscribed: true });
    const unsub = subscribeEntriesByDate(
      uid,
      today(),
      (entries) => {
        set({ todayEntries: entries, loading: false });
      },
      () => {
        // Firestore denied / errored — stop the spinner, show empty.
        set({ todayEntries: [], loading: false });
      },
    );
    set({ todayUnsubscribe: unsub });
  },

  unsubscribeToday: () => {
    const unsub = get().todayUnsubscribe;
    if (unsub) unsub();
    set({
      todayEntries: [],
      todaySubscribed: false,
      todayUnsubscribe: null,
      loading: false,
    });
  },

  wasCollectedToday: (customerId: string) =>
    get().todayEntries.some((e) => e.customerId === customerId),

  totalCollectedToday: () =>
    get().todayEntries.reduce((sum, e) => sum + e.amount, 0),
}));
