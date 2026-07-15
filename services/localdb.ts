import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer, CollectionEntry } from '@/types';

// Fully local, single-device data layer. Replaces Firestore so the app works
// with zero auth / network / console setup. Persists to AsyncStorage and pushes
// changes to subscribers in-process (mimics onSnapshot realtime behaviour).

const CUSTOMERS_KEY = 'fl:customers';
const COLLECTIONS_KEY = 'fl:collections';

let customers: Customer[] | null = null;
let collections: CollectionEntry[] | null = null;

const customerListeners = new Set<() => void>();
const collectionListeners = new Set<() => void>();

let loadPromise: Promise<void> | null = null;

const load = async (): Promise<void> => {
  if (customers !== null && collections !== null) return;
  const [c, e] = await Promise.all([
    AsyncStorage.getItem(CUSTOMERS_KEY),
    AsyncStorage.getItem(COLLECTIONS_KEY),
  ]);
  customers = c ? (JSON.parse(c) as Customer[]) : [];
  collections = e ? (JSON.parse(e) as CollectionEntry[]) : [];
};

export const ready = (): Promise<void> => {
  if (!loadPromise) loadPromise = load();
  return loadPromise;
};

const persistCustomers = () =>
  AsyncStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers ?? []));
const persistCollections = () =>
  AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections ?? []));

const notifyCustomers = () => customerListeners.forEach((fn) => fn());
const notifyCollections = () => collectionListeners.forEach((fn) => fn());

export const genId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Bulk replace the whole store (used by backup restore). Updates the in-memory
// cache, persists, and notifies all subscribers so the UI reacts immediately.
export const replaceAll = async (
  nextCustomers: Customer[],
  nextCollections: CollectionEntry[],
): Promise<void> => {
  await ready();
  customers = nextCustomers;
  collections = nextCollections;
  await Promise.all([persistCustomers(), persistCollections()]);
  notifyCustomers();
  notifyCollections();
};

// Wipe everything (used by "Clear all data").
export const clearAll = (): Promise<void> => replaceAll([], []);

// Raw snapshot for the backup writer.
export const snapshot = async (): Promise<{
  customers: Customer[];
  collections: CollectionEntry[];
}> => {
  await ready();
  return { customers: customers ?? [], collections: collections ?? [] };
};

// --- customers ---

export const getCustomers = (): Customer[] => customers ?? [];

export const onCustomers = (cb: () => void): (() => void) => {
  customerListeners.add(cb);
  return () => customerListeners.delete(cb);
};

export const insertCustomer = async (c: Customer): Promise<void> => {
  await ready();
  customers = [c, ...(customers ?? [])];
  await persistCustomers();
  notifyCustomers();
};

export const patchCustomer = async (
  id: string,
  patch: Partial<Customer>,
): Promise<void> => {
  await ready();
  customers = (customers ?? []).map((c) =>
    c.id === id ? { ...c, ...patch } : c,
  );
  await persistCustomers();
  notifyCustomers();
};

export const removeCustomerById = async (id: string): Promise<void> => {
  await ready();
  customers = (customers ?? []).filter((c) => c.id !== id);
  await persistCustomers();
  notifyCustomers();
};

// --- collections ---

export const getCollections = (): CollectionEntry[] => collections ?? [];

export const onCollections = (cb: () => void): (() => void) => {
  collectionListeners.add(cb);
  return () => collectionListeners.delete(cb);
};

export const insertCollection = async (
  entry: CollectionEntry,
  customerPatch: { id: string; patch: Partial<Customer> },
): Promise<void> => {
  await ready();
  collections = [entry, ...(collections ?? [])];
  customers = (customers ?? []).map((c) =>
    c.id === customerPatch.id ? { ...c, ...customerPatch.patch } : c,
  );
  await Promise.all([persistCollections(), persistCustomers()]);
  notifyCollections();
  notifyCustomers();
};
