/* global jest, describe, beforeEach, it, expect */
import { initDb, searchArticles, upsertArticle, getMeta, setMeta } from '@/lib/db';

/**
 * FTS integration over the sqlite mock: emulate articles + articles_fts +
 * meta tables in memory, driving the same getFirstSync/getAllSync/runSync
 * surface the lib uses (pattern from db-progress-backup.test.tsx).
 */
type Row = Record<string, unknown>;

const articles = new Map<string, Row>();
const fts = new Map<string, string>(); // article_id -> indexed body
const meta = new Map<string, string>();

jest.mock('expo-sqlite', () => {
  const db = {
    execSync: jest.fn(),
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => null),
    getAllSync: jest.fn(() => [] as Row[]),
    withTransactionSync: jest.fn((task: () => void) => task()),
  };
  return { openDatabaseSync: jest.fn(() => db) };
});

const sqlite = require('expo-sqlite') as { openDatabaseSync: jest.Mock };
const db = sqlite.openDatabaseSync('collect.db') as {
  getFirstSync: jest.Mock;
  getAllSync: jest.Mock;
  runSync: jest.Mock;
  execSync: jest.Mock;
  withTransactionSync: jest.Mock;
};

function row(id: string, title: string, sections: unknown[]): Row {
  return {
    id,
    title,
    author: '作者甲',
    handle: null,
    platform: '微信',
    pname: '公众号',
    date: '2025-06-01',
    mins: 5,
    cover: 'https://x/cover.png',
    cover_alt: '',
    summary: '摘要文本',
    keywords: '["关键词"]',
    url: '',
    stats: null,
    source_note: '',
    related_json: '[]',
    related_note: null,
    rev: 'r1',
    sections_json: JSON.stringify(sections),
    updated_at: '',
  };
}

function simulateSql(): void {
  db.execSync.mockImplementation(() => {});
  db.getFirstSync.mockImplementation((sql: string, params: unknown[] = []) => {
    if (/SELECT COUNT\(\*\) AS c FROM articles/.exec(sql)) return { c: articles.size };
    if (/SELECT value FROM meta WHERE key = \?/.exec(sql)) {
      return meta.has(params[0] as string) ? { value: meta.get(params[0] as string) } : null;
    }
    if (/SELECT value FROM user_state/.exec(sql)) return null;
    if (/SELECT .*FROM articles WHERE id = \?/.exec(sql)) {
      return articles.has(params[0] as string) ? articles.get(params[0] as string)! : null;
    }
    return null;
  });
  db.getAllSync.mockImplementation((sql: string, params: unknown[] = []) => {
    if (/SELECT id, sections_json FROM articles/.exec(sql)) {
      return [...articles.values()].map((r) => ({ id: r.id, sections_json: r.sections_json }));
    }
    if (/FROM articles_fts WHERE articles_fts MATCH \?/.exec(sql)) {
      // emulate FTS5 MATCH: quoted AND'ed tokens, '*' suffix = prefix match
      const terms = [...(params[0] as string).matchAll(/"((?:[^"]|"")*)"/g)].map((m) =>
        m[1].replace(/""/g, '"'),
      );
      const hits: { article_id: string; body: string }[] = [];
      for (const [id, body] of fts) {
        const ok = terms.every((t) =>
          t.endsWith('*') ? body.includes(t.slice(0, -1)) : body.includes(t),
        );
        if (ok) hits.push({ article_id: id, body });
      }
      return hits;
    }
    if (/FROM articles WHERE id IN/.exec(sql)) {
      return (params as string[]).flatMap((id) => (articles.has(id) ? [articles.get(id)!] : []));
    }
    if (/FROM articles WHERE id = \?/.exec(sql)) {
      return articles.has(params[0] as string) ? [articles.get(params[0] as string)!] : [];
    }
    if (/FROM articles\s+WHERE \(title LIKE/.exec(sql)) {
      const like = (params[0] as string).slice(1, -1);
      return [...articles.values()].filter((r) => {
        const hay = [r.title, r.author, r.summary, r.keywords].join(' ');
        if (!hay.includes(like)) return false;
        // platform filter (6th param when present)
        const plat = params[4] as string | undefined;
        if (plat !== undefined && r.platform !== plat) return false;
        return true;
      });
    }
    return [];
  });
  db.runSync.mockImplementation((sql: string, params: unknown[] = []) => {
    // fts statements first: "INSERT INTO articles" also matches articles_fts
    if (/INSERT INTO articles_fts/.exec(sql)) {
      fts.set(params[0] as string, params[1] as string);
      return;
    }
    if (/DELETE FROM articles_fts WHERE article_id = \?/.exec(sql)) {
      fts.delete(params[0] as string);
      return;
    }
    if (/INSERT INTO articles\s*\n?\s*\(/.exec(sql)) {
      const next = rowFromParams(params);
      // mirror the ON CONFLICT clause: a meta-only upsert (sections_json null)
      // keeps the previously stored sections
      if (next.sections_json === null) {
        const prev = articles.get(params[0] as string);
        if (prev) next.sections_json = prev.sections_json;
      }
      articles.set(params[0] as string, next);
      return;
    }
    if (/INSERT INTO meta/.exec(sql)) {
      meta.set(params[0] as string, params[1] as string);
      return;
    }
    if (/INSERT INTO user_state/.exec(sql)) return;
  });
  db.withTransactionSync.mockImplementation((task: () => void) => task());
}

