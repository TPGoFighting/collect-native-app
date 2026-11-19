/* global jest, describe, beforeEach, it, expect */
import {
  clearProgress,
  exportUserData,
  getProgress,
  importUserData,
  ImportValidationError,
  listUnfinished,
  setProgress,
  USER_DATA_SCHEMA_VERSION,
} from '@/lib/db';

/**
 * In-memory user_state emulation on top of the jest.setup.js sqlite mock.
 * The setup mock returns fixed values; here we drive a real key/value store
 * through the same getFirstSync/getAllSync/runSync surface the lib uses.
 */
const store = new Map<string, string>();

type Row = Record<string, unknown>;

let rows: Row[] = [];

jest.mock('expo-sqlite', () => {
  const db = {
    execSync: jest.fn(),
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => ({ c: 0 })),
    getAllSync: jest.fn(() => [] as Row[]),
    withTransactionSync: jest.fn((task: () => void) => task()),
  };
  return { openDatabaseSync: jest.fn(() => db) };
});

const sqlite = require('expo-sqlite') as { openDatabaseSync: jest.Mock };
const db = sqlite.openDatabaseSync('collect.db') as {
  getFirstSync: jest.Mock;
  getAllSync: jest.Mock;
  runSync: jest.Mock;
  withTransactionSync: jest.Mock;
};

function simulateSql(): void {
  db.getFirstSync.mockImplementation((sql: string, params: unknown[] = []) => {
    const m = /SELECT value FROM user_state WHERE key = \?/.exec(sql);
    if (m) {
      const key = params[0] as string;
      return store.has(key) ? { value: store.get(key) } : null;
    }
    if (/SELECT COUNT\(\*\)/.exec(sql)) return { c: 0 };
    return null;
  });
  db.getAllSync.mockImplementation((sql: string, params: unknown[] = []) => {
    if (/key LIKE 'fav:%'/.exec(sql)) {
      const rowsOut: Row[] = [];
      for (const [k, v] of store) {
        if (k.startsWith('fav:')) rowsOut.push({ key: k, value: v });
      }
      return rowsOut.filter((r) => !sql.includes("value='1'") || r.value === '1');
    }
    if (/key LIKE 'read:%'/.exec(sql)) {
      const rowsOut: Row[] = [];
      for (const [k, v] of store) {
        if (k.startsWith('read:')) rowsOut.push({ key: k, value: v });
      }
      return rowsOut;
    }
    if (/key LIKE 'progress:%'/.exec(sql)) {
      const rowsOut: Row[] = [];
      for (const [k, v] of store) {
        if (k.startsWith('progress:')) rowsOut.push({ key: k, value: v });
      }
      return rowsOut;
    }
    if (/FROM articles WHERE id IN/.exec(sql)) {
      return rows.filter((r) => (params as string[]).includes(r.id as string));
    }
    return [];
  });
  db.runSync.mockImplementation((sql: string, params: unknown[] = []) => {
    const insert = /INSERT INTO user_state\(key,value\) VALUES\(\?\,\?\) ON CONFLICT/.exec(sql);
    if (insert) {
      store.set(params[0] as string, params[1] as string);
      return;
    }
    if (/DELETE FROM user_state WHERE key = \?/.exec(sql)) {
      store.delete(params[0] as string);
      return;
    }
    if (/DELETE FROM user_state WHERE key LIKE 'read:%'/.exec(sql)) {
      for (const k of [...store.keys()]) {
        if (k.startsWith('read:') || k === 'history') store.delete(k);
      }
    }
  });
  db.withTransactionSync.mockImplementation((task: () => void) => task());
}

function seedArticle(id: string): void {
  rows = rows.filter((r) => r.id !== id);
  rows.push({ id, title: `T-${id}`, author: 'a', date: '2025-01-01' });
}

