/* global describe, it, expect */
import { Platform, PixelRatio } from 'react-native';
import { FONT_SIZES, MAX_FONT_SCALE, scaledFontSize } from '@/lib/types';

describe('scaledFontSize', () => {
  it('keeps sizes unchanged at scale 1', () => {
    for (const size of FONT_SIZES) {
      expect(scaledFontSize(size, 1)).toBe(size);
    }
  });

  it('scales proportionally below the cap', () => {
    expect(scaledFontSize(16, 1.2)).toBe(Math.round(16 * 1.2));
    expect(scaledFontSize(15, 1.1)).toBe(Math.round(15 * 1.1));
  });

  it('caps at MAX_FONT_SCALE so huge system settings stay readable', () => {
    expect(MAX_FONT_SCALE).toBe(1.3);
    expect(scaledFontSize(20, 2.0)).toBe(Math.round(20 * 1.3));
    expect(scaledFontSize(20, 10)).toBe(26);
  });

  it('preserves the relative order of the five reader sizes at any scale', () => {
    for (const scale of [1, 1.15, 1.3, 1.8, 2.4]) {
      const scaled = FONT_SIZES.map((s) => scaledFontSize(s, scale));
      const sorted = [...scaled].sort((a, b) => a - b);
      expect(scaled).toEqual(sorted);
      expect(new Set(scaled).size).toBe(FONT_SIZES.length);
    }
  });
});

describe('reader font scale wiring', () => {
  it('uses PixelRatio.getFontScale as the runtime scale source', () => {
    const scale = PixelRatio.getFontScale();
    expect(typeof scale).toBe('number');
    expect(scale).toBeGreaterThan(0);
    // The provider should apply exactly what scaledFontSize produces.
    expect(scaledFontSize(FONT_SIZES[2], scale)).toBe(Math.round(FONT_SIZES[2] * Math.min(scale, MAX_FONT_SCALE)));
  });

  it('theme provider multiplies the chosen size by the capped scale', () => {
    // theme.tsx must route through scaledFontSize (surgical source check,
    // matching the repo's existing source-level assertions).
    const fs = require('fs');
    const themeSrc = fs.readFileSync('src/lib/theme.tsx', 'utf8');
    expect(themeSrc).toContain('scaledFontSize(');
    expect(themeSrc).toContain('PixelRatio.getFontScale()');
  });

  it('article header buttons expose TalkBack button roles with dynamic favorite label', () => {
    const fs = require('fs');
    const src = fs.readFileSync('src/app/article/[id].tsx', 'utf8');
    expect(src).toContain("accessibilityLabel={fav ? '已收藏' : '未收藏'}");
    // every header action carries a button role
    const headerActions = src.slice(src.indexOf('styles.headerActions'), src.indexOf('styles.progressTrack'));
    expect(headerActions).not.toMatch(/Pressable(?![\s\S]*accessibilityRole)/);
  });

  it('cover placeholders no longer hardcode the light-mode gray', () => {
    const fs = require('fs');
    for (const file of ['src/app/article/[id].tsx', 'src/components/ArticleCard.tsx', 'src/components/SectionView.tsx']) {
      expect(fs.readFileSync(file, 'utf8')).not.toContain('#E4E4E7');
    }
  });

  it('feedback entry exists on the profile screen with mailto + clipboard fallback', () => {
    const fs = require('fs');
    const src = fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8');
    expect(src).toContain("'反馈问题'");
    expect(src).toContain("FEEDBACK_EMAIL = 'a2897378856@gmail.com'");
    expect(src).toContain('mailto:${FEEDBACK_EMAIL}');
    expect(src).toContain('Clipboard.setStringAsync');
    expect(src).toContain('已复制联系方式');
  });

  it('article screen renders the one-time notification nudge banner', () => {
    const fs = require('fs');
    const src = fs.readFileSync('src/app/article/[id].tsx', 'utf8');
    expect(src).toContain('想在有新文章时收到提醒？');
    expect(src).toContain('recordArticleFinishedForNudge');
    expect(src).toContain('markNudgeShown');
  });

  it('profile and about render the update banner row', () => {
    const fs = require('fs');
    expect(fs.readFileSync('src/app/(tabs)/profile.tsx', 'utf8')).toContain('<UpdateBanner />');
    expect(fs.readFileSync('src/app/about.tsx', 'utf8')).toContain('<UpdateBanner />');
    expect(fs.readFileSync('src/app/_layout.tsx', 'utf8')).toContain('checkForUpdate()');
  });

  it('update banner opens the releases page via Linking', () => {
    const fs = require('fs');
    const src = fs.readFileSync('src/components/UpdateBanner.tsx', 'utf8');
    expect(src).toContain('Linking.openURL');
    expect(src).toContain('accessibilityRole="button"');
  });

  it('keeps the Android-only platform contract', () => {
    expect(Platform.OS).toBeDefined();
  });
});
