import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer, CollectionEntry } from '@/types';
import { snapshot, replaceAll } from './localdb';
import { today as todayISO } from '@/utils/date';

// Fully local, on-device daily backup. Independent of Firebase / any network.
// Writes a dated JSON snapshot to the app's document directory (survives app
// restarts; removed only if the app is uninstalled). Keeps the last N days and
// can export a copy off-device (Drive / WhatsApp / email) or restore from any
// kept file. This is the safety net if cloud sync is ever added and breaks.

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;
const LAST_BACKUP_KEY = 'fl:lastBackupDate';
const SCHEMA = 1;

export interface BackupFile {
  name: string;
  uri: string;
  date: string; // yyyy-MM-dd parsed from filename
  size: number;
}

interface BackupPayload {
  app: 'Duely';
  schema: number;
  exportedAt: string;
  counts: { customers: number; collections: number };
  data: { customers: Customer[]; collections: CollectionEntry[] };
}

const ensureDir = async (): Promise<void> => {
  const info = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
};

const fileFor = (date: string) => `${BACKUP_DIR}duely-backup-${date}.json`;

// Read just the data payload from a backup file (for change-detection / restore).
const readData = async (
  uri: string,
): Promise<{ customers: Customer[]; collections: CollectionEntry[] } | null> => {
  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as Partial<BackupPayload>;
    if (parsed?.data && Array.isArray(parsed.data.customers) && Array.isArray(parsed.data.collections)) {
      return { customers: parsed.data.customers, collections: parsed.data.collections };
    }
  } catch {
    /* corrupt/unreadable — treat as no data */
  }
  return null;
};

// Stable content signature (ignores the exportedAt timestamp).
const signature = (c: Customer[], e: CollectionEntry[]) => JSON.stringify({ c, e });

// Write a full snapshot for the given day (defaults to today). Keeps the ENTIRE
// history — one file per date, never deleted. `dedupe` skips writing when the
// data is byte-identical to the most recent backup (avoids clutter on idle days).
export const createBackup = async (
  date = todayISO(),
  opts: { dedupe?: boolean } = {},
): Promise<BackupFile> => {
  await ensureDir();
  const { customers, collections } = await snapshot();

  if (opts.dedupe) {
    const latest = await latestBackup();
    if (latest) {
      const prev = await readData(latest.uri);
      if (prev && signature(prev.customers, prev.collections) === signature(customers, collections)) {
        // Nothing changed since the last backup — mark today checked, keep that file.
        await AsyncStorage.setItem(LAST_BACKUP_KEY, date);
        return latest;
      }
    }
  }

  const payload: BackupPayload = {
    app: 'Duely',
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    counts: { customers: customers.length, collections: collections.length },
    data: { customers, collections },
  };
  const uri = fileFor(date);
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload));
  await AsyncStorage.setItem(LAST_BACKUP_KEY, date);
  const info = await FileSystem.getInfoAsync(uri);
  return { name: `duely-backup-${date}.json`, uri, date, size: info.exists ? (info.size ?? 0) : 0 };
};

// Run once per calendar day. No-op if data is unchanged since the last backup.
export const maybeDailyBackup = async (): Promise<void> => {
  try {
    const last = await AsyncStorage.getItem(LAST_BACKUP_KEY);
    if (last === todayISO()) return;
    await createBackup(todayISO(), { dedupe: true });
  } catch {
    // Backup must never crash the app — fail silently.
  }
};

export const listBackups = async (): Promise<BackupFile[]> => {
  await ensureDir();
  const names = await FileSystem.readDirectoryAsync(BACKUP_DIR);
  const files: BackupFile[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const uri = `${BACKUP_DIR}${name}`;
    const info = await FileSystem.getInfoAsync(uri);
    const date = name.replace('duely-backup-', '').replace('.json', '');
    files.push({ name, uri, date, size: info.exists ? (info.size ?? 0) : 0 });
  }
  // Newest first.
  return files.sort((a, b) => b.date.localeCompare(a.date));
};

export const latestBackup = async (): Promise<BackupFile | null> => {
  const all = await listBackups();
  return all[0] ?? null;
};

// Share a backup file off-device (Drive, WhatsApp, email…). Defaults to latest.
export const exportBackup = async (uri?: string): Promise<{ ok: boolean; reason?: string }> => {
  const target = uri ?? (await latestBackup())?.uri ?? (await createBackup()).uri;
  if (!(await Sharing.isAvailableAsync())) {
    return { ok: false, reason: 'Sharing not available on this device' };
  }
  await Sharing.shareAsync(target, {
    mimeType: 'application/json',
    dialogTitle: 'Duely backup',
    UTI: 'public.json',
  });
  return { ok: true };
};

// Restore from a kept backup file. Replaces ALL current data.
export const restoreBackup = async (uri: string): Promise<{ ok: boolean; reason?: string }> => {
  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as Partial<BackupPayload>;
    const data = parsed?.data;
    if (!data || !Array.isArray(data.customers) || !Array.isArray(data.collections)) {
      return { ok: false, reason: 'Not a valid Duely backup file' };
    }
    await replaceAll(data.customers, data.collections);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
};
