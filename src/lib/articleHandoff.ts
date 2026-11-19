import type { Article } from './types';
import { getArticle } from './db';

let pending: Article | null = null;

/** Hand the full article to the share-card route without serializing it into a URL. */
export function setHandoffArticle(article: Article): void {
  pending = article;
}

export function takeHandoffArticle(id?: string): Article | null {
  const value = pending;
  if (value && (!id || value.id === id)) {
    pending = null;
    return value;
  }
  return id ? getArticle(id) : null;
}
