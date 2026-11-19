#!/usr/bin/env node
/**
 * extract-data.mjs — 从 collect 单文件导出（collect.html）抽取结构化数据。
 *
 * 用法：
 *   node scripts/extract-data.mjs --html <collect.html> --out <server-dir> --seed <app-seed-dir>
 *
 * 产出（--out，部署到 ATP /var/www/collect/）：
 *   data/articles.json            文章清单（含 related/relatedNote/rev）
 *   data/articles/<id>.json       单篇全文（结构化章节）
 *   assets/covers/<id>.webp       封面独立文件（从 ARTICLES.cover 的 base64 解出）
 *   assets/images/<id>-<n>.webp   文中图（从模板 figure 的 base64 解出；外链图片保持原 URL）
 *
 * 产出（--seed，提交进 App 仓库 assets/seed-data/，首装离线种子）：
 *   articles.json + articles/<id>.json（与 --out 的 JSON 完全相同，不含图片）
 *
 * 章节类型（与设计文档 4.3 节一致，只用这 8 种）：
 *   heading / paragraph / quote / list / image / chart / callout / link
 * 映射规则：
 *   h2/h3.sub/h4         -> heading
 *   p / p.standfirst     -> paragraph（standfirst 带 lead:true）
 *   blockquote           -> quote
 *   ul/ol                -> list
 *   figure > img         -> image（caption 取 figcaption）
 *   .chartbox > svg      -> chart（标题 .ct，说明 .cs，柱子从 svg <text> 成对解析）
 *   .callout             -> callout
 *   .leadbox             -> heading(h3) + paragraph
 *   .dcards              -> list（"**数字** — 说明"）
 *   .steps/.faq/.timeline/.vs -> list（每项 "**标题** 内容"）
 *   table.cmp            -> list（每行 "**首列** — 其余列 / 连接"）
 *   .srcbox              -> 原文链接（a.btn.solid href）+ 来源说明（.si 文本）
 *   p.no（小节编号）/ span.badge / h1 / .byline / details.tocm -> 跳过
 * 行内格式：<strong>/<b> -> **...**，<a> -> [text](url)，<em>/<i> -> *...*，<code> -> `...`
 *
 * related 计算与站内 JS 完全一致：TOPICS 同主题 0 分、同平台 1 分、其他 2 分
 * （稳定排序保持日期倒序），SISTER 姊妹篇置顶 + sisterNote，PINNED 置顶 + PNOTE。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as acorn from 'acorn';
import * as cheerio from 'cheerio';

const ALLOWED_TYPES = new Set(['heading', 'paragraph', 'quote', 'list', 'image', 'chart', 'callout', 'link']);
const BASE_URL = 'https://collect.tpgofighting.top';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const HTML_PATH = arg('--html', path.join(process.env.HOME, 'workspace/your_files/collect/collect.html'));
const OUT_DIR = arg('--out', '/tmp/collect-data');
const SEED_DIR = arg('--seed', '');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

// ---------- JS literal evaluation via acorn ----------
function evalNode(n) {
  if (!n) return null;
  switch (n.type) {
    case 'Literal': return n.value;
    case 'ArrayExpression': return n.elements.map(evalNode);
    case 'ObjectExpression': {
      const o = {};
      for (const p of n.properties) o[p.key.name || p.key.value] = evalNode(p.value);
      return o;
    }
    case 'UnaryExpression': return n.operator === '-' ? -evalNode(n.argument) : evalNode(n.argument);
    default: return undefined;
  }
}
function evalVar(src, name) {
  const ast = acorn.parse(src, { ecmaVersion: 2022 });
  for (const st of ast.body) {
    if (st.type === 'VariableDeclaration') {
      for (const d of st.declarations) {
        if (d.id.name === name) return evalNode(d.init);
      }
    }
  }
  return null;
}
function evalExprAt(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  // The value is a single object literal; extract it by brace-matching so we
  // never have to parse the rest of the page script (which is mid-function).
  const start = src.indexOf('{', i);
  if (start < 0) return null;
  let depth = 0, inStr = null, esc = false;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) {
      const ast = acorn.parse(`(${src.slice(start, j + 1)})`, { ecmaVersion: 2022 });
      return evalNode(ast.body[0].expression);
    } }
  }
  return null;
}

// ---------- inline HTML -> markdown-ish text ----------
function inlineText($, $el) {
  const render = ($node) => {
    const node = $node[0];
    if (!node) return '';
    if (node.type === 'text') return node.data;
    if (node.type !== 'tag') return '';
    const tag = node.name;
    const inner = () => $node.contents().toArray().map((c) => render($(c))).join('');
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b') return `**${inner()}**`;
    if (tag === 'em' || tag === 'i') return `*${inner()}*`;
    if (tag === 'code') return `\`${inner()}\``;
    if (tag === 'a') return `[${inner()}](${$node.attr('href') || ''})`;
    return inner();
  };
  const text = $el.contents().toArray().map((c) => render($(c))).join('');
  return text.replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
function textOf($, el) {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

// ---------- parse ARTICLES ----------
const artIdx = html.indexOf('var ARTICLES=[');
const artEnd = html.indexOf('</script>', artIdx);
const articles = evalVar(html.slice(artIdx, artEnd), 'ARTICLES').filter(Boolean);
console.log(`articles: ${articles.length}`);

// ---------- parse TOPICS / SISTER / PINNED / PNOTE ----------
const topics = evalExprAt(html, 'var TOPICS=') || {};
const sister = evalExprAt(html, 'var SISTER=') || {};
const pinned = evalExprAt(html, 'var PINNED=') || {};
const pnote = evalExprAt(html, 'var PNOTE=') || {};
// sister notes are inline in JS (if/else chain); extract with regex
const sisterNotes = {};
for (const m of html.matchAll(/else if\(cur\.id==='(\w+)'\)sisterNote='([^']*)'/g)) sisterNotes[m[1]] = m[2];
for (const m of html.matchAll(/if\(cur\.id==='(\w+)'\)sisterNote='([^']*)'/g)) sisterNotes[m[1]] = m[2];
function topicOf(id) {
  for (const k of Object.keys(topics)) if (topics[k].includes(id)) return k;
  return '';
}
function computeRelated(cur) {
  const ct = topicOf(cur.id);
  const others = articles.filter((x) => x.id !== cur.id);
  const sc = (x) => (ct && topicOf(x.id) === ct ? 0 : x.platform === cur.platform ? 1 : 2);
  others.sort((p, q) => sc(p) - sc(q)); // stable: keeps date-desc order within score
  let note = null;
  if (sister[cur.id]) {
    const sid = sister[cur.id];
    others.sort((p, q) => (p.id === sid ? 0 : 1) - (q.id === sid ? 0 : 1));
    note = sisterNotes[cur.id] || null;
  }
  if (pinned[cur.id]) {
    const pin = pinned[cur.id];
    others.sort((p, q) => {
      const pi = pin.indexOf(p.id), qi = pin.indexOf(q.id);
      if (pi > -1 || qi > -1) { if (pi === -1) return 1; if (qi === -1) return -1; return pi - qi; }
      return 0;
    });
    note = pnote[cur.id] || note;
  }
  return { related: others.slice(0, 3).map((o) => o.id), note };
}

// ---------- image helpers ----------
function parseDataUri(uri) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(uri || '');
  if (!m) return null;
  const ext = m[1] === 'image/webp' ? 'webp' : m[1] === 'image/jpeg' ? 'jpg' : m[1] === 'image/png' ? 'png' : 'bin';
  return { ext, buf: Buffer.from(m[2], 'base64') };
}
function sha12(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12); }

// ---------- template -> sections ----------
const warnings = [];
const typeCount = {};
function pushSection(sections, s) {
  if (!ALLOWED_TYPES.has(s.type)) { warnings.push(`unknown section type ${s.type}`); return; }
  typeCount[s.type] = (typeCount[s.type] || 0) + 1;
  sections.push(s);
}
function listFromItems(items) {
  const clean = items.map((t) => (t || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return clean.length ? { type: 'list', ordered: false, items: clean } : null;
}

const outArticles = [];
const imageFiles = new Map(); // hash -> rel path (dedup, per scope)
function saveImageBytes(buf, ext, preferredRel, scope) {
  const key = `${scope}:${sha12(buf)}`;
  if (imageFiles.has(key)) return imageFiles.get(key);
  const rel = preferredRel;
  const full = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  imageFiles.set(key, rel);
  return rel;
}

for (const a of articles) {
  const $ = cheerio.load(`<template id="${a.tpl}"></template>`, null, false);
  const tplMatch = html.match(new RegExp(`<template id="${a.tpl}">([\\s\\S]*?)</template>`));
  if (!tplMatch) { warnings.push(`${a.id}: template ${a.tpl} not found`); continue; }
  const $$ = cheerio.load(tplMatch[1], null, false);
  const sections = [];
  let imgIdx = 0;

  const handleFigure = ($fig) => {
    const $img = $fig.find('img').first();
    const src = $img.attr('src') || '';
    const caption = textOf($$, $fig.find('figcaption').first()) || a.alt || '';
    const d = parseDataUri(src);
    if (d) {
      imgIdx += 1;
      const rel = saveImageBytes(d.buf, d.ext, `assets/images/${a.id}-${imgIdx}.${d.ext}`, 'image');
      pushSection(sections, { type: 'image', url: `${BASE_URL}/${rel}`, caption });
    } else if (/^https?:\/\//.test(src)) {
      pushSection(sections, { type: 'image', url: src, caption });
    } else {
      warnings.push(`${a.id}: figure with unhandled src ${src.slice(0, 60)}`);
    }
  };

  const handleChart = ($box) => {
    const title = textOf($$, $box.find('.ct').first());
    const subtitle = textOf($$, $box.find('.cs').first());
    const texts = [];
    $box.find('svg text').each((_, t) => {
      const $t = $$(t);
      texts.push({ size: $t.attr('font-size') || '', bold: $t.attr('font-weight') === '700', text: textOf($$, t) });
    });
    // last text with font-size 12 is the unit note, but only if it reads like one
    // (a box subtitle in a diagram is also font-size 12 and must be kept)
    let unit = '';
    const last = texts[texts.length - 1];
    if (last && last.size === '12' && /单位|轴|来源|注：/.test(last.text)) unit = texts.pop().text;
    const numOf = (display) => {
      // strict: after removing decorations only a plain number may remain
      const cleaned = display
        .replace(/[\u2212\u2013\u2014]/g, '-')
        .replace(/[$¥€£]/g, '')
        .replace(/[+＋]/g, '')
        .replace(/[%,％]/g, '')
        .replace(/,/g, '')
        .replace(/\s+/g, '')
        .replace(/(亿元|万元|美元|欧元|家|个|次|人|月|天|小时|分钟|秒|分|篇|条|万|亿)$/, '');
      if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
      return parseFloat(cleaned);
    };
    // mode A: alternating label / value texts
    let bars = null;
    if (texts.length >= 4 && texts.length % 2 === 0) {
      const cand = [];
      let ok = true;
      for (let i = 0; i < texts.length; i += 2) {
        const v = numOf(texts[i + 1].text);
        if (v === null || !texts[i].text) { ok = false; break; }
        cand.push({ label: texts[i].text, value: v, display: texts[i + 1].text });
      }
      if (ok && cand.length >= 2) bars = cand;
    }
    // mode B: each text embeds its own value ("MINISO 8,303 家（95.8%）")
    if (!bars && texts.length >= 2) {
      const cand = [];
      let ok = true;
      for (const t of texts) {
        const nums = [...t.text.matchAll(/[\d,]+(?:\.\d+)?/g)].map((m) => parseFloat(m[0].replace(/,/g, '')));
        if (!nums.length) { ok = false; break; }
        const hasPct = /[%％]/.test(t.text);
        const value = hasPct ? nums[nums.length - 1] : nums[nums.length - 1];
        const label = t.text.replace(/[\d,]+(?:\.\d+)?/g, '').replace(/[（()）%％家个]/g, '').replace(/\s+/g, ' ').trim();
        if (!label) { ok = false; break; }
        cand.push({ label, value, display: t.text });
      }
      if (ok && cand.length >= 2) bars = cand;
    }
    if (bars) {
      pushSection(sections, { type: 'chart', title, subtitle, unit, bars });
      return;
    }
    // fallback: not a bar chart (e.g. cycle diagram) -> heading + list of boxes
    warnings.push(`${a.id}: chartbox is not a bar chart, converted to list (${title})`);
    if (title) pushSection(sections, { type: 'heading', level: 3, text: title });
    const items = [];
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (t.bold && i + 1 < texts.length && !texts[i + 1].bold) {
        items.push(`**${t.text}** ${texts[i + 1].text}`);
        i += 1;
      } else {
        items.push(t.text);
      }
    }
    const s = listFromItems(items);
    if (s) pushSection(sections, s);
  };

  const handleList = ($ul, ordered) => {
    const items = [];
    $ul.children('li').each((_, li) => {
      items.push(inlineText($$, $$(li)));
      $$(li).children('ul,ol').each((_, sub) => {
        $$(sub).children('li').each((_, sli) => items.push('· ' + inlineText($$, $$(sli))));
      });
    });
    const s = listFromItems(items);
    if (s) { s.ordered = ordered; pushSection(sections, s); }
  };

  const handleTable = ($table) => {
    const rows = [];
    $table.find('tr').each((ri, tr) => {
      const cells = $$(tr).find('th,td').map((_, c) => textOf($$, c)).get();
      if (ri === 0) return; // header row
      if (!cells.length) return;
      const first = cells[0];
      const rest = cells.slice(1).filter(Boolean).join(' / ');
      rows.push(rest ? `**${first}** — ${rest}` : `**${first}**`);
    });
    const s = listFromItems(rows);
    if (s) pushSection(sections, s);
  };

  const handleNode = ($el) => {
    const el = $el[0];
    if (!el || el.type !== 'tag') return;
    const tag = el.name;
    const cls = ($el.attr('class') || '').split(/\s+/).filter(Boolean);
    const has = (c) => cls.includes(c);
    if (tag === 'section') { $el.children().each((_, c) => handleNode($$(c))); return; }
    if (tag === 'span' && has('badge')) return;
    if (tag === 'h1' || tag === 'details') return;
    if (tag === 'div' && has('byline')) return;
    if (tag === 'p' && has('no')) return;
    if (tag === 'p' && has('standfirst')) { pushSection(sections, { type: 'paragraph', lead: true, text: inlineText($$, $el) }); return; }
    if (tag === 'p') { const t = inlineText($$, $el); if (t) pushSection(sections, { type: 'paragraph', text: t }); return; }
    if (tag === 'h2') { pushSection(sections, { type: 'heading', level: 2, text: textOf($$, el) }); return; }
    if (tag === 'h3') { pushSection(sections, { type: 'heading', level: 3, text: textOf($$, el) }); return; }
    if (tag === 'h4') { pushSection(sections, { type: 'heading', level: 4, text: textOf($$, el) }); return; }
    if (tag === 'ul') { handleList($el, false); return; }
    if (tag === 'ol') { handleList($el, true); return; }
    if (tag === 'blockquote') { const t = inlineText($$, $el); if (t) pushSection(sections, { type: 'quote', text: t }); return; }
    if (tag === 'figure') { handleFigure($el); return; }
    if (tag === 'div' && has('leadbox')) {
      $el.children().each((_, c) => handleNode($$(c)));
      return;
    }
    if (tag === 'div' && has('dcards')) {
      const items = [];
      $el.find('.dcard').each((_, d) => {
        const n = textOf($$, $$(d).find('.n').first());
        const p = textOf($$, $$(d).find('p').first());
        items.push(n ? `**${n}** — ${p}` : p);
      });
      const s = listFromItems(items);
      if (s) pushSection(sections, s);
      return;
    }
    if (tag === 'div' && has('callout')) {
      const t = inlineText($$, $el);
      if (t) pushSection(sections, { type: 'callout', text: t });
      return;
    }
    if (tag === 'div' && has('faq')) {
      const items = [];
      $el.children('div').each((_, d) => {
        const q = textOf($$, $$(d).find('b').first());
        const ans = inlineText($$, $$(d).find('p').first());
        items.push(q ? `**${q}** ${ans}` : ans);
      });
      const s = listFromItems(items);
      if (s) pushSection(sections, s);
      return;
    }
    if (tag === 'div' && has('steps')) {
      const items = [];
      $el.children('.step').each((_, d) => {
        const sn = textOf($$, $$(d).find('.sn').first());
        const h = textOf($$, $$(d).find('h4').first());
        const p = inlineText($$, $$(d).find('p').first());
        items.push(`**${[sn, h].filter(Boolean).join(' ')}**：${p}`);
      });
      const s = listFromItems(items);
      if (s) pushSection(sections, s);
      return;
    }
    if (tag === 'div' && has('timeline')) {
      const items = [];
      $el.children('div').each((_, d) => {
        const b = textOf($$, $$(d).find('b').first());
        const p = inlineText($$, $$(d).find('p').first());
        items.push(b ? `**${b}** ${p}` : p);
      });
      const s = listFromItems(items);
      if (s) pushSection(sections, s);
      return;
    }
    if (tag === 'div' && has('vs')) {
      const items = [];
      $el.children('div').each((_, d) => {
        const h = textOf($$, $$(d).find('h4').first());
        const p = inlineText($$, $$(d).find('p').first());
        items.push(h ? `**${h}** ${p}` : p);
      });
      const s = listFromItems(items);
      if (s) pushSection(sections, s);
      return;
    }
    if (tag === 'div' && has('chartbox')) { handleChart($el); return; }
    if (tag === 'div' && has('tblwrap')) { $el.find('table').each((_, t) => handleTable($$(t))); return; }
    if (tag === 'table') { handleTable($el); return; }
    if (tag === 'div' && has('srcbox')) return; // handled separately
    warnings.push(`${a.id}: unmapped <${tag}> class="${cls.join(' ')}"`);
  };

  const $art = $$('article.art');
  const root = $art.length ? $art : $$('body');
  root.children().each((_, c) => handleNode($$(c)));

  // original link + source note from .srcbox
  const $src = $$('.srcbox');
  const origUrl = $src.find('a.btn.solid').attr('href') || '';
  const sourceNote = textOf($$, $src.find('.si').first()) || '';
  const statsMatch = sourceNote.match(/（([^）]*(?:回复|转帖|点赞|收藏|浏览)[^）]*)）/);
  const stats = statsMatch ? statsMatch[1] : null;

  // cover
  const coverData = parseDataUri(a.cover || '');
  let coverRel = '';
  if (coverData) {
    coverRel = saveImageBytes(coverData.buf, coverData.ext, `assets/covers/${a.id}.${coverData.ext}`, 'cover');
  } else if (/^https?:\/\//.test(a.cover || '')) {
    coverRel = a.cover;
  } else {
    warnings.push(`${a.id}: no usable cover`);
  }
  const coverUrl = coverRel.startsWith('http') ? coverRel : `${BASE_URL}/${coverRel}`;

  const handleMatch = /@([A-Za-z0-9_]+)/.exec(a.author || '');
  const { related, note } = computeRelated(a);
  const rev = sha12(Buffer.from(JSON.stringify({ id: a.id, t: a.title, d: a.date, s: sections }), 'utf-8'));

  outArticles.push({
    id: a.id,
    title: a.title,
    author: a.author,
    handle: handleMatch ? handleMatch[1] : null,
    platform: a.platform,
    pname: a.pname,
    date: a.date,
    mins: a.mins,
    cover: coverUrl,
    coverAlt: a.alt || '',
    summary: a.sum || '',
    keywords: (a.kw || '').split(/\s+/).filter(Boolean),
    url: origUrl,
    stats,
    sourceNote,
    related,
    relatedNote: note,
    rev,
    sections,
  });
}

// ---------- write outputs ----------
fs.mkdirSync(path.join(OUT_DIR, 'data/articles'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'assets/covers'), { recursive: true });
const list = {
  schema_version: 1,
  updated_at: new Date().toISOString(),
  count: outArticles.length,
  articles: outArticles.map(({ sections, ...rest }) => rest),
};
fs.writeFileSync(path.join(OUT_DIR, 'data/articles.json'), JSON.stringify(list, null, 1) + '\n');
for (const a of outArticles) {
  fs.writeFileSync(path.join(OUT_DIR, 'data/articles', `${a.id}.json`), JSON.stringify({ schema_version: 1, ...a }, null, 1) + '\n');
}
if (SEED_DIR) {
  fs.mkdirSync(SEED_DIR, { recursive: true });
  fs.writeFileSync(path.join(SEED_DIR, 'articles.json'), JSON.stringify(list, null, 1) + '\n');
  // seed.json: single-file bundle for the app (Metro can't require() a variable path)
  fs.writeFileSync(path.join(SEED_DIR, 'seed.json'), JSON.stringify({ schema_version: 1, updated_at: list.updated_at, count: outArticles.length, articles: outArticles }, null, 1) + '\n');
}

// ---------- validation + summary ----------
let fail = false;
for (const a of outArticles) {
  if (!a.sections.length) { console.error(`FAIL ${a.id}: zero sections`); fail = true; }
  if (!a.url) { console.error(`FAIL ${a.id}: no original url`); fail = true; }
  if (!a.related.length) { console.error(`FAIL ${a.id}: no related articles`); fail = true; }
  for (const s of a.sections) {
    if (s.type === 'chart' && !s.bars.length) { console.error(`FAIL ${a.id}: empty chart`); fail = true; }
    if (s.type === 'image' && !s.url) { console.error(`FAIL ${a.id}: image without url`); fail = true; }
  }
}
console.log('section types:', JSON.stringify(typeCount));
console.log(`images written: ${imageFiles.size} files`);
console.log(`warnings: ${warnings.length}`);
for (const w of warnings.slice(0, 20)) console.log('  WARN', w);
if (fail) { console.error('VALIDATION FAILED'); process.exit(1); }
console.log(`OK: ${outArticles.length} articles -> ${OUT_DIR}${SEED_DIR ? ` + seed ${SEED_DIR}` : ''}`);
