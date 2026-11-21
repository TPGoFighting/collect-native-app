/* global jest, describe, beforeEach, it, expect */
import {
  UPDATE_DISMISSED_KEY,
  dismissUpdate,
  getDismissedUpdateVersion,
  shouldShowUpdateDialog,
} from '@/lib/updateCheck';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '2.1.3', android: { package: 'top.tpgofighting.collect' } } },
}));

const storage = new Map<string, string>();

const asyncStorage = require('@react-native-async-storage/async-storage').default as {
  getItem: jest.Mock;
  setItem: jest.Mock;
};

beforeEach(() => {
  storage.clear();
  asyncStorage.getItem.mockImplementation((key: string) =>
    Promise.resolve(storage.has(key) ? storage.get(key)! : null),
  );
  asyncStorage.setItem.mockImplementation((key: string, value: string) => {
    storage.set(key, value);
    return Promise.resolve();
  });
});

describe('shouldShowUpdateDialog', () => {
  it('pops for a newer version that was never dismissed', () => {
    expect(shouldShowUpdateDialog('2.1.4', '2.1.3', null)).toBe(true);
  });

  it('stays silent for the dismissed version', () => {
    expect(shouldShowUpdateDialog('2.1.4', '2.1.3', '2.1.4')).toBe(false);
  });

  it('pops again when a newer version appears after a dismissal', () => {
    expect(shouldShowUpdateDialog('2.1.5', '2.1.3', '2.1.4')).toBe(true);
  });

  it('stays silent when already on the latest version', () => {
    expect(shouldShowUpdateDialog('2.1.3', '2.1.3', null)).toBe(false);
  });

  it('stays silent when the remote version is older', () => {
    expect(shouldShowUpdateDialog('2.1.2', '2.1.3', null)).toBe(false);
  });

  it('stays silent when either version is missing', () => {
    expect(shouldShowUpdateDialog('', '2.1.3', null)).toBe(false);
    expect(shouldShowUpdateDialog('2.1.4', '', null)).toBe(false);
  });
});

describe('dismissUpdate round-trip', () => {
  it('stores the dismissed version and reads it back', async () => {
    expect(await getDismissedUpdateVersion()).toBeNull();
    await dismissUpdate('2.1.4');
    expect(storage.get(UPDATE_DISMISSED_KEY)).toBe('2.1.4');
    expect(await getDismissedUpdateVersion()).toBe('2.1.4');
    expect(shouldShowUpdateDialog('2.1.4', '2.1.3', await getDismissedUpdateVersion())).toBe(false);
  });
});
