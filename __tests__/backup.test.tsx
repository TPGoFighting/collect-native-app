/* global jest, describe, beforeEach, it, expect */
import { restoreBackup, shareBackup } from '@/lib/backup';
import { shareAsync } from 'expo-sharing';
import { getDocumentAsync } from 'expo-document-picker';
import { importUserData } from '@/lib/db';

jest.mock('expo-sharing', () => ({ __esModule: true, shareAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: jest.fn(),
}));
jest.mock('@/lib/db', () => ({
  __esModule: true,
  exportUserData: jest.fn(() => ({ schema_version: 1, favorites: ['a1'] })),
  importUserData: jest.fn(),
}));
jest.mock('expo-file-system', () => {
  const state = { text: '' };
  const File = jest.fn().mockImplementation(() => ({
    uri: 'file:///cache/backup.json',
    exists: true,
    writeSync: (t: string) => {
      state.text = t;
    },
    textSync: () => state.text,
    delete: function (this: { exists: boolean }) {
      this.exists = false;
    },
  }));
  return { File, Paths: { cache: {} } };
});

const mockShareAsync = jest.mocked(shareAsync);
const mockGetDocumentAsync = jest.mocked(getDocumentAsync);
const mockImport = jest.mocked(importUserData);

describe('backup share / restore', () => {
  beforeEach(() => {
    mockShareAsync.mockClear();
    mockGetDocumentAsync.mockReset();
    mockImport.mockReset();
  });

  it('shareBackup serializes the export and calls the share sheet', async () => {
    await shareBackup();
    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    const [uri, options] = mockShareAsync.mock.calls[0];
    expect(uri).toMatch(/^file:\/\//);
    expect(options?.mimeType).toBe('application/json');
  });

  it('restoreBackup merges a picked file and reports counts', async () => {
    mockImport.mockReturnValue({ favorites: 2, read: 3, history: 0, searchHistory: 0, recommend: 1, progress: 0 });
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked.json', name: 'backup.json', lastModified: 0 }],
    });
    const res = await restoreBackup();
    expect(res.ok).toBe(true);
    expect(res.message).toContain('收藏 2 条');
    expect(mockImport).toHaveBeenCalledWith(expect.stringContaining('a1'));
  });

  it('restoreBackup returns silently when the picker is canceled', async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    const res = await restoreBackup();
    expect(res.ok).toBe(false);
    expect(res.message).toBeUndefined();
    expect(mockImport).not.toHaveBeenCalled();
  });

  it('restoreBackup surfaces validation errors without throwing', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///bad.json', name: 'bad.json', lastModified: 0 }],
    });
    mockImport.mockImplementation(() => {
      throw new Error('文件格式不对');
    });
    const res = await restoreBackup();
    expect(res.ok).toBe(false);
    expect(res.message).toBe('文件格式不对');
  });
});
