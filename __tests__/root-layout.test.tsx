/* global jest, describe, beforeEach, it, expect */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockPush = jest.fn();
const mockShareValue = { text: '', webUrl: null as string | null, files: null, type: 'text' };

jest.mock('expo-router', () => {
  const ReactModule = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => ({}),
    Stack: Object.assign(
      ({ children }: { children: React.ReactNode }) =>
        ReactModule.createElement(ReactModule.Fragment, null, children),
      { Screen: () => null },
    ),
  };
});

jest.mock('expo-share-intent', () => {
  const ReactModule = require('react');
  return {
    ShareIntentProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useShareIntentContext: () => ({
      hasShareIntent: Boolean(mockShareValue.text || mockShareValue.webUrl),
      shareIntent: mockShareValue,
      resetShareIntent: jest.fn(),
      error: null,
      isReady: true,
    }),
  };
});
jest.mock('@/lib/sync', () => ({ syncNow: jest.fn(() => Promise.resolve({ added: 0, updated: 0 })) }));
jest.mock('@/lib/backgroundSync', () => ({ registerBackgroundSync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));

import { classifyIncomingUrl } from '@/lib/links';
import { dispatchIncoming, setIncomingListener } from '@/lib/incoming';

describe('system share -> recommend routing', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockShareValue.text = '';
    mockShareValue.webUrl = null;
    setIncomingListener(null);
  });

  it('classifies a WeChat/X share link as a recommendation', () => {
    const link = classifyIncomingUrl('看看这篇 https://x.com/user/status/123');
    expect(link).toEqual({ kind: 'recommend', value: 'https://x.com/user/status/123' });
  });

  it('suppresses the exact same event but accepts a fresh share event', () => {
    const listener = jest.fn();
    setIncomingListener(listener);
    const link = classifyIncomingUrl('https://example.com/a');
    dispatchIncoming({ ...link!, source: 'share', eventId: 'share:abc' });
    dispatchIncoming({ ...link!, source: 'share', eventId: 'share:abc' });
    expect(listener).toHaveBeenCalledTimes(1);
    dispatchIncoming({ ...link!, source: 'share', eventId: 'share:def' });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('routes a Collect article link to the reader', () => {
    const link = classifyIncomingUrl('https://collect.tpgofighting.top/#/a/chromium');
    expect(link).toEqual({ kind: 'article', value: 'chromium' });
  });

  it('renders a minimal harness without throwing', async () => {
    const Harness = () => {
      const link = classifyIncomingUrl(mockShareValue.text || mockShareValue.webUrl);
      return <Text>{link ? link.kind : 'idle'}</Text>;
    };
    const view = await render(<Harness />);
    expect(view.toJSON()).toBeTruthy();
  });
});
