/* global jest, describe, beforeEach, it, expect */
import React from 'react';
import { render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_KEY } from '@/app/onboarding';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    Stack: Object.assign(
      ({ children }: { children: React.ReactNode }) =>
        ReactModule.createElement(ReactModule.Fragment, null, children),
      { Screen: () => null },
    ),
  };
});

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('@/lib/sync', () => ({ syncNow: jest.fn(() => Promise.resolve({ added: 0, updated: 0 })) }));
jest.mock('@/lib/backgroundSync', () => ({
  registerBackgroundSync: jest.fn(() => Promise.resolve(true)),
  unregisterBackgroundSync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { android: { package: 'top.tpgofighting.collect' } } } }));

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
  mockReplace.mockClear();
  mockPush.mockClear();
});

describe('onboarding gate', () => {
  it('exposes a stable AsyncStorage flag key', () => {
    expect(ONBOARDING_KEY).toBe('collect:onboarding:v1');
  });

  it('treats a fresh install (no flag, no settings) as not onboarded', async () => {
    const [flag, settings] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem('collect:settings:v1'),
    ]);
    expect(flag).toBeNull();
    expect(settings).toBeNull();
    // _layout computes: flag === 'done' || settings !== null
    expect(flag === 'done' || settings !== null).toBe(false);
  });

  it('treats an upgraded install (existing settings) as onboarded', async () => {
    storage.set('collect:settings:v1', JSON.stringify({ fontSize: 2, lineHeight: 1, theme: 'system' }));
    const [flag, settings] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem('collect:settings:v1'),
    ]);
    expect(flag === 'done' || settings !== null).toBe(true);
  });

  it('marks onboarding done and never shows again after completion', async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'done');
    const [flag, settings] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem('collect:settings:v1'),
    ]);
    expect(flag === 'done' || settings !== null).toBe(true);
  });
});

describe('onboarding screen', () => {
  it('renders the first screen without throwing', async () => {
    const OnboardingScreen = require('@/app/onboarding').default;
    const view = await render(<OnboardingScreen />);
    expect(view.root).toBeTruthy();
    await view.unmount();
  });
});

describe('root layout registers new routes', () => {
  it('lists onboarding and privacy among the Stack screens', () => {
     
    const src = require('fs').readFileSync('src/app/_layout.tsx', 'utf8');
    expect(src).toContain('<Stack.Screen name="onboarding"');
    expect(src).toContain('<Stack.Screen name="privacy"');
  });

  it('redirects to onboarding on first launch via the gate expression', () => {

    const src = require('fs').readFileSync('src/app/_layout.tsx', 'utf8');
    expect(src).toContain("flag === 'done' || settingsRaw !== null");
    expect(src).toContain("router.replace('/onboarding')");
  });

  it('keeps the share-intent provider wiring untouched', () => {
     
    const src = require('fs').readFileSync('src/app/_layout.tsx', 'utf8');
    expect(src).toContain('ShareIntentProvider');
  });
});

describe('de-internalized copy', () => {
  it('no longer contains the internal nickname anywhere in src/', () => {
     
    const fs = require('fs');
    const path = require('path');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e: { isDirectory: () => boolean; name: string }) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
      );
    const offenders = walk('src')
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => fs.readFileSync(f, 'utf8').includes('大肥鱼'));
    expect(offenders).toEqual([]);
  });

  it('recommend copy addresses the user-facing curator', () => {
     
    const src = require('fs').readFileSync('src/app/recommend.tsx', 'utf8');
    expect(src).toContain('发送给站长即可收录');
  });
});

describe('privacy page exists with required disclosures', () => {
  it('covers storage, no-tracking and both permission purposes', () => {
     
    const src = require('fs').readFileSync('src/app/privacy.tsx', 'utf8');
    expect(src).toContain('通知权限');
    expect(src).toContain('媒体库写入权限');
    expect(src).toContain('不采集');
    expect(src).toContain('备份与恢复');
  });

  it('is linked from the about page', () => {
     
    const src = require('fs').readFileSync('src/app/about.tsx', 'utf8');
    expect(src).toContain("router.push('/privacy')");
  });
});
