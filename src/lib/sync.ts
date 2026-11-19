import { Image } from 'expo-image';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL, DATA_URL, type Article, type ArticlesList } from './types';
import {
  claimNewArticleNotification,
  getArticleMeta,
  getMeta,
  listArticles,
  setMeta,
  upsertArticle,
} from './db';
import { getNotificationPref, notifyNewArticle } from './notifications';

export interface SyncResult {
  added: number;
  updated: number;
  total: number;
  fromCache: boolean;
  checkedAt: string;
  error?: string;
  failedIds?: string[];
  notified?: number;
}

const LIST_TIMEOUT_MS = 8000;
const ARTICLE_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = LIST_TIMEOUT_MS,
): Promise<{ status: number; etag: string | null; lastModified: string | null; data: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (res.status === 304) {
      return { status: 304, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified'), data: null };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      status: res.status,
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      data: (await res.json()) as T,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = ARTICLE_TIMEOUT_MS,
): Promise<{ status: number; etag: string | null; lastModified: string | null; data: T | null }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchJson<T>(url, init, timeoutMs);
    } catch (e) {
      lastError = e;
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('同步失败');
}

async function maySyncInBackground(): Promise<boolean> {
  if (getNotificationPref() !== 'wifi') return true;
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.type === 'wifi';
}

function cacheBuster(): string {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
  ].join('');
}

/**
 * Sync the article list + any new/changed full texts.
 *
 * The server is a static JSON endpoint: there is no per-article delta API.
 * We use ETag / Last-Modified (RFC 7232) as the cursor so an unchanged list
 * is a 304 with no payload, and rev hashes to fetch only changed full texts.
 * Never throws; offline keeps the local SQLite copy usable.
 */
export async function syncNow(options?: { background?: boolean }): Promise<SyncResult> {
  const checkedAt = new Date().toISOString();
  const empty = (error?: string): SyncResult => ({
    added: 0,
    updated: 0,
    total: listArticles().length,
    fromCache: false,
    checkedAt,
    error,
  });
  try {
    if (options?.background && !(await maySyncInBackground())) {
      setMeta('last_sync_error', '等待 Wi-Fi');
      return empty('等待 Wi-Fi');
    }

    const headers: Record<string, string> = {};
    const etag = getMeta('list_etag');
    const lastMod = getMeta('list_last_modified');
    if (etag) headers['If-None-Match'] = etag;
    if (lastMod) headers['If-Modified-Since'] = lastMod;
    const { status, etag: nextEtag, lastModified: nextMod, data } = await fetchWithRetry<ArticlesList>(
      `${DATA_URL}?v=${cacheBuster()}`,
      { headers },
      LIST_TIMEOUT_MS,
    );
    if (status === 304 || !data) {
      setMeta('last_sync_at', checkedAt);
      setMeta('last_sync_error', '');
      return { ...empty(), fromCache: true };
    }
    if (data.schema_version !== 1) {
      return empty('数据格式版本过高，请更新 App');
    }
    if (nextEtag) setMeta('list_etag', nextEtag);
    if (nextMod) setMeta('list_last_modified', nextMod);

    const local = new Map(listArticles().map((m) => [m.id, m.rev]));
    const changed: { id: string; rev: string; meta: ArticlesList['articles'][number] }[] = [];
    let added = 0;
    let updated = 0;
    for (const m of data.articles) {
      const old = local.get(m.id);
      if (old === undefined) {
        added += 1;
        changed.push({ id: m.id, rev: m.rev, meta: m });
      } else if (old !== m.rev) {
        updated += 1;
        changed.push({ id: m.id, rev: m.rev, meta: m });
      } else {
        upsertArticle(m); // refresh meta (related lists may change)
      }
    }

    const failedIds: string[] = [];
    let notified = 0;
    // Fetch full texts with limited concurrency (4 at a time).
    for (let i = 0; i < changed.length; i += 4) {
      await Promise.all(
        changed.slice(i, i + 4).map(async ({ id, rev, meta }) => {
          let full: Article | null = null;
          try {
            const res = await fetchWithRetry<Article>(
              `${BASE_URL}/data/articles/${encodeURIComponent(id)}.json?rev=${encodeURIComponent(rev)}`,
            );
            full = res.data;
          } catch {
            failedIds.push(id);
          }
          upsertArticle(full ? { ...meta, sections: full.sections ?? [] } : meta);
          if (full) {
            // Best-effort image prefetch so the article is fully offline.
            for (const s of full.sections ?? []) {
              if (s.type === 'image') Image.prefetch(s.url).catch(() => {});
            }
            Image.prefetch(meta.cover).catch(() => {});
          }
          // Only consume the one-shot claim when a notification is actually sent;
          // permission denied / Wi-Fi-only users can still be notified later.
          if (local.get(id) === undefined && getNotificationPref() === 'all') {
            const sent = await notifyNewArticle(id, meta.title);
            if (sent) {
              claimNewArticleNotification(id);
              notified += 1;
              setMeta(`notified:${id}`, '1');
            }
          }
        }),
      );
    }

    setMeta('list_updated_at', data.updated_at);
    setMeta('last_sync_at', checkedAt);
    setMeta('last_sync_error', failedIds.length ? `正文获取失败 ${failedIds.length} 篇` : '');
    return {
      added,
      updated,
      total: data.articles.length,
      fromCache: false,
      checkedAt,
      failedIds: failedIds.length ? failedIds : undefined,
      notified,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : '同步失败';
    setMeta('last_sync_error', message);
    return empty(message);
  }
}

/** Fetch one article's full text on demand (used by the reader when sections are missing). */
export async function fetchArticleFull(id: string): Promise<Article | null> {
  const meta = getArticleMeta(id);
  if (!meta) return null;
  try {
    const { data } = await fetchWithRetry<Article>(
      `${BASE_URL}/data/articles/${encodeURIComponent(id)}.json?rev=${encodeURIComponent(meta.rev)}`,
    );
    if (!data) return null;
    upsertArticle({ ...meta, sections: data.sections ?? [] });
    setMeta(`full_failed:${id}`, '');
    return { ...meta, sections: data.sections ?? [] };
  } catch {
    setMeta(`full_failed:${id}`, '1');
    return null;
  }
}

export function lastSyncAt(): string | null {
  return getMeta('last_sync_at');
}

export function lastSyncError(): string | null {
  return getMeta('last_sync_error') || null;
}
