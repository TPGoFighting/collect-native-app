/* global describe, it, expect */
import {
  bigramText,
  buildFtsQuery,
  isCjkChar,
  makeSnippet,
  queryHasCjk,
  sectionsToText,
  tokenizeForFts,
} from '@/lib/fts';
import type { Section } from '@/lib/types';

describe('fts tokenizer (CJK bigram)', () => {
  it('detects CJK characters', () => {
    expect(isCjkChar('收')).toBe(true);
    expect(isCjkChar('a')).toBe(false);
    expect(queryHasCjk('全文检索')).toBe(true);
    expect(queryHasCjk('react hooks')).toBe(false);
    expect(queryHasCjk('')).toBe(false);
  });

  it('splits consecutive CJK characters into overlapping bigrams', () => {
    expect(tokenizeForFts('全文检索')).toEqual(['全文', '文检', '检索']);
    expect(tokenizeForFts('收藏三篇')).toEqual(['收藏', '藏三', '三篇']);
  });

  it('indexes a lone CJK character so single-char queries still match', () => {
    expect(tokenizeForFts('读')).toEqual(['读']);
  });

  it('keeps non-CJK words intact and splits on whitespace', () => {
    expect(tokenizeForFts('react hooks guide')).toEqual(['react', 'hooks', 'guide']);
    // mixed script: CJK bigrams plus the latin word
    expect(tokenizeForFts('阅读 React')).toEqual(['阅读', 'React']);
  });

  it('serializes the index form losslessly for bigram matching', () => {
    const text = '离线全文阅读器';
    // every two-char substring of the CJK run must appear as a token
    const serialized = bigramText(text);
    for (let i = 0; i < text.length - 1; i++) {
      expect(serialized).toContain(text.slice(i, i + 2));
    }
  });

  it('handles empty and whitespace-only input', () => {
    expect(tokenizeForFts('')).toEqual([]);
    expect(bigramText('   ')).toBe('');
    expect(buildFtsQuery('')).toBeNull();
    expect(buildFtsQuery('   ')).toBeNull();
  });
});

describe('fts query builder', () => {
  it('builds quoted bigram terms for CJK queries', () => {
    // 收藏 -> bigram token 收藏
    expect(buildFtsQuery('收藏')).toBe('"收藏"');
    expect(buildFtsQuery('全文检索')).toBe('"全文" "文检" "检索"');
  });

  it('builds prefix terms for non-CJK words', () => {
    expect(buildFtsQuery('react')).toBe('"react"*');
  });

  it('uses plain quoted terms for non-CJK tokens with symbols', () => {
    expect(buildFtsQuery('a-b')).toBe('"a-b"');
  });

  it('does not allow FTS syntax injection from user queries', () => {
    // NEAR / OR / NOT are FTS5 operators; quoting neutralizes them
    expect(buildFtsQuery('a OR b')).not.toContain(' OR');
    // a lone quote becomes one quoted token, not a broken MATCH expression
    expect(buildFtsQuery('"')).toBe('"""');
  });
});

describe('fts sectionsToText', () => {
  it('flattens the 8 section kinds into plain text', () => {
    const sections: Section[] = [
      { type: 'heading', level: 2, text: '标题' },
      { type: 'paragraph', text: '正文段落' },
      { type: 'quote', text: '引用' },
      { type: 'list', ordered: false, items: ['甲', '乙'] },
      { type: 'image', url: 'https://x/y.png', caption: '图注' },
      { type: 'chart', title: '图表', subtitle: '', unit: '', bars: [] },
      { type: 'callout', text: '提示' },
      { type: 'link', text: '链接', url: 'https://x' },
    ];
    const text = sectionsToText(sections);
    for (const needle of ['标题', '正文段落', '引用', '甲', '乙', '图注', '图表', '提示', '链接']) {
      expect(text).toContain(needle);
    }
  });

  it('returns empty string for no sections', () => {
    expect(sectionsToText([])).toBe('');
  });
});

describe('fts makeSnippet', () => {
  it('centers the match in a context window with ellipses', () => {
    const text = '前'.repeat(40) + '关键词在这里' + '后'.repeat(40);
    const s = makeSnippet(text, '关键词', 10);
    expect(s).not.toBeNull();
    expect(s!.text.startsWith('…')).toBe(true);
    expect(s!.text.endsWith('…')).toBe(true);
    expect(s!.text.slice(s!.matchStart, s!.matchEnd)).toBe('关键词');
  });

  it('reports match range inside the returned snippet string', () => {
    const s = makeSnippet('这是一段很短的文本', '短的', 4);
    expect(s).not.toBeNull();
    expect(s!.text.slice(s!.matchStart, s!.matchEnd)).toBe('短的');
  });

  it('is case-insensitive for latin queries', () => {
    const s = makeSnippet('Using React Native offline', 'react', 5);
    expect(s).not.toBeNull();
    expect(s!.text.slice(s!.matchStart, s!.matchEnd)).toBe('React');
  });

  it('returns null when the query is absent or inputs empty', () => {
    expect(makeSnippet('没有任何相关内容', '不存在的词')).toBeNull();
    expect(makeSnippet('', '词')).toBeNull();
    expect(makeSnippet('正文', '')).toBeNull();
  });
});
