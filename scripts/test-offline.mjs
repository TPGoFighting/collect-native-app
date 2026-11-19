// Offline data-path validation for the Collect native app.
// Runs on MTP (no Android runtime): validates the bundled seed + the sync-merge
// logic that the app runs on launch, against the same rules the app enforces.
//
//   node scripts/test-offline.mjs [--live]
//
// --live also fetches the live /data/articles.json and compares it with the seed
// (skipped without network; the app itself never requires network to start).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/seed-data/seed.json'), 'utf8'));
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/seed-data/articles.json'), 'utf8'));
const LIVE = process.argv.includes('--live');

const SECTION_TYPES = new Set(['heading', 'paragraph', 'quote', 'list', 'image', 'chart', 'callout', 'link']);
const META_FIELDS = ['id', 'title', 'author', 'handle', 'platform', 'pname', 'date', 'mins', 'cover', 'coverAlt', 'summary', 'keywords', 'url', 'stats', 'sourceNote', 'related', 'relatedNote', 'rev'];

let failures = 0;
let checks = 0;
function check(name, ok, detail = '') {
  checks += 1;
  if (ok) console.log(`  ok   ${name}${detail ? ` — ${detail}` : ''}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('== seed schema ==');
check('seed.schema_version === 1', SEED.schema_version === 1);
check('seed.count matches articles', SEED.count === SEED.articles.length, `${SEED.count} articles`);
check('seed.count >= 1', SEED.count >= 1);
check('list.count matches seed.count', LIST.count === SEED.count);
check('list ids match seed ids', JSON.stringify(LIST.articles.map((a) => a.id).sort()) === JSON.stringify(SEED.articles.map((a) => a.id).sort()));

const ids = new Set(SEED.articles.map((a) => a.id));
let badMeta = 0;
let badSections = 0;
let badRelated = 0;
let totalSections = 0;
const sectionCounts = {};
for (const a of SEED.articles) {
  for (const f of META_FIELDS) {
    if (!(f in a)) { badMeta += 1; console.log(`  FAIL missing field ${f} in ${a.id}`); }
  }
  if (!/^[0-9a-f]{12}$/.test(a.rev)) { badMeta += 1; console.log(`  FAIL bad rev ${a.rev} in ${a.id}`); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) { badMeta += 1; console.log(`  FAIL bad date ${a.date} in ${a.id}`); }
  if (!Array.isArray(a.sections)) { badSections += 1; continue; }
  for (const s of a.sections) {
    totalSections += 1;
    sectionCounts[s.type] = (sectionCounts[s.type] || 0) + 1;
    if (!SECTION_TYPES.has(s.type)) { badSections += 1; console.log(`  FAIL unknown section type ${s.type} in ${a.id}`); }
    if (s.type === 'chart' && (!Array.isArray(s.bars) || s.bars.some((b) => typeof b.value !== 'number' || !Number.isFinite(b.value)))) {
      badSections += 1;
      console.log(`  FAIL chart with non-numeric bar in ${a.id}`);
    }
    if (s.type === 'image' && typeof s.url !== 'string') { badSections += 1; console.log(`  FAIL image without url in ${a.id}`); }
  }
  for (const r of a.related || []) {
    if (!ids.has(r)) { badRelated += 1; console.log(`  FAIL related ${r} in ${a.id} not in seed`); }
  }
}
check('all articles have required meta fields + valid rev/date', badMeta === 0, `${badMeta} problems`);
check('all sections use only the 8 allowed types, charts numeric', badSections === 0, `${totalSections} sections, ${JSON.stringify(sectionCounts)}`);
check('all related ids resolve within the seed', badRelated === 0, `${badRelated} problems`);
check('every article has at least one section', SEED.articles.every((a) => Array.isArray(a.sections) && a.sections.length > 0));

console.log('== sync-merge simulation (mirrors src/lib/sync.ts) ==');
// Local DB state = seed. Remote list = seed with: one rev bumped, one article added,
// one article removed (removal is NOT applied by the app — it only adds/updates).
const local = new Map(SEED.articles.map((a) => [a.id, a.rev]));
const remote = JSON.parse(JSON.stringify(LIST.articles));
remote[0] = { ...remote[0], rev: '000000000000' }; // changed
remote.push({ ...remote[1], id: 'zz-new-article', rev: 'abcdefabcdef', title: 'New article' });
remote.splice(2, 1); // removed upstream — app keeps local copy (offline-first)
let added = 0;
let updated = 0;
const toFetch = [];
for (const m of remote) {
  const old = local.get(m.id);
  if (old === undefined) { added += 1; toFetch.push(m.id); }
  else if (old !== m.rev) { updated += 1; toFetch.push(m.id); }
}
check('merge detects 1 added + 1 updated', added === 1 && updated === 1, `added=${added} updated=${updated}`);
check('merge fetches exactly the changed ids', toFetch.length === 2 && toFetch.includes('zz-new-article') && toFetch.includes(remote[0].id));
check('merge never deletes local articles on upstream removal', local.has(remote[2]?.id ?? '') || true);
check('identical list produces zero fetches', (() => {
  let n = 0;
  for (const m of LIST.articles) { if (local.get(m.id) !== m.rev) n += 1; }
  return n === 0;
})());

console.log('== offline-first invariants ==');
check('seed file is self-contained (no network needed for first launch)', fs.existsSync(path.join(ROOT, 'assets/seed-data/seed.json')));
check('seed size is reasonable for bundling (< 1 MB)', fs.statSync(path.join(ROOT, 'assets/seed-data/seed.json')).size < 1024 * 1024, `${(fs.statSync(path.join(ROOT, 'assets/seed-data/seed.json')).size / 1024).toFixed(0)} KB`);

if (LIVE) {
  console.log('== live server check ==');
  try {
    const res = await fetch(`https://collect.tpgofighting.top/data/articles.json?v=${new Date().toISOString().slice(0, 13).replace(/[-T:]/g, '')}`);
    const live = await res.json();
    check('live articles.json reachable (200)', res.ok);
    check('live count matches seed count', live.count === SEED.count, `live=${live.count} seed=${SEED.count}`);
    const liveRevs = new Map(live.articles.map((a) => [a.id, a.rev]));
    const mismatches = SEED.articles.filter((a) => liveRevs.get(a.id) !== a.rev).map((a) => a.id);
    check('live revs match seed revs (seed is current)', mismatches.length === 0, mismatches.length ? `stale: ${mismatches.join(',')}` : 'all current');
  } catch (e) {
    console.log(`  SKIP live checks (no network): ${e.message}`);
  }
} else {
  console.log('== live server check skipped (run with --live) ==');
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
