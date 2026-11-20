// Data contract for Collect native app (mirrors scripts/extract-data.mjs output).
// Schema version 1. The app tolerates unknown fields and unknown section types.

export type Section =
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string; lead?: boolean }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'image'; url: string; caption: string }
  | { type: 'chart'; title: string; subtitle: string; unit: string; bars: ChartBar[] }
  | { type: 'callout'; text: string }
  | { type: 'link'; text: string; url: string };

export interface ChartBar {
  label: string;
  value: number;
  display: string;
}

export interface ArticleMeta {
  id: string;
  title: string;
  author: string;
  handle: string | null;
  platform: string;
  pname: string;
  date: string; // YYYY-MM-DD
  mins: number;
  cover: string; // absolute URL
  coverAlt: string;
  summary: string;
  keywords: string[];
  url: string; // original article URL
  stats: string | null;
  sourceNote: string;
  related: string[];
  relatedNote: string | null;
  rev: string;
}

export interface Article extends ArticleMeta {
  sections: Section[];
}

/** Context snippet for full-text search hits (match range is inside `text`). */
export interface SearchSnippet {
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface ArticlesList {
  schema_version: number;
  updated_at: string;
  count: number;
  articles: ArticleMeta[];
}

export interface SeedData {
  schema_version: number;
  updated_at: string;
  count: number;
  articles: Article[];
}

export const PLATFORMS = ['微信', 'X', '小红书', '知乎', '36氪', '官网', '其他'] as const;
export type PlatformFilter = 'all' | string;

export const BASE_URL = 'https://collect.tpgofighting.top';
export const DATA_URL = `${BASE_URL}/data/articles.json`;

export const FONT_SIZES = [15, 16, 17, 18, 20];
export const LINE_HEIGHTS = [1.6, 1.75];
// System font scaling: clamp so the five reader sizes keep their relative steps.
export const MAX_FONT_SCALE = 1.3;

/** Scale a reader font size by the OS font scale, capped at MAX_FONT_SCALE. */
export function scaledFontSize(size: number, fontScale: number): number {
  return Math.round(size * Math.min(fontScale, MAX_FONT_SCALE));
}
export type ThemeMode = 'system' | 'light' | 'dark';

export interface ReaderSettings {
  fontSize: number; // index into FONT_SIZES
  lineHeight: number; // index into LINE_HEIGHTS
  theme: ThemeMode;
}
