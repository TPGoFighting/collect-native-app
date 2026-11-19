/* global jest, describe, beforeEach, it, expect */
import {
  NUDGE_AFTER_ARTICLES,
  NUDGE_COUNT_KEY,
  NUDGE_SHOWN_KEY,
  markNudgeShown,
  recordArticleFinishedForNudge,
  shouldShowNudge,
} from '@/lib/notifications';

/**
 * In-memory emulation of the meta table used by the nudge counters, on top of
 * the jest.setup.js sqlite mock (same pattern as db-progress-backup.test.tsx).
 */
const meta = new Map<string, string>();

jest.mock('expo-sqlite', () => {
  const db = {
    execSync: jest.fn(),
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    getAllSync: jest.fn(() => []),
  };
  return { openDatabaseSync: jest.fn(() => db) };
});

const sqlite = require('expo-sqlite') as { openDatabaseSync: jest.Mock };
const db = sqlite.openDatabaseSync('collect.db') as {
  getFirstSync: jest.Mock;
  runSync: jest.Mock;
};

function simulateMetaSql(): void {
  db.getFirstSync.mockImplementation((sql: string, params: unknown[] = []) => {
    if (/SELECT value FROM meta WHERE key = \?/.exec(sql)) {
      const key = params[0] as string;
      return meta.has(key) ? { value: meta.get(key) } : null;
    }
    return null;
  });
  db.runSync.mockImplementation((sql: string, params: unknown[] = []) => {
    if (/INSERT INTO meta/.exec(sql)) {
      const [key, value] = params as [string, string];
      meta.set(key, value);
    }
    if (/DELETE FROM user_state/.exec(sql)) {
      meta.delete(params[0] as string);
    }
  });
}

beforeEach(() => {
  meta.clear();
  simulateMetaSql();
});

describe('shouldShowNudge (pure logic)', () => {
  it('shows exactly at the 3rd article', () => {
    expect(NUDGE_AFTER_ARTICLES).toBe(3);
    expect(shouldShowNudge(1, false, false)).toBe(false);
    expect(shouldShowNudge(2, false, false)).toBe(false);
    expect(shouldShowNudge(3, false, false)).toBe(true);
    expect(shouldShowNudge(4, false, false)).toBe(true);
  });

  it('never shows once shown', () => {
    expect(shouldShowNudge(3, true, false)).toBe(false);
    expect(shouldShowNudge(10, true, false)).toBe(false);
  });

  it('never shows for already-granted users', () => {
    expect(shouldShowNudge(3, false, true)).toBe(false);
    expect(shouldShowNudge(10, false, true)).toBe(false);
  });
});

describe('recordArticleFinishedForNudge', () => {
  it('counts distinct finished articles and triggers at the 3rd', () => {
    expect(recordArticleFinishedForNudge('a', false)).toBe(false);
    expect(recordArticleFinishedForNudge('b', false)).toBe(false);
    expect(recordArticleFinishedForNudge('c', false)).toBe(true);
    expect(Number(meta.get(NUDGE_COUNT_KEY))).toBe(3);
  });

  it('does not double-count re-reads of the same article', () => {
    recordArticleFinishedForNudge('a', false);
    recordArticleFinishedForNudge('b', false);
    expect(recordArticleFinishedForNudge('a', false)).toBe(false);
    expect(Number(meta.get(NUDGE_COUNT_KEY))).toBe(2);
  });

  it('never triggers while counting for already-granted users, but keeps counting', () => {
    expect(recordArticleFinishedForNudge('a', true)).toBe(false);
    expect(recordArticleFinishedForNudge('b', true)).toBe(false);
    expect(recordArticleFinishedForNudge('c', true)).toBe(false);
    expect(Number(meta.get(NUDGE_COUNT_KEY))).toBe(3);
  });

  it('marks shown and never triggers again after markNudgeShown', () => {
    recordArticleFinishedForNudge('a', false);
    recordArticleFinishedForNudge('b', false);
    expect(recordArticleFinishedForNudge('c', false)).toBe(true);
    markNudgeShown();
    expect(meta.get(NUDGE_SHOWN_KEY)).toBe('1');
    expect(recordArticleFinishedForNudge('d', false)).toBe(false);
    expect(recordArticleFinishedForNudge('e', false)).toBe(false);
  });
});
