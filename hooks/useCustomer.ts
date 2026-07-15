import { useCustomersStore } from '@/store/customers.store';
import type { Customer } from '@/types';

export const useCustomer = (id: string): Customer | undefined =>
  useCustomersStore((s) => s.customers.find((c) => c.id === id));
