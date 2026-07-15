import type { Customer, NewCustomerInput } from '@/types';
import { calcDailyAmount, calcEndDate, deriveStatus } from '@/utils/calc';
import { today as todayISO } from '@/utils/date';
import { normalizePhone } from '@/utils/format';
import {
  getCustomers,
  insertCustomer,
  onCustomers,
  patchCustomer,
  removeCustomerById,
  ready,
  genId,
} from './localdb';

// Local-storage backed. `uid` is accepted for signature compatibility but unused
// (single-device app — no multi-tenant separation needed).

export const createCustomer = async (
  _uid: string,
  input: NewCustomerInput,
): Promise<string> => {
  const startDate = input.deal.startDate || todayISO();
  const dailyAmount = calcDailyAmount(input.deal.dealAmount, input.deal.collectionDays);
  const endDate = calcEndDate(startDate, input.deal.collectionDays);
  const now = new Date().toISOString();
  const id = genId();

  const customer: Customer = {
    id,
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    phoneRaw: input.phoneRaw || input.phone,
    address: input.address,
    photo: input.photo,
    notes: input.notes,
    dealAmount: input.deal.dealAmount,
    givenAmount: input.deal.givenAmount,
    dailyAmount,
    collectionDays: input.deal.collectionDays,
    startDate,
    endDate,
    status: 'active',
    totalCollected: 0,
    daysCollected: 0,
    createdAt: now,
    updatedAt: now,
  };

  await insertCustomer(customer);
  return id;
};

export const updateCustomer = async (
  _uid: string,
  id: string,
  patch: Partial<Customer>,
): Promise<void> => {
  await patchCustomer(id, { ...patch, updatedAt: new Date().toISOString() });
};

export const deleteCustomer = async (_uid: string, id: string): Promise<void> => {
  await removeCustomerById(id);
};

const withDerivedStatus = (c: Customer): Customer => ({
  ...c,
  status: deriveStatus({
    dealAmount: c.dealAmount,
    totalCollected: c.totalCollected,
    status: c.status,
  }),
});

export const subscribeCustomers = (
  _uid: string,
  cb: (customers: Customer[]) => void,
  _onError?: (e: Error) => void,
): (() => void) => {
  const emit = () => cb(getCustomers().map(withDerivedStatus));
  const unsub = onCustomers(emit);
  ready().then(emit);
  return unsub;
};

export const fetchCustomersOnce = async (_uid: string): Promise<Customer[]> => {
  await ready();
  return getCustomers().map(withDerivedStatus);
};
