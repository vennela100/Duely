import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { snapshot, replaceAll } from './localdb';
import { today as todayISO } from '@/utils/date';
import type { Customer, CollectionEntry } from '@/types';

// Per-user Google Drive backup. Each user signs in with THEIR OWN Google account;
// the app creates a "Duely Backups" folder in their Drive and stores dated JSON
// snapshots there. Scope = drive.file → the app can only see files it created
// (cannot read the user's other Drive files). A second cloud copy alongside
// Firebase; fully free (each user's own Drive).

const WEB_CLIENT_ID = '563456704724-94avdhp06auuol8qsl9fhg29332ghcrd.apps.googleusercontent.com';
const FOLDER_NAME = 'Duely Backups';
const FOLDER_KEY = 'fl:driveFolderId';
const LINKED_KEY = 'fl:driveLinked';
const LAST_KEY = 'fl:driveLastBackup';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let configured = false;
const configure = () => {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, scopes: [DRIVE_SCOPE] });
  configured = true;
};

type Data = { customers: Customer[]; collections: CollectionEntry[] };

const driveFetch = async (token: string, url: string, init: RequestInit = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Drive ${res.status}: ${await res.text().catch(() => '')}`);
  return res;
};

// --- auth ---

export const connectDrive = async (): Promise<{ email: string | null }> => {
  configure();
  await GoogleSignin.hasPlayServices();
  const info = await GoogleSignin.signIn();
  await AsyncStorage.setItem(LINKED_KEY, '1');
  // userInfo shape differs across versions — read defensively.
  const email =
    (info as { data?: { user?: { email?: string } } })?.data?.user?.email ??
    (info as { user?: { email?: string } })?.user?.email ??
    null;
  return { email };
};

export const disconnectDrive = async (): Promise<void> => {
  configure();
  try { await GoogleSignin.signOut(); } catch { /* ignore */ }
  await AsyncStorage.multiRemove([LINKED_KEY, FOLDER_KEY]);
};

export const isDriveLinked = async (): Promise<boolean> =>
  (await AsyncStorage.getItem(LINKED_KEY)) === '1';

const accessToken = async (): Promise<string> => {
  configure();
  await GoogleSignin.signInSilently();
  const { accessToken: tok } = await GoogleSignin.getTokens();
  return tok;
};

// --- folder ---

const ensureFolder = async (token: string): Promise<string> => {
  const cached = await AsyncStorage.getItem(FOLDER_KEY);
  if (cached) return cached;
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`);
  const found = (await res.json()).files as { id: string }[];
  let id = found?.[0]?.id;
  if (!id) {
    const create = await driveFetch(token, 'https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    id = (await create.json()).id;
  }
  await AsyncStorage.setItem(FOLDER_KEY, id);
  return id;
};

const findFile = async (token: string, folderId: string, name: string): Promise<string | null> => {
  const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
  const files = (await res.json()).files as { id: string }[];
  return files?.[0]?.id ?? null;
};

// --- backup / restore ---

const buildPayload = (data: Data) => JSON.stringify({
  app: 'Duely',
  schema: 1,
  exportedAt: new Date().toISOString(),
  counts: { customers: data.customers.length, collections: data.collections.length },
  data,
});

export const uploadDriveBackup = async (date = todayISO()): Promise<void> => {
  const token = await accessToken();
  const folderId = await ensureFolder(token);
  const name = `duely-backup-${date}.json`;
  const body = buildPayload(await snapshot());
  const existing = await findFile(token, folderId, name);

  if (existing) {
    await driveFetch(token, `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } else {
    const boundary = 'duelybnd' + Date.now();
    const metadata = JSON.stringify({ name, parents: [folderId] });
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
    await driveFetch(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
  }
  await AsyncStorage.setItem(LAST_KEY, date);
};

// Daily, silent. No-op if already done today or not linked.
export const maybeDailyDriveBackup = async (): Promise<void> => {
  try {
    if (!(await isDriveLinked())) return;
    if ((await AsyncStorage.getItem(LAST_KEY)) === todayISO()) return;
    await uploadDriveBackup();
  } catch {
    /* never crash the app */
  }
};

export const listDriveBackups = async (): Promise<{ id: string; date: string }[]> => {
  const token = await accessToken();
  const folderId = await ensureFolder(token);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&orderBy=name desc`);
  const files = (await res.json()).files as { id: string; name: string }[];
  return (files ?? [])
    .filter((f) => f.name.startsWith('duely-backup-'))
    .map((f) => ({ id: f.id, date: f.name.replace('duely-backup-', '').replace('.json', '') }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

const restoreFile = async (token: string, fileId: string): Promise<{ ok: boolean; reason?: string }> => {
  const res = await driveFetch(token, `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  const parsed = JSON.parse(await res.text()) as { data?: Data };
  if (!parsed.data || !Array.isArray(parsed.data.customers) || !Array.isArray(parsed.data.collections)) {
    return { ok: false, reason: 'Not a valid Duely backup' };
  }
  await replaceAll(parsed.data.customers, parsed.data.collections);
  return { ok: true };
};

export const restoreDriveBackup = async (fileId: string): Promise<{ ok: boolean; reason?: string }> => {
  try {
    return await restoreFile(await accessToken(), fileId);
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
};

export const restoreLatestDrive = async (): Promise<{ ok: boolean; reason?: string }> => {
  try {
    const list = await listDriveBackups();
    if (list.length === 0) return { ok: false, reason: 'No Drive backup found' };
    return await restoreFile(await accessToken(), list[0].id);
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
};
