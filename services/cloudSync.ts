import {
  doc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './firebase';
import { snapshot, replaceAll, onCustomers, onCollections, genId } from './localdb';
import { today as todayISO } from '@/utils/date';
import { splitChunks, joinChunks, dataSignature } from '@/utils/snapshotChunk';
import type { Customer, CollectionEntry } from '@/types';

// Cloud mirror of the local data layer (Firestore). Local-first: the phone is
// the source of truth; this pushes changes up (debounced) and pulls a newer
// cloud copy on launch. Last-write-wins by version (push timestamp). Snapshots
// are chunked so they never hit Firestore's 1 MB per-document limit.

const VERSION_KEY = 'fl:syncVersion';
const SIG_KEY = 'fl:syncSig';
const DEVICE_KEY = 'fl:deviceId';

type Data = { customers: Customer[]; collections: CollectionEntry[] };
interface SnapshotHeader {
  schema: number;
  version: number;
  updatedAt: string;
  deviceId: string;
  chunkCount: number;
  counts: { customers: number; collections: number };
}

let deviceId = '';
const getDeviceId = async (): Promise<string> => {
  if (deviceId) return deviceId;
  let v = await AsyncStorage.getItem(DEVICE_KEY);
  if (!v) {
    v = genId();
    await AsyncStorage.setItem(DEVICE_KEY, v);
  }
  deviceId = v;
  return v;
};

const signature = (d: Data) => dataSignature(d.customers, d.collections);

// --- generic chunked snapshot read/write at an arbitrary doc path ---

const writeSnapshot = async (
  path: string[],
  data: Data,
  version: number,
): Promise<void> => {
  const headerRef = doc(db, path[0], ...path.slice(1));
  const chunksColl = collection(db, ...(path as [string, ...string[]]), 'chunks');
  const parts = splitChunks(JSON.stringify(data));

  const batch = writeBatch(db);
  // Clear any previous chunks (snapshot may now be smaller).
  const existing = await getDocs(chunksColl);
  existing.forEach((d) => batch.delete(d.ref));
  parts.forEach((part, i) => batch.set(doc(chunksColl, String(i)), { i, part }));
  const header: SnapshotHeader = {
    schema: 1,
    version,
    updatedAt: new Date().toISOString(),
    deviceId: await getDeviceId(),
    chunkCount: parts.length,
    counts: { customers: data.customers.length, collections: data.collections.length },
  };
  batch.set(headerRef, header);
  await batch.commit();
};

const readSnapshot = async (
  path: string[],
): Promise<{ header: SnapshotHeader; data: Data } | null> => {
  const headerSnap = await getDoc(doc(db, path[0], ...path.slice(1)));
  if (!headerSnap.exists()) return null;
  const header = headerSnap.data() as SnapshotHeader;
  const chunksColl = collection(db, ...(path as [string, ...string[]]), 'chunks');
  const chunkDocs = await getDocs(chunksColl);
  const joined = joinChunks(chunkDocs.docs.map((d) => d.data() as { i: number; part: string }));
  try {
    const data = JSON.parse(joined) as Data;
    return { header, data };
  } catch {
    return null;
  }
};

// --- live mirror + dated backups ---

const livePath = (uid: string) => ['owners', uid, 'state', 'live'];
const backupPath = (uid: string, date: string) => ['owners', uid, 'backups', date];

const localVersion = async (): Promise<number> =>
  Number((await AsyncStorage.getItem(VERSION_KEY)) ?? '0');

// Pull cloud → local if the cloud copy is newer. Returns true if it replaced local.
export const pullIfNewer = async (uid: string): Promise<boolean> => {
  const cloud = await readSnapshot(livePath(uid));
  if (!cloud) return false;
  if (cloud.header.version > (await localVersion())) {
    await replaceAll(cloud.data.customers, cloud.data.collections);
    await AsyncStorage.multiSet([
      [VERSION_KEY, String(cloud.header.version)],
      [SIG_KEY, signature(cloud.data)],
    ]);
    return true;
  }
  return false;
};

// Push local → cloud live mirror. Skips when nothing changed since last push.
export const pushLive = async (uid: string): Promise<void> => {
  const data = await snapshot();
  const sig = signature(data);
  if (sig === (await AsyncStorage.getItem(SIG_KEY))) return; // no change
  const version = Date.now();
  await writeSnapshot(livePath(uid), data, version);
  await AsyncStorage.multiSet([[VERSION_KEY, String(version)], [SIG_KEY, sig]]);
};

// Write today's dated backup snapshot (dedupes vs the latest existing one).
export const pushDailyBackup = async (uid: string, date = todayISO()): Promise<void> => {
  const data = await snapshot();
  const existing = await readSnapshot(backupPath(uid, date));
  if (existing && signature(existing.data) === signature(data)) return;
  await writeSnapshot(backupPath(uid, date), data, Date.now());
};

// List dated cloud backups (newest first).
export const listCloudBackups = async (uid: string): Promise<{ date: string; counts: SnapshotHeader['counts'] }[]> => {
  const coll = collection(db, 'owners', uid, 'backups');
  const docs = await getDocs(coll);
  return docs.docs
    .map((d) => ({ date: d.id, counts: (d.data() as SnapshotHeader).counts }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

// One-tap recovery: pull the latest live cloud copy into local (replaces all).
// Use after data loss / fresh install on the same account.
export const restoreLatestCloud = async (uid: string): Promise<{ ok: boolean; reason?: string }> => {
  const cloud = await readSnapshot(livePath(uid));
  if (!cloud) return { ok: false, reason: 'No cloud data yet' };
  await replaceAll(cloud.data.customers, cloud.data.collections);
  await AsyncStorage.multiSet([
    [VERSION_KEY, String(cloud.header.version)],
    [SIG_KEY, signature(cloud.data)],
  ]);
  return { ok: true };
};

// Restore a dated cloud backup into local (replaces all local data).
export const restoreCloudBackup = async (uid: string, date: string): Promise<{ ok: boolean; reason?: string }> => {
  const snap = await readSnapshot(backupPath(uid, date));
  if (!snap) return { ok: false, reason: 'Backup not found in cloud' };
  await replaceAll(snap.data.customers, snap.data.collections);
  const version = Date.now();
  await AsyncStorage.multiSet([[VERSION_KEY, String(version)], [SIG_KEY, signature(snap.data)]]);
  return { ok: true };
};

// --- live change subscription (debounced push) ---

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void)[] = [];

export const startSync = (uid: string, onStatus?: (s: 'syncing' | 'synced' | 'error') => void): (() => void) => {
  const schedule = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        onStatus?.('syncing');
        await pushLive(uid);
        onStatus?.('synced');
      } catch {
        onStatus?.('error');
      }
    }, 2000);
  };
  unsub = [onCustomers(schedule), onCollections(schedule)];
  return () => {
    if (pushTimer) clearTimeout(pushTimer);
    unsub.forEach((u) => u());
    unsub = [];
  };
};

// One-shot initial sync after sign-in. If the cloud has a copy and local is
// empty (e.g. just signed in on a fresh/cleared device) or older, PULL it down
// so the user gets their data back. Otherwise push local up. Then ensure today's
// dated backup exists.
export const initialSync = async (uid: string): Promise<void> => {
  const cloud = await readSnapshot(livePath(uid));
  if (cloud) {
    const local = await snapshot();
    const localEmpty = local.customers.length === 0 && local.collections.length === 0;
    if (localEmpty || cloud.header.version > (await localVersion())) {
      await replaceAll(cloud.data.customers, cloud.data.collections);
      await AsyncStorage.multiSet([
        [VERSION_KEY, String(cloud.header.version)],
        [SIG_KEY, signature(cloud.data)],
      ]);
    } else {
      await pushLive(uid);
    }
  } else {
    await pushLive(uid);
  }
  await pushDailyBackup(uid).catch(() => {});
};

// Clear local sync bookkeeping so the next sign-in pulls cloud (used on Sign out).
export const resetSyncState = async (): Promise<void> => {
  await AsyncStorage.multiRemove([VERSION_KEY, SIG_KEY]);
};
