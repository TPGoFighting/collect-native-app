import { BASE_URL } from './types';

export interface CollectLink {
  kind: 'article' | 'recommend';
  value: string;
}

const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

export function collectArticleUrl(id: string): string {
  return `${BASE_URL}/#/a/${encodeURIComponent(id)}`;
}

/** Stable, verifiable App Link path. The website hash route keeps working for browsers. */
export function appLinkArticleUrl(id: string): string {
  return `${BASE_URL}/article/${encodeURIComponent(id)}`;
}

/** Normalize a shared URL that points at a Collect article. */
export function parseArticleLink(input: string): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    if (host !== 'collect.tpgofighting.top' && host !== 'www.collect.tpgofighting.top') return null;
    const hash = url.hash.replace(/^#/, '');
    const match = hash.match(/^\/a\/([^/?#]+)/) ?? url.pathname.match(/^\/article\/([^/?#]+)/);
    const id = match ? decodeURIComponent(match[1]) : '';
    if (!id || !ID_RE.test(id)) return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * Extract the first valid HTTP(S) URL from system-shared text.
 * Links inside WeChat/X share text are common; prefer the first match.
 */
export function extractSharedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const matches = input.match(/https?:\/\/[^\s<>"'　]+/g) ?? [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[),.;，。）】]+$/, '');
    try {
      const url = new URL(cleaned);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')) return url.toString();
    } catch {
      // skip non-URLs
    }
  }
  return null;
}

/** Classify a share or App Link into the existing reader/recommend flows. */
export function classifyIncomingUrl(input: string | null | undefined): CollectLink | null {
  const url = extractSharedUrl(input);
  if (!url) return null;
  const articleId = parseArticleLink(url);
  if (articleId) return { kind: 'article', value: articleId };
  return { kind: 'recommend', value: url };
}

/** packageName + SHA-256 fingerprint have to match the deployed assetlinks.json. */
export const APP_LINK_HOST = 'collect.tpgofighting.top';
