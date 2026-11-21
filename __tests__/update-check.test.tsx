/* global jest, describe, beforeEach, it, expect */
import {
  isNewerVersion,
  parseVersion,
  RELEASE_PAGE_URL,
  RELEASES_API_URL,
  UPDATE_CHECK_KEY,
  checkForUpdate,
} from '@/lib/updateCheck';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.1.0', android: { package: 'top.tpgofighting.collect' } } },
}));

const storage = new Map<string, string>();

const asyncStorage = require('@react-native-async-storage/async-storage').default as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

const mockFetch = jest.fn() as jest.Mock;
// @ts-expect-error assign global fetch in the jest environment
global.fetch = mockFetch;

beforeEach(() => {
  storage.clear();
  asyncStorage.getItem.mockImplementation((key: string) =>
    Promise.resolve(storage.has(key) ? storage.get(key)! : null),
  );
  asyncStorage.setItem.mockImplementation((key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve();
  });
  mockFetch.mockReset();
});

describe('parseVersion', () => {
  it('strips the v prefix', () => {
    expect(parseVersion('v2.1.0')).toEqual([2, 1, 0]);
    expect(parseVersion('V3.0')).toEqual([3, 0]);
  });

  it('accepts bare numeric tags', () => {
    expect(parseVersion('2.1.0')).toEqual([2, 1, 0]);
    expect(parseVersion('2')).toEqual([2]);
  });

  it('rejects prerelease and illegal tags', () => {
    expect(parseVersion('2.1.0-beta.1')).toBeNull();
    expect(parseVersion('v2.1.0-rc1')).toBeNull();
    expect(parseVersion('2.1.0+build.5')).toBeNull();
    expect(parseVersion('abc')).toBeNull();
    expect(parseVersion('2.x')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('isNewerVersion', () => {
  it('detects strictly newer versions', () => {
    expect(isNewerVersion('2.2.0', '2.1.0')).toBe(true);
    expect(isNewerVersion('v3.0.0', '2.9.9')).toBe(true);
    expect(isNewerVersion('2.1.1', '2.1.0')).toBe(true);
  });

  it('treats equal and older versions as no update', () => {
    expect(isNewerVersion('2.1.0', '2.1.0')).toBe(false);
    expect(isNewerVersion('2.0.9', '2.1.0')).toBe(false);
    expect(isNewerVersion('v2.0', '2.1.0')).toBe(false);
  });

  it('compares missing parts as zero', () => {
    expect(isNewerVersion('2.2', '2.1.0')).toBe(true);
    expect(isNewerVersion('2.1', '2.1.0')).toBe(false);
  });

  it('never flags update for prerelease or garbage tags', () => {
    expect(isNewerVersion('3.0.0-beta', '2.1.0')).toBe(false);
    expect(isNewerVersion('not-a-version', '2.1.0')).toBe(false);
    expect(isNewerVersion('2.2.0', 'not-a-version')).toBe(false);
  });
});

describe('checkForUpdate', () => {
  const api = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

  it('hits the GitHub releases API with the GitHub Accept header', async () => {
    mockFetch.mockReturnValue(api({ tag_name: 'v2.1.0', html_url: RELEASE_PAGE_URL }));
    await checkForUpdate();
    expect(mockFetch).toHaveBeenCalledWith(RELEASES_API_URL, expect.objectContaining({
      headers: { Accept: 'application/vnd.github+json' },
    }));
  });

  it('returns the release info when a newer version exists and caches it', async () => {
    mockFetch.mockReturnValue(api({
      tag_name: 'v2.2.0',
      html_url: 'https://github.com/TPGoFighting/collect-native-app/releases/tag/v2.2.0',
      assets: [
        { name: 'collect-v2.2.0.apk', browser_download_url: 'https://github.com/TPGoFighting/collect-native-app/releases/download/v2.2.0/collect-v2.2.0.apk' },
      ],
    }));
    const result = await checkForUpdate();
    expect(result).toEqual({
      version: '2.2.0',
      url: 'https://github.com/TPGoFighting/collect-native-app/releases/download/v2.2.0/collect-v2.2.0.apk',
    });
    expect(JSON.parse(storage.get(UPDATE_CHECK_KEY)!).version).toBe('2.2.0');
  });

  it('falls back to the release page when the release carries no APK asset', async () => {
    mockFetch.mockReturnValue(api({ tag_name: 'v2.2.0', html_url: 'https://github.com/TPGoFighting/collect-native-app/releases/tag/v2.2.0', assets: [] }));
    const result = await checkForUpdate();
    expect(result).toEqual({
      version: '2.2.0',
      url: 'https://github.com/TPGoFighting/collect-native-app/releases/tag/v2.2.0',
    });
  });

  it('force bypasses the 24h cache for a screen the user is looking at', async () => {
    storage.set(UPDATE_CHECK_KEY, JSON.stringify({ ts: Date.now(), version: null, url: null }));
    mockFetch.mockReturnValue(api({ tag_name: 'v2.2.0', html_url: RELEASE_PAGE_URL }));
    const result = await checkForUpdate({ force: true });
    expect(mockFetch).toHaveBeenCalled();
    expect(result?.version).toBe('2.2.0');
  });

  it('returns null and no UI when versions match', async () => {
    mockFetch.mockReturnValue(api({ tag_name: 'v2.1.0' }));
    expect(await checkForUpdate()).toBeNull();
    // still caches the "checked, nothing new" state for throttling
    expect(JSON.parse(storage.get(UPDATE_CHECK_KEY)!).version).toBeNull();
  });

  it('serves from the 24h cache without a second request', async () => {
    storage.set(UPDATE_CHECK_KEY, JSON.stringify({ ts: Date.now(), version: '2.2.0', url: 'https://example.com' }));
    const result = await checkForUpdate();
    expect(result).toEqual({ version: '2.2.0', url: 'https://example.com' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not re-request within the throttle window even after a null result', async () => {
    storage.set(UPDATE_CHECK_KEY, JSON.stringify({ ts: Date.now(), version: null, url: null }));
    expect(await checkForUpdate()).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('re-checks after the 24h window expires', async () => {
    storage.set(UPDATE_CHECK_KEY, JSON.stringify({ ts: Date.now() - 25 * 60 * 60 * 1000, version: null, url: null }));
    mockFetch.mockReturnValue(api({ tag_name: 'v2.1.0' }));
    await checkForUpdate();
    expect(mockFetch).toHaveBeenCalled();
  });

  it('stays fully silent on network failure', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('offline')));
    await expect(checkForUpdate()).resolves.toBeNull();
    expect(storage.has(UPDATE_CHECK_KEY)).toBe(false);
  });

  it('stays silent on HTTP errors and malformed payloads', async () => {
    mockFetch.mockReturnValue(api({}, false));
    await expect(checkForUpdate()).resolves.toBeNull();

    mockFetch.mockReturnValue(Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }));
    await expect(checkForUpdate()).resolves.toBeNull();
  });

  it('falls back to the releases page for a non-https html_url', async () => {
    mockFetch.mockReturnValue(api({ tag_name: 'v2.2.0', html_url: 'javascript:alert(1)' }));
    const result = await checkForUpdate();
    expect(result?.url).toBe(RELEASE_PAGE_URL);
  });
});
