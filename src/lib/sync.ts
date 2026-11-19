import { Image } from 'expo-image';
import { BASE_URL, DATA_URL, type Article, type ArticlesList } from './types';
import {
  getArticleMeta,
  getMeta,
  listArticles,
  setMeta,
  upsertArticle,
} from './db';

export interface SyncResult {
  added: number;
  updated: number;
  total: number;
  fromCache: boolean;
  checkedAt: string;
  error?: string;
}

const LIST_TIMEOUT_MS = 8000;
const ARTICLE_TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = LIST_TIMEOUT_MS): Promise<{ status: number; data: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (res.status === 304) return { status: 304, data: null };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: res.status, data: (await res.json()) as T };
  } finally {
    clearTimeout(timer);
  }
}

/** Sync the article list + any new/changed full texts. Never throws. */
export async function syncNow(): Promise<SyncResult> {
  const checkedAt = new Date().toISOString();
  try {
    // Hour-bucketed cache buster: Cloudflare may cache /data/* until the nginx
    // no-cache rule lands; a new URL each hour forces a fresh origin fetch.
    const now = new Date();
    const bucket = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
      now.getUTCDate(),
    ).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}`;
    const headers: Record<string, string> = {};
    const etag = getMeta('list_etag');
    const lastMod = getMeta('list_last_modified');
    if (etag) headers['If-None-Match'] = etag;
    if (lastMod) headers['If-Modified-Since'] = lastMod;
    const { status, data } = await fetchJson<ArticlesList>(`${DATA_URL}?v=${bucket}`, { headers });
    if (status === 304 || !data) {
      setMeta('last_sync_at', checkedAt);
      return { added: 0, updated: 0, total: listArticles().length, fromCache: true, checkedAt };
    }
    if (data.schema_version !== 1) {
      return { added: 0, updated: 0, total: listArticles().length, fromCache: false, checkedAt, error: '数据格式版本过高，请更新 App' };
    }
    const local = new Map(listArticles().map((m) => [m.id, m.rev]));
    let added = 0;
    let updated = 0;
    const toFetch: { id: string; rev: string; meta: (typeof data.articles)[number] }[] = [];
    for (const m of data.articles) {
      const old = local.get(m.id);
      if (old === undefined) { added += 1; toFetch.push({ id: m.id, rev: m.rev, meta: m }); }
      else if (old !== m.rev) { updated += 1; toFetch.push({ id: m.id, rev: m.rev, meta: m }); }
      else upsertArticle(m); // meta refresh (related lists may change)
    }
    // Fetch full texts with limited concurrency (4 at a time).
    for (let i = 0; i < toFetch.length; i += 4) {
      const batch = toFetch.slice(i, i + 4);
      await Promise.allSettled(
        batch.map(async ({ id, rev, meta }) => {
          try {
            const { data: full } = await fetchJson<Article>(
              `${BASE_URL}/data/articles/${id}.json?rev=${encodeURIComponent(rev)}`,
              undefined,
              ARTICLE_TIMEOUT_MS,
            );
            if (full) {
              upsertArticle({ ...meta, sections: full.sections ?? [] });
              // Best-effort image prefetch so the article is fully offline.
              for (const s of full.sections ?? []) {
                if (s.type === 'image') Image.prefetch(s.url).catch(() => {});
              }
              Image.prefetch(meta.cover).catch(() => {});
            } else {
              upsertArticle(meta);
            }
          } catch {
            upsertArticle(meta); // meta only; reader retries the full text on open
          }
        }),
      );
    }
    setMeta('list_updated_at', data.updated_at);
    setMeta('last_sync_at', checkedAt);
    return { added, updated, total: data.articles.length, fromCache: false, checkedAt };
  } catch (e) {
    // Offline / timeout / any failure: silent, local data stays usable.
    return {
      added: 0,
      updated: 0,
      total: listArticles().length,
      fromCache: false,
      checkedAt,
      error: e instanceof Error ? e.message : '同步失败',
    };
  }
}

/** Fetch one article's full text on demand (used by the reader when sections are missing). */
export async function fetchArticleFull(id: string): Promise<Article | null> {
  const meta = getArticleMeta(id);
  if (!meta) return null;
  try {
    const { data } = await fetchJson<Article>(
      `${BASE_URL}/data/articles/${id}.json?rev=${encodeURIComponent(meta.rev)}`,
      undefined,
      ARTICLE_TIMEOUT_MS,
    );
    if (!data) return null;
    upsertArticle({ ...meta, sections: data.sections ?? [] });
    return { ...meta, sections: data.sections ?? [] };
  } catch {
    return null;
  }
}

export function lastSyncAt(): string | null {
  return getMeta('last_sync_at');
}
