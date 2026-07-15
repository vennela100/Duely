import { splitChunks, joinChunks, dataSignature, CHUNK_CHARS } from '../snapshotChunk';

describe('snapshot chunking (cloud 1MB-limit guard)', () => {
  it('round-trips a small string in one chunk', () => {
    const s = JSON.stringify({ a: 1, b: 'hello' });
    const parts = splitChunks(s);
    expect(parts).toHaveLength(1);
    const rejoined = joinChunks(parts.map((part, i) => ({ i, part })));
    expect(rejoined).toBe(s);
  });

  it('never produces zero chunks (empty string → one empty chunk)', () => {
    expect(splitChunks('')).toEqual(['']);
  });

  it('splits a large string into multiple chunks and rejoins exactly', () => {
    const big = 'x'.repeat(CHUNK_CHARS * 2 + 123);
    const parts = splitChunks(big);
    expect(parts.length).toBe(3);
    expect(parts.every((p) => p.length <= CHUNK_CHARS)).toBe(true);
    const rejoined = joinChunks(parts.map((part, i) => ({ i, part })));
    expect(rejoined).toBe(big);
  });

  it('rejoins chunks regardless of stored order', () => {
    const s = 'a'.repeat(CHUNK_CHARS) + 'b'.repeat(CHUNK_CHARS) + 'c';
    const parts = splitChunks(s);
    const shuffled = parts.map((part, i) => ({ i, part })).reverse();
    expect(joinChunks(shuffled)).toBe(s);
  });

  it('round-trips a realistic JSON snapshot', () => {
    const data = {
      customers: Array.from({ length: 500 }, (_, i) => ({ id: `c${i}`, name: `नाम ${i}`, dealAmount: i * 100 })),
      collections: Array.from({ length: 3000 }, (_, i) => ({ id: `e${i}`, amount: i, date: '2026-06-14' })),
    };
    const json = JSON.stringify(data);
    const rejoined = joinChunks(splitChunks(json).map((part, i) => ({ i, part })));
    expect(JSON.parse(rejoined)).toEqual(data);
  });
});

describe('dataSignature (change-detection / dedupe)', () => {
  it('is identical for identical data', () => {
    const a = dataSignature([{ id: 'a', updatedAt: 't1', totalCollected: 10 }], [{ id: 'e1' }]);
    const b = dataSignature([{ id: 'a', updatedAt: 't1', totalCollected: 10 }], [{ id: 'e1' }]);
    expect(a).toBe(b);
  });

  it('changes when a customer is edited (updatedAt bumps)', () => {
    const a = dataSignature([{ id: 'a', updatedAt: 't1', totalCollected: 10 }], []);
    const b = dataSignature([{ id: 'a', updatedAt: 't2', totalCollected: 10 }], []);
    expect(a).not.toBe(b);
  });

  it('changes when a collection is added', () => {
    const a = dataSignature([{ id: 'a' }], [{ id: 'e1' }]);
    const b = dataSignature([{ id: 'a' }], [{ id: 'e1' }, { id: 'e2' }]);
    expect(a).not.toBe(b);
  });

  it('changes when totalCollected changes', () => {
    const a = dataSignature([{ id: 'a', updatedAt: 't1', totalCollected: 10 }], []);
    const b = dataSignature([{ id: 'a', updatedAt: 't1', totalCollected: 20 }], []);
    expect(a).not.toBe(b);
  });

  it('distinguishes customers from collections', () => {
    expect(dataSignature([{ id: 'x' }], [])).not.toBe(dataSignature([], [{ id: 'x' }]));
  });
});
