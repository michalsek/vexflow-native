import { Skia, type SkFont } from '@shopify/react-native-skia';

import { fontCache, PT_TO_PX } from './constants';
import { type ParsedCssFont } from './types';

export function getAdvanceWidth(font: SkFont, text: string): number {
  const glyphs = font.getGlyphIDs(text);
  const widths = font.getGlyphWidths(glyphs);
  return widths.reduce((sum, width) => sum + width, 0);
}

export function toPxFontSize(size: number | string | undefined): number {
  if (size === undefined || size === null) return 12;

  if (typeof size === 'number' && Number.isFinite(size)) {
    return size * PT_TO_PX;
  }

  if (typeof size === 'string') {
    const match = size.trim().match(/^(\d+(?:\.\d+)?)(px|pt)?$/i);

    if (match) {
      const value = Number.parseFloat(match[1] || '12');
      const unit = match[2]?.toLowerCase();
      if (!unit || unit === 'px') return value;
      return value * PT_TO_PX;
    }
  }

  return 12;
}

export function parseCssFontShorthand(cssFont: string): ParsedCssFont {
  const sizeMatch = cssFont.match(/(\d+(?:\.\d+)?(?:px|pt))/i);

  if (!sizeMatch) {
    return { sizePx: 12 };
  }

  const sizePx = toPxFontSize(sizeMatch[1]);

  const family = cssFont
    .slice((sizeMatch.index ?? 0) + (sizeMatch[1]?.length || 0))
    .trim();

  return {
    sizePx,
    family: family || undefined,
  };
}

export function createFont(
  size: number,
  familyName?: string,
  bravuraFont?: SkFont | null
): SkFont {
  const fontSize = Number.isFinite(size) && size > 0 ? size : 12;
  const family = familyName?.trim();

  if (family?.toLowerCase().includes('bravura') && bravuraFont) {
    const cacheKey = `Bravura-${fontSize}`;
    const cached = fontCache.get(cacheKey);
    if (cached) return cached;

    const typeface = bravuraFont.getTypeface();
    if (typeface) {
      try {
        const font = Skia.Font(typeface, fontSize);
        fontCache.set(cacheKey, font);
        return font;
      } catch {
        // On web (CanvasKit WASM), Font.getTypeface() returns a raw pointer
        // that can't be reused in new Font(). Return original font as fallback.
        return bravuraFont;
      }
    }
  }

  // System font lookup — not available on React Native Web (CanvasKit WASM)
  // where Skia.FontMgr.System().matchFamilyStyle() throws "Not implemented".
  try {
    const fontMgr = Skia.FontMgr.System();
    const requestedFamilies = family
      ? family
          .replace(/["']/g, '')
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : [];

    for (const requestedFamily of requestedFamilies) {
      const typeface = fontMgr.matchFamilyStyle(requestedFamily, {
        weight: 400,
        width: 5,
        slant: 0,
      });

      if (typeface) {
        return Skia.Font(typeface, fontSize);
      }
    }

    for (let i = 0; i < fontMgr.countFamilies(); i++) {
      const systemFamily = fontMgr.getFamilyName(i);
      const typeface = fontMgr.matchFamilyStyle(systemFamily, {
        weight: 400,
        width: 5,
        slant: 0,
      });

      if (typeface) {
        return Skia.Font(typeface, fontSize);
      }
    }
  } catch {
    // On web (CanvasKit WASM), system font APIs are not available.
    // Fall back to the Bravura font if provided.
    if (bravuraFont) {
      const typeface = bravuraFont.getTypeface();
      if (typeface) {
        const cacheKey = `fallback-${fontSize}`;
        const cached = fontCache.get(cacheKey);
        if (cached) return cached;

        const font = Skia.Font(typeface, fontSize);
        fontCache.set(cacheKey, font);
        return font;
      }
    }
  }

  throw new Error('Unable to create a Skia font.');
}
