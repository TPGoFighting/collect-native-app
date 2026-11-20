import type { Section, SearchSnippet } from './types';

// ---------- CJK bigram tokenization ----------
// FTS5's built-in unicode61 tokenizer does not segment CJK text, so consecutive
// CJK chars are indexed as overlapping two-character bigrams (space-joined);
// non-CJK text keeps its original words. Queries are built the same way so
// MATCH lines up with the index.

const CJK_RE = /[⺀-⿟　-〿㇀-㇯㈀-鿿豈-﫿︰-﹏]/;

export function isCjkChar(ch: string): boolean {
  return CJK_RE.test(ch);
}

/** True when the query contains any CJK character (needs bigram matching). */
export function queryHasCjk(query: string): boolean {
  return CJK_RE.test(query);
}

/**
 * Tokenize text for the FTS index: consecutive CJK characters become
 * overlapping two-character bigrams, other characters split on whitespace.
 */
export function tokenizeForFts(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  let word = '';
  const flushWord = () => {
    if (word) {
      out.push(word);
      word = '';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    if (isCjkChar(ch)) {
      flushWord();
      // Overlap: the next CJK char starts another bigram, so advance by one.
      // A single-char token is only needed for a one-char run (no bigram covers it).
      if (i + 1 < text.length && isCjkChar(text[i + 1])) {
        out.push(ch + text[i + 1]);
      } else if (i === 0 || !isCjkChar(text[i - 1])) {
        out.push(ch);
      }
      i += 1;
    } else if (/\s/.test(ch)) {
      flushWord();
      i += 1;
    } else {
      word += ch;
      i += 1;
    }
  }
  flushWord();
  return out;
}

/** Serialize text into the space-joined token stream stored in the FTS table. */
export function bigramText(text: string): string {
  return tokenizeForFts(text).join(' ');
}

/**
 * Build the FTS MATCH expression for a query.
 * CJK input becomes bigram tokens; separated non-CJK words become prefix terms
 * so "react" still matches "react native".
 */
export function buildFtsQuery(query: string): string | null {
  const tokens = query.trim() ? tokenizeForFts(query) : [];
  if (!tokens.length) return null;
  const hasCjk = queryHasCjk(query);
  return tokens
    .map((t) => {
      if (hasCjk) return `"${t}"`;
      // Non-CJK: prefix match so partial English words hit.
      return /^[A-Za-z0-9_]+$/.test(t) ? `"${t}"*` : `"${t}"`;
    })
    .join(' ');
}

/** Sections -> plain text used both for the FTS index and snippet extraction. */
export function sectionsToText(sections: Section[]): string {
  const parts: string[] = [];
  for (const s of sections) {
    switch (s.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
      case 'callout':
      case 'link':
        parts.push(s.text);
        break;
      case 'list':
        parts.push(s.items.join(' '));
        break;
      case 'image':
        if (s.caption) parts.push(s.caption);
        break;
      case 'chart':
        if (s.title) parts.push(s.title);
        break;
    }
  }
  return parts.join('\n');
}

/**
 * Extract a context window around the first occurrence of the query in the
 * original text, for the highlighted snippet in search results. CJK queries
 * match from their first character (the index uses overlapping bigrams).
 */
export function makeSnippet(text: string, query: string, context = 24): SearchSnippet | null {
  const q = query.trim();
  if (!q || !text) return null;
  const hasCjk = queryHasCjk(q);
  const lowerText = text.toLowerCase();
  const lowerQ = q.toLowerCase();

  let idx = -1;
  let matchEnd = -1;
  if (hasCjk) {
    idx = lowerText.indexOf(lowerQ[0]);
    if (idx >= 0) matchEnd = idx + Math.min(q.length, text.length - idx);
  } else {
    idx = lowerText.indexOf(lowerQ);
    if (idx >= 0) matchEnd = idx + q.length;
  }
  if (idx < 0) return null;

  const start = Math.max(0, idx - context);
  const end = Math.min(text.length, matchEnd + context);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  const body = text.slice(start, end);
  return {
    text: `${prefix}${body}${suffix}`,
    matchStart: idx - start + prefix.length,
    matchEnd: matchEnd - start + prefix.length,
  };
}
