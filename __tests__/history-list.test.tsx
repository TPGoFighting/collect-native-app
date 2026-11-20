/* global jest, describe, beforeEach, it, expect */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { HistoryList, confirmClearHistory } from '@/components/HistoryList';
import { clearHistory, getReadMap, listHistory } from '@/lib/db';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

jest.mock('@/lib/db', () => ({
  clearHistory: jest.fn(),
  getReadMap: jest.fn(() => new Set(['a1'])),
  listHistory: jest.fn(() => [
    { id: 'a1', title: '历史文章一', author: '作者甲', pname: '公众号', date: '2025-06-02', mins: 4, cover: 'https://x/c.png', rev: 'r1' },
    { id: 'a2', title: '历史文章二', author: '作者乙', pname: '知乎', date: '2025-06-01', mins: 6, cover: 'https://x/c.png', rev: 'r1' },
  ]),
}));

jest.mock('expo-image', () => ({ Image: () => null }));

const mockListHistory = jest.mocked(listHistory);
const mockClearHistory = jest.mocked(clearHistory);
const mockGetReadMap = jest.mocked(getReadMap);

beforeEach(() => {
  mockPush.mockClear();
  mockClearHistory.mockClear();
  mockGetReadMap.mockClear();
});

describe('shared HistoryList component', () => {
  it('renders the same list implementation for both hosts (favorites segment + /history route)', async () => {
    const screen = await render(<HistoryList />);
    await waitFor(() => {
      expect(screen.getByText('历史文章一')).toBeTruthy();
      expect(screen.getByText('历史文章二')).toBeTruthy();
    });
    // read state comes from the same getReadMap source
    expect(mockListHistory).toHaveBeenCalled();
    expect(mockGetReadMap).toHaveBeenCalled();
  });

  it('shows the empty state when history is empty', async () => {
    mockListHistory.mockImplementationOnce(() => []);
    const screen = await render(<HistoryList />);
    await waitFor(() => {
      expect(screen.getByText('还没有阅读记录')).toBeTruthy();
    });
  });

  it('opens the tapped article via router.push with the canonical path', async () => {
    const screen = await render(<HistoryList />);
    await waitFor(() => expect(screen.getByText('历史文章一')).toBeTruthy());
    // the Pressable host View exposes the press via onClick (web-style handler
    // RNTL firePress goes through); invoke it with the minimal event shape
    const card = screen.root!.queryAll((n) => !!n.props.onClick)[0];
    card.props.onClick({ persist: () => {}, nativeEvent: {} });
    expect(mockPush).toHaveBeenCalledWith('/article/a1');
  });
});

describe('favorites tab parameter', () => {
  it('maps a tab=history deep-link param onto the history segment', () => {
    // The favorites screen derives its initial segment from the param; verify
    // the param contract at source level (route param passing cannot be
    // rendered standalone because the screen reads useLocalSearchParams).
    const fs = require('fs');
    const src = fs.readFileSync('src/app/(tabs)/favorites.tsx', 'utf8');
    expect(src).toContain("useLocalSearchParams<{ tab?: string }>");
    expect(src).toContain("tabParam === 'history' ? 'history' : 'fav'");
    expect(src).toContain('<HistoryList');
    expect(src).toContain('confirmClearHistory');
  });

  it('profile routes the 阅读历史 row to favorites with tab=history', () => {
    const fs = require('fs');
    const src = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8');
    expect(src).toContain("params: { tab: 'history' }");
    expect(src).toContain("pathname: '/(tabs)/favorites'");
    // the standalone route stays registered for App Link / old entry compat
    expect(fs.readFileSync('src/app/history.tsx', 'utf8')).toContain('HistoryList');
  });

  it('confirmClearHistory confirms before wiping, then notifies the host', () => {
    const Alert = require('react-native').Alert;
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onCleared = jest.fn();
    confirmClearHistory(onCleared);
    expect(alertSpy).toHaveBeenCalledWith(
      '清除阅读历史',
      '确定要清除全部阅读历史吗？收藏不受影响。',
      expect.anything(),
    );
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const clearBtn = buttons.find((b) => b.text === '清除');
    expect(clearBtn).toBeDefined();
    clearBtn!.onPress!();
    expect(mockClearHistory).toHaveBeenCalled();
    expect(onCleared).toHaveBeenCalled();
    // cancel path does nothing
    mockClearHistory.mockClear();
    onCleared.mockClear();
    const cancelBtn = buttons.find((b: { text: string }) => b.text === '取消');
    cancelBtn?.onPress?.();
    expect(mockClearHistory).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