describe('reading progress', () => {
  beforeAll(simulateSql);
  beforeEach(() => {
    store.clear();
    rows = [];
    db.runSync.mockClear();
  });

  it('stores and reads progress round-trip', () => {
    setProgress('a1', 0.42);
    expect(getProgress('a1')).toBeCloseTo(0.42);
  });

  it('returns null for unknown article and invalid values', () => {
    expect(getProgress('nope')).toBeNull();
    store.set('progress:bad', 'not-json');
    expect(getProgress('bad')).toBeNull();
    store.set('progress:oob', JSON.stringify({ progress: 1.5 }));
    expect(getProgress('oob')).toBeNull();
  });

  it('clears progress', () => {
    setProgress('a1', 0.3);
    clearProgress('a1');
    expect(getProgress('a1')).toBeNull();
  });

  it('lists unfinished articles sorted by progress, excluding done/zero', () => {
    seedArticle('a1');
    seedArticle('a2');
    seedArticle('a3');
    setProgress('a1', 0.2);
    setProgress('a2', 0.6);
    setProgress('a3', 0.95); // done, excluded
    const list = listUnfinished();
    expect(list.map((x) => x.meta.id)).toEqual(['a2', 'a1']);
    expect(list[0].progress).toBeCloseTo(0.6);
  });
});

describe('user data export / import', () => {
  beforeAll(simulateSql);
  beforeEach(() => {
    store.clear();
    rows = [];
    seedArticle('a1');
    seedArticle('a2');
  });

  it('exports favorites, read, history, search, recommend and progress with schema_version', () => {
    store.set('fav:a1', '1');
    store.set('read:a2', '2025-01-01T00:00:00.000Z');
    store.set('history', JSON.stringify(['a2', 'a1']));
    store.set('search_history', JSON.stringify(['kw']));
    store.set('recommend', JSON.stringify([{ url: 'https://x.com/1', note: 'n', ts: 1 }]));
    setProgress('a1', 0.5);
    const data = exportUserData();
    expect(data.schema_version).toBe(USER_DATA_SCHEMA_VERSION);
    expect(data.favorites).toEqual(['a1']);
    expect(data.read).toEqual(['a2']);
    expect(data.history).toEqual(['a2', 'a1']);
    expect(data.search_history).toEqual(['kw']);
    expect(data.recommend).toHaveLength(1);
    expect(data.progress.a1).toBeCloseTo(0.5);
  });

  it('imports a backup and restores favorites/read/history', () => {
    store.set('fav:a1', '1');
    store.set('read:a2', '2025-01-01T00:00:00.000Z');
    store.set('history', JSON.stringify(['a2', 'a1']));
    store.set('search_history', JSON.stringify(['kw']));
    store.set('recommend', JSON.stringify([{ url: 'https://x.com/1', note: 'n', ts: 1 }]));
    setProgress('a1', 0.5);
    const data = JSON.stringify(exportUserData());
    store.clear();
    const res = importUserData(data);
    expect(res.favorites).toBe(1);
    expect(res.read).toBe(1);
    expect(store.get('fav:a1')).toBe('1');
    expect(store.has('read:a2')).toBe(true);
    expect(getProgress('a1')).toBeCloseTo(0.5);
  });

  it('dedupes by article id on re-import', () => {
    store.set('fav:a1', '1');
    const res = importUserData(JSON.stringify({ ...exportUserData(), favorites: ['a1', 'a2'] }));
    expect(res.favorites).toBe(1); // only a2 is new
  });

  it('rejects corrupted JSON without touching the store', () => {
    store.set('fav:a1', '1');
    expect(() => importUserData('{not json')).toThrow(ImportValidationError);
    expect(store.get('fav:a1')).toBe('1');
    expect(store.size).toBe(1);
  });

  it('rejects wrong schema_version without touching the store', () => {
    store.set('fav:a1', '1');
    expect(() =>
      importUserData(JSON.stringify({ schema_version: 99, favorites: ['a2'] })),
    ).toThrow(ImportValidationError);
    expect(store.has('fav:a2')).toBe(false);
  });

  it('drops malformed recommend entries instead of failing', () => {
    const res = importUserData(
      JSON.stringify({
        schema_version: USER_DATA_SCHEMA_VERSION,
        favorites: [],
        read: [],
        history: [],
        search_history: [],
        recommend: [{ url: 'https://ok.com', note: '', ts: 5 }, 'garbage', { url: 42 }],
        progress: {},
      }),
    );
    expect(res.recommend).toBe(1);
  });
});
