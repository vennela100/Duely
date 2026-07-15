import { useCallback, useEffect } from 'react';
import { useCustomersStore } from '@/store/customers.store';
import { useUIStore } from '@/store/ui.store';
import { fetchCustomersOnce } from '@/services/customers.service';
import type { Customer } from '@/types';

interface UseCustomersResult {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  getById: (id: string) => Customer | undefined;
  refresh: () => Promise<void>;
}

export const useCustomers = (): UseCustomersResult => {
  const user = useUIStore((s) => s.user);
  const customers = useCustomersStore((s) => s.customers);
  const loading = useCustomersStore((s) => s.loading);
  const error = useCustomersStore((s) => s.error);
  const subscribe = useCustomersStore((s) => s.subscribe);
  const unsubscribeAll = useCustomersStore((s) => s.unsubscribeAll);
  const getById = useCustomersStore((s) => s.getById);

  useEffect(() => {
    if (!user) {
      unsubscribeAll();
      return;
    }
    subscribe(user.uid);
    return () => {
      unsubscribeAll();
    };
  }, [user, subscribe, unsubscribeAll]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const list = await fetchCustomersOnce(user.uid);
    useCustomersStore.setState({ customers: list });
  }, [user]);

  return { customers, loading, error, getById, refresh };
};
