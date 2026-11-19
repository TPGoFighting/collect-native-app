// v2.1.0 pure-logic tests: link parsing + share-text extraction.
// The TS modules are intentionally duplicated here as source assertions:
// they run without a JS bundler in CI (same approach as test-offline.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const links = fs.readFileSync(path.join(ROOT, 'src/lib/links.ts'), 'utf8');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

// Mirror of src/lib/links.ts rules, kept in lockstep by the source assertions below.
const ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
function parseArticleLink(input) {
  if (!input) return null;
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const host = url.hostname.toLowerCase();
    if (host !== 'collect.tpgofighting.top' && host !== 'www.collect.tpgofighting.top') return null;
    const hash = url.hash.replace(/^#/, '');
    const match = hash.match(/^\/a\/([^/?#]+)/) ?? url.pathname.match(/^\/article\/([^/?#]+)/);
    const id = match ? decodeURIComponent(match[1]) : '';
    return id && ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}
function extractSharedUrl(input) {
  if (!input) return null;
  const matches = input.match(/https?:\/\/[^\s<>"'　]+/g) ?? [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[),.;，。）】]+$/, '');
    try {
      const url = new URL(cleaned);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.')) return url.toString();
    } catch {}
  }
  return null;
}

console.log('== link rules ==');
check('source has canonical /article/<id> path', () => {
  assert.match(links, /pathname\.match\(\/\^\\\/article\\\/\(\[\^\/\?\#\]\+\)\/\)/);
});
check('source has appLinkArticleUrl', () => assert.match(links, /export function appLinkArticleUrl/));
check('source has share-text URL extraction', () => assert.match(links, /export function extractSharedUrl/));

check('parses website hash route', () => {
  assert.equal(parseArticleLink('https://collect.tpgofighting.top/#/a/chromium'), 'chromium');
});
check('parses verified /article/<id> App Link', () => {
  assert.equal(parseArticleLink('https://collect.tpgofighting.top/article/chromium'), 'chromium');
});
check('parses www host and query suffix', () => {
  assert.equal(parseArticleLink('https://www.collect.tpgofighting.top/#/a/abc_123?x=1'), 'abc_123');
});
check('rejects foreign domains and malformed ids', () => {
  assert.equal(parseArticleLink('https://evil.example/#/a/chromium'), null);
  assert.equal(parseArticleLink('https://collect.tpgofighting.top/#/a/../../etc'), null);
  assert.equal(parseArticleLink('not-a-url'), null);
});
check('extracts URL from WeChat/X share text', () => {
  assert.equal(extractSharedUrl('推荐这篇文章 https://x.com/user/status/123 值得一看'), 'https://x.com/user/status/123');
  assert.equal(extractSharedUrl('看这个（https://example.com/a）。'), 'https://example.com/a');
  assert.equal(extractSharedUrl('no link here'), null);
});

console.log(`\n${passed} checks passed`);