// Rebuild a full articles row from the 20 bound params of upsertArticle.
function rowFromParams(p: unknown[]): Row {
  return {
    id: p[0], title: p[1], author: p[2], handle: p[3], platform: p[4], pname: p[5],
    date: p[6], mins: p[7], cover: p[8], cover_alt: p[9], summary: p[10],
    keywords: p[11], url: p[12], stats: p[13], source_note: p[14],
    related_json: p[15], related_note: p[16], rev: p[17],
    sections_json: p[18], updated_at: p[19],
  };
}

const seed = (id: string, title: string, body: string) =>
  upsertArticle({
    id, title, author: '作者甲', handle: null, platform: '微信', pname: '公众号',
    date: '2025-06-01', mins: 5, cover: 'https://x/c.png', coverAlt: '', summary: '摘要文本',
    keywords: ['关键词'], url: '', stats: null, sourceNote: '', related: [], relatedNote: null,
    rev: 'r1',
    sections: [{ type: 'paragraph', text: body }],
  } as never);

beforeEach(() => {
  articles.clear();
  fts.clear();
  meta.clear();
  simulateSql();
});

describe('FTS upgrade / rebuild path', () => {
  it('rebuilds the index once for an existing DB without the fts_built flag', () => {
    // Simulate a pre-FTS database: articles exist, index empty, no flag.
    articles.set('a1', row('a1', '标题一', [{ type: 'paragraph', text: '存量正文内容' }]));
    const { seeded } = initDb();
    expect(seeded).toBe(false);
    expect(getMeta('fts_built:v1')).toBe('1');
    expect(fts.get('a1')).toContain('存量');
    expect(fts.get('a1')).toContain('量正');
  });

  it('does not rebuild again when the flag is already set', () => {
    articles.set('a1', row('a1', '标题一', [{ type: 'paragraph', text: '存量正文内容' }]));
    meta.set('fts_built:v1', '1');
    initDb();
    // delete the index behind the flag's back: a rebuild would restore it
    fts.clear();
    initDb();
    expect(fts.size).toBe(0);
  });

  it('marks the index built when seeding a fresh install', () => {
    // count is 0 -> seed path runs (seed.json has articles)
    const res = initDb();
    expect(res.seeded).toBe(true);
    expect(getMeta('fts_built:v1')).toBe('1');
    // every seeded article is searchable in the body
    expect(fts.size).toBeGreaterThan(0);
  });
});

describe('FTS search via searchArticles', () => {
  beforeEach(() => {
    setMeta('fts_built:v1', '1');
  });

  it('finds body matches and returns a snippet with the keyword range', () => {
    seed('a1', '无关标题', '这篇文章讨论本地离线阅读的实践与取舍。');
    seed('a2', '另一个标题', '完全无关的正文。');
    const hits = searchArticles('离线阅读');
    expect(hits.map((h) => h.meta.id)).toContain('a1');
    expect(hits.map((h) => h.meta.id)).not.toContain('a2');
    const hit = hits.find((h) => h.meta.id === 'a1')!;
    expect(hit.snippet).not.toBeNull();
    expect(hit.snippet!.text.slice(hit.snippet!.matchStart, hit.snippet!.matchEnd)).toBe('离线阅读');
  });

  it('still returns title hits without snippets (meta search unchanged)', () => {
    seed('a1', '增量同步的设计', '正文完全不同。');
    const hits = searchArticles('增量');
    expect(hits.map((h) => h.meta.id)).toEqual(['a1']);
    expect(hits[0].snippet).toBeNull();
  });

  it('keeps body hits searchable after upserting new sections (incremental sync)', () => {
    seed('a1', '标题', '初版正文。');
    expect(searchArticles('后台任务').map((h) => h.meta.id)).toEqual([]);
    // sync writes updated sections with the same upsert path
    upsertArticle({
      id: 'a1', title: '标题', author: '作者甲', handle: null, platform: '微信',
      pname: '公众号', date: '2025-06-01', mins: 5, cover: 'https://x/c.png',
      coverAlt: '', summary: '摘要文本', keywords: ['关键词'], url: '', stats: null,
      sourceNote: '', related: [], relatedNote: null, rev: 'r2',
      sections: [{ type: 'paragraph', text: '新版正文包含后台任务说明。' }],
    } as never);
    expect(searchArticles('后台任务').map((h) => h.meta.id)).toEqual(['a1']);
  });

  it('meta-only upserts (no sections) keep the old index row intact', () => {
    seed('a1', '标题', '正文里有离线包。');
    upsertArticle({
      id: 'a1', title: '新标题', author: '作者甲', handle: null, platform: '微信',
      pname: '公众号', date: '2025-06-01', mins: 5, cover: 'https://x/c.png',
      coverAlt: '', summary: '摘要文本', keywords: ['关键词'], url: '', stats: null,
      sourceNote: '', related: [], relatedNote: null, rev: 'r3',
    } as never);
    expect(searchArticles('离线包').map((h) => h.meta.id)).toEqual(['a1']);
  });

  it('returns nothing for empty queries', () => {
    expect(searchArticles('')).toEqual([]);
    expect(searchArticles('   ')).toEqual([]);
  });

  it('matches latin words by prefix through the same query path', () => {
    seed('a1', '标题', 'learn react native today');
    expect(searchArticles('react').map((h) => h.meta.id)).toEqual(['a1']);
  });
});
