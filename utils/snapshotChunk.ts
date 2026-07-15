// Pure helpers for cloud snapshot storage. Kept dependency-free (no firebase)
// so they can be unit-tested in isolation. Used by services/cloudSync.ts to
// split a large JSON snapshot across multiple Firestore docs (1 MB each cap)
// and rejoin them on read, plus a stable content signature for dedupe.

export const CHUNK_CHARS = 400_000; // safe margin under Firestore's 1 MB doc cap

export const splitChunks = (s: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += CHUNK_CHARS) out.push(s.slice(i, i + CHUNK_CHARS));
  return out.length ? out : [''];
};

// Rejoin chunk records (each { i, part }) back into the original string, in order.
export const joinChunks = (chunks: { i: number; part: string }[]): string =>
  [...chunks].sort((a, b) => a.i - b.i).map((c) => c.part).join('');

// Cheap change-detection fingerprint. Avoids JSON.stringify-ing the whole
// dataset on every edit (which froze the UI with thousands of entries). Customer
// edits always bump `updatedAt`; collections are append-only (new id), so hashing
// id + updatedAt + totalCollected + counts reliably detects any real change.
export const dataSignature = (
  customers: { id?: string; updatedAt?: string; totalCollected?: number }[],
  collections: { id?: string }[],
): string => {
  let h = 0;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  };
  for (const c of customers) mix(`${c.id}|${c.updatedAt}|${c.totalCollected}`);
  for (const e of collections) mix(`${e.id}`);
  return `${customers.length}:${collections.length}:${h}`;
};
