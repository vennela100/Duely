import type { Customer, CollectionEntry } from '@/types';

// localdb keeps module-level cache state, so reset the module registry per test.
// AsyncStorage must be required from the SAME fresh registry as localdb, or the
// two would hold separate (empty) mock stores.
const freshDb = () => {
  jest.resetModules();
  const storage =
    require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage').default;
  const db = require('@/services/localdb') as typeof import('@/services/localdb');
  return { db, storage };
};

const makeCustomer = (over: Partial<Customer> = {}): Customer => ({
  id: 'c1',
  name: 'Ravi',
  phone: '+919876543210',
  phoneRaw: '9876543210',
  dealAmount: 10000,
  givenAmount: 8000,
  dailyAmount: 100,
  collectionDays: 100,
  startDate: '2026-01-01',
  endDate: '2026-04-10',
  status: 'active',
  totalCollected: 0,
  daysCollected: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
});

const makeEntry = (over: Partial<CollectionEntry> = {}): CollectionEntry => ({
  id: 'e1',
  customerId: 'c1',
  customerName: 'Ravi',
  amount: 100,
  date: '2026-01-02',
  collectedAt: '2026-01-02T10:00:00.000Z',
  method: 'cash',
  smsSent: false,
  dayNumber: 1,
  kind: 'received',
  ...over,
});

describe('genId', () => {
  it('returns unique ids', () => {
    const { db } = freshDb();
    const ids = new Set(Array.from({ length: 50 }, () => db.genId()));
    expect(ids.size).toBe(50);
  });
});

describe('customers', () => {
  it('inserts and reads back, persisting to storage', async () => {
    const { db, storage } = freshDb();
    await db.insertCustomer(makeCustomer());
    expect(db.getCustomers()).toHaveLength(1);
    expect(await storage.getItem('fl:customers')).toContain('Ravi');
  });

  it('prepends new customers', async () => {
    const { db } = freshDb();
    await db.insertCustomer(makeCustomer({ id: 'a' }));
    await db.insertCustomer(makeCustomer({ id: 'b' }));
    expect(db.getCustomers().map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('patches a customer by id', async () => {
    const { db } = freshDb();
    await db.insertCustomer(makeCustomer({ id: 'a', totalCollected: 0 }));
    await db.patchCustomer('a', { totalCollected: 500 });
    expect(db.getCustomers()[0].totalCollected).toBe(500);
  });

  it('removes a customer by id', async () => {
    const { db } = freshDb();
    await db.insertCustomer(makeCustomer({ id: 'a' }));
    await db.insertCustomer(makeCustomer({ id: 'b' }));
    await db.removeCustomerById('a');
    expect(db.getCustomers().map((c) => c.id)).toEqual(['b']);
  });

  it('notifies subscribers on change', async () => {
    const { db } = freshDb();
    const cb = jest.fn();
    const unsub = db.onCustomers(cb);
    await db.insertCustomer(makeCustomer());
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    await db.insertCustomer(makeCustomer({ id: 'c2' }));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('collections', () => {
  it('inserts an entry and patches the customer atomically', async () => {
    const { db } = freshDb();
    await db.insertCustomer(makeCustomer({ id: 'c1', totalCollected: 0 }));
    await db.insertCollection(makeEntry({ amount: 100 }), {
      id: 'c1',
      patch: { totalCollected: 100, daysCollected: 1 },
    });
    expect(db.getCollections()).toHaveLength(1);
    expect(db.getCustomers()[0].totalCollected).toBe(100);
    expect(db.getCustomers()[0].daysCollected).toBe(1);
  });

  it('notifies both customer and collection subscribers', async () => {
    const { db } = freshDb();
    await db.insertCustomer(makeCustomer({ id: 'c1' }));
    const onC = jest.fn();
    const onE = jest.fn();
    db.onCustomers(onC);
    db.onCollections(onE);
    await db.insertCollection(makeEntry(), { id: 'c1', patch: {} });
    expect(onC).toHaveBeenCalledTimes(1);
    expect(onE).toHaveBeenCalledTimes(1);
  });
});

describe('snapshot / replaceAll / clearAll', () => {
  it('snapshot returns current data', async () => {
    const { db } = freshDb();
    await db.insertCustomer(makeCustomer());
    const snap = await db.snapshot();
    expect(snap.customers).toHaveLength(1);
    expect(snap.collections).toHaveLength(0);
  });

  it('replaceAll swaps the whole store and persists', async () => {
    const { db, storage } = freshDb();
    await db.replaceAll([makeCustomer({ id: 'x' })], [makeEntry({ id: 'y' })]);
    expect(db.getCustomers().map((c) => c.id)).toEqual(['x']);
    expect(db.getCollections().map((e) => e.id)).toEqual(['y']);
    expect(await storage.getItem('fl:customers')).toContain('"x"');
  });

  it('clearAll empties everything', async () => {
    const { db } = freshDb();
    await db.insertCustomer(makeCustomer());
    await db.clearAll();
    expect(db.getCustomers()).toHaveLength(0);
    expect(db.getCollections()).toHaveLength(0);
  });

  it('loads pre-existing data from storage on first access', async () => {
    const { db, storage } = freshDb();
    await storage.setItem(
      'fl:customers',
      JSON.stringify([makeCustomer({ id: 'persisted' })]),
    );
    await db.ready();
    expect(db.getCustomers().map((c) => c.id)).toEqual(['persisted']);
  });
});
