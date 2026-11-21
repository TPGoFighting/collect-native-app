import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const RELEASES_API_URL = 'https://api.github.com/repos/TPGoFighting/collect-native-app/releases/latest';
export const RELEASE_PAGE_URL = 'https://github.com/TPGoFighting/collect-native-app/releases/latest';

export const UPDATE_CHECK_KEY = 'collect:update-check:v1';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

export interface UpdateInfo {
  version: string;
  /** Direct APK download URL when the release carries one; otherwise the release page. */
  url: string;
}

const APK_ASSET_RE = /^collect-v\d+\.\d+\.\d+\.apk$/;

/** Pick the APK asset's direct download link from a release payload, if present. */
function pickApkUrl(data: { assets?: unknown }): string | null {
  const assets = data.assets;
  if (!Array.isArray(assets)) return null;
  for (const asset of assets) {
    const a = asset as { name?: unknown; browser_download_url?: unknown };
    if (
      typeof a.name === 'string' &&
      APK_ASSET_RE.test(a.name) &&
      typeof a.browser_download_url === 'string' &&
      a.browser_download_url.startsWith('https://')
    ) {
      return a.browser_download_url;
    }
  }
  return null;
}

interface CachedCheck {
  ts: number;
  version: string | null;
  url: string | null;
}

/** Parse "v2.1.0" style tags; prerelease/build/illegal tags return null. */
export function parseVersion(tag: string): number[] | null {
  if (typeof tag !== 'string') return null;
  const cleaned = tag.trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+){0,2}$/.test(cleaned)) return null;
  return cleaned.split('.').map(Number);
}

/** True only when `remote` is strictly newer than `current` (semver, missing parts = 0). */
export function isNewerVersion(remote: string, current: string): boolean {
  const r = parseVersion(remote);
  const c = parseVersion(current);
  if (!r || !c) return false;
  const len = Math.max(r.length, c.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] ?? 0;
    const cv = c[i] ?? 0;
    if (rv !== cv) return rv > cv;
  }
  return false;
}

/**
 * Check GitHub Releases for a newer version, throttled to once per 24h.
 * Pass `{ force: true }` from a screen the user is looking at (e.g. the
 * update banner) to bypass the throttle and check right now.
 * Never throws and never surfaces errors: any failure returns null so the
 * UI stays untouched, and failures are never cached — the next launch (or
 * the next forced check) retries. The last successful result is cached so
 * screens can reuse it within the throttle window without another request.
 */
export async function checkForUpdate(options?: { force?: boolean }): Promise<UpdateInfo | null> {
  try {
    const current = Constants.expoConfig?.version;
    if (!current) return null;

    if (!options?.force) {
      const raw = await AsyncStorage.getItem(UPDATE_CHECK_KEY);
      const cached: CachedCheck | null = raw ? JSON.parse(raw) : null;
      if (cached && typeof cached.ts === 'number' && Date.now() - cached.ts < CHECK_INTERVAL_MS) {
        return cached.version ? { version: cached.version, url: cached.url ?? RELEASE_PAGE_URL } : null;
      }
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let data: { tag_name?: unknown; html_url?: unknown; assets?: unknown } | null = null;
    try {
      const res = await fetch(RELEASES_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      data = (await res.json()) as { tag_name?: unknown; html_url?: unknown; assets?: unknown };
    } finally {
      clearTimeout(timer);
    }

    const next: CachedCheck = { ts: Date.now(), version: null, url: null };
    if (data && typeof data.tag_name === 'string' && isNewerVersion(data.tag_name, current)) {
      const parts = parseVersion(data.tag_name);
      next.version = parts ? parts.join('.') : null;
      next.url =
        pickApkUrl(data) ??
        (typeof data.html_url === 'string' && data.html_url.startsWith('https://') ? data.html_url : RELEASE_PAGE_URL);
    }
    await AsyncStorage.setItem(UPDATE_CHECK_KEY, JSON.stringify(next));
    return next.version ? { version: next.version, url: next.url ?? RELEASE_PAGE_URL } : null;
  } catch {
    return null;
  }
}
