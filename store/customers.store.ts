import { create } from 'zustand';
import type { Customer } from '@/types';
import { subscribeCustomers } from '@/services/customers.service';

interface CustomersState {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  subscribed: boolean;
  unsubscribe: (() => void) | null;
  subscribe: (uid: string) => void;
  unsubscribeAll: () => void;
  getById: (id: string) => Customer | undefined;
}

export const useCustomersStore = create<CustomersState>()((set, get) => ({
  customers: [],
  loading: false,
  error: null,
  subscribed: false,
  unsubscribe: null,

  subscribe: (uid: string) => {
    if (get().subscribed) return;
    set({ loading: true, error: null, subscribed: true });
    const unsub = subscribeCustomers(
      uid,
      (customers) => set({ customers, loading: false }),
      (e) => set({ error: e.message, loading: false }),
    );
    set({ unsubscribe: unsub });
  },

  unsubscribeAll: () => {
    const unsub = get().unsubscribe;
    if (unsub) unsub();
    set({
      customers: [],
      loading: false,
      error: null,
      subscribed: false,
      unsubscribe: null,
    });
  },

  getById: (id: string) => get().customers.find((c) => c.id === id),
}));
