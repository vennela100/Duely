import type { CollectionEntry, Customer, PaymentMethod } from '@/types';
import { today as todayISO } from '@/utils/date';
import {
  getCollections,
  getCustomers,
  insertCollection,
  onCollections,
  ready,
  genId,
} from './localdb';

// Local-storage backed. `uid` accepted for signature compatibility, unused.

interface RecordParams {
  customer: Customer;
  amount: number;
  method: PaymentMethod;
  notes?: string;
  smsSent: boolean;
  date?: string;
}

export const recordCollection = async (
  _uid: string,
  params: RecordParams,
): Promise<CollectionEntry> => {
  await ready();
  const date = params.date || todayISO();
  const now = new Date().toISOString();

  const existing = getCustomers().find((c) => c.id === params.customer.id);
  if (!existing) throw new Error('Customer no longer exists');

  const newTotal = existing.totalCollected + params.amount;
  const newDays = existing.daysCollected + 1;
  const newStatus =
    newTotal >= existing.dealAmount ? 'completed' : existing.status;

  const entry: CollectionEntry = {
    id: genId(),
    customerId: params.customer.id,
    customerName: existing.name,
    amount: params.amount,
    date,
    collectedAt: now,
    method: params.method,
    notes: params.notes,
    smsSent: params.smsSent,
    dayNumber: newDays,
    kind: 'received',
  };

  await insertCollection(entry, {
    id: existing.id,
    patch: {
      totalCollected: newTotal,
      daysCollected: newDays,
      lastCollectionDate: date,
      status: newStatus,
      updatedAt: now,
    },
  });

  return entry;
};

interface GivenParams {
  customer: Customer;
  amount: number;
  notes?: string;
  date?: string;
}

// "Given" = you lent more money → raises the deal total and the balance due.
export const recordGiven = async (
  _uid: string,
  params: GivenParams,
): Promise<CollectionEntry> => {
  await ready();
  const date = params.date || todayISO();
  const now = new Date().toISOString();

  const existing = getCustomers().find((c) => c.id === params.customer.id);
  if (!existing) throw new Error('Customer no longer exists');

  const newDeal = existing.dealAmount + params.amount;

  const entry: CollectionEntry = {
    id: genId(),
    customerId: params.customer.id,
    customerName: existing.name,
    amount: params.amount,
    date,
    collectedAt: now,
    method: 'cash',
    notes: params.notes,
    smsSent: false,
    dayNumber: existing.daysCollected,
    kind: 'given',
  };

  await insertCollection(entry, {
    id: existing.id,
    patch: {
      dealAmount: newDeal,
      givenAmount: existing.givenAmount + params.amount,
      // Re-opening a settled account if you lend more.
      status: existing.status === 'completed' ? 'active' : existing.status,
      updatedAt: now,
    },
  });

  return entry;
};

const byCollectedAtDesc = (a: CollectionEntry, b: CollectionEntry) =>
  b.collectedAt.localeCompare(a.collectedAt);
const byDateDesc = (a: CollectionEntry, b: CollectionEntry) =>
  b.date.localeCompare(a.date);

export const subscribeCustomerEntries = (
  _uid: string,
  customerId: string,
  cb: (entries: CollectionEntry[]) => void,
  _onError?: (e: Error) => void,
): (() => void) => {
  const emit = () =>
    cb(
      getCollections()
        .filter((e) => e.customerId === customerId)
        .sort(byCollectedAtDesc),
    );
  const unsub = onCollections(emit);
  ready().then(emit);
  return unsub;
};

export const subscribeEntriesByDate = (
  _uid: string,
  date: string,
  cb: (entries: CollectionEntry[]) => void,
  _onError?: (e: Error) => void,
): (() => void) => {
  const emit = () => cb(getCollections().filter((e) => e.date === date));
  const unsub = onCollections(emit);
  ready().then(emit);
  return unsub;
};

export const subscribeEntriesInRange = (
  _uid: string,
  fromDate: string,
  toDate: string,
  cb: (entries: CollectionEntry[]) => void,
  _onError?: (e: Error) => void,
): (() => void) => {
  const emit = () =>
    cb(
      getCollections()
        .filter((e) => e.date >= fromDate && e.date <= toDate)
        .sort(byDateDesc),
    );
  const unsub = onCollections(emit);
  ready().then(emit);
  return unsub;
};

export const fetchEntriesInRange = async (
  _uid: string,
  fromDate: string,
  toDate: string,
): Promise<CollectionEntry[]> => {
  await ready();
  return getCollections()
    .filter((e) => e.date >= fromDate && e.date <= toDate)
    .sort(byDateDesc);
};
