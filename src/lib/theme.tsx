import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { PixelRatio, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONT_SIZES, LINE_HEIGHTS, ReaderSettings, scaledFontSize } from './types';

// Black & white zinc tokens (design doc 6.1). No color accent anywhere.
export interface Theme {
  bg: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  onAccent: string;
  faint: string;
  card: string;
}

export const tokens: { light: Theme; dark: Theme } = {
  light: {
    bg: '#FFFFFF',
    surface: '#FAFAFA',
    text: '#09090B',
    textSecondary: '#71717A',
    border: '#E4E4E7',
    accent: '#09090B',
    onAccent: '#FFFFFF',
    faint: '#A1A1AA',
    card: '#FFFFFF',
  },
  dark: {
    bg: '#000000',
    surface: '#18181B',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    border: '#27272A',
    accent: '#FAFAFA',
    onAccent: '#09090B',
    faint: '#52525B',
    card: '#18181B',
  },
};


const SETTINGS_KEY = 'collect:settings:v1';
const DEFAULT_SETTINGS: ReaderSettings = { fontSize: 2, lineHeight: 1, theme: 'system' };

interface SettingsCtx {
  settings: ReaderSettings;
  setSettings: (patch: Partial<ReaderSettings>) => void;
  theme: Theme;
  isDark: boolean;
  fontSize: number;
  lineHeight: number;
  loaded: boolean;
}

const Ctx = createContext<SettingsCtx>({
  settings: DEFAULT_SETTINGS,
  setSettings: () => {},
  theme: tokens.light,
  isDark: false,
  fontSize: scaledFontSize(FONT_SIZES[2], 1),
  lineHeight: LINE_HEIGHTS[1],
  loaded: false,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const fontScale = PixelRatio.getFontScale();
  const [settings, setSettingsState] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
            setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
          } catch {
            // corrupted settings: keep defaults
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const setSettings = (patch: Partial<ReaderSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemScheme === 'dark');
  const value = useMemo<SettingsCtx>(
    () => ({
      settings,
      setSettings,
      theme: isDark ? tokens.dark : tokens.light,
      isDark,
      fontSize: scaledFontSize(
        FONT_SIZES[Math.min(Math.max(settings.fontSize, 0), FONT_SIZES.length - 1)],
        fontScale,
      ),
      lineHeight: LINE_HEIGHTS[Math.min(Math.max(settings.lineHeight, 0), LINE_HEIGHTS.length - 1)],
      loaded,
    }),
    [settings, isDark, loaded, fontScale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}

export function useTheme(): Theme {
  return useContext(Ctx).theme;
}
