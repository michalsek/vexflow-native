import {
  Skia,
  type SkFont,
  type SkFontMgr,
  type SkTypeface,
} from '@shopify/react-native-skia';

import { fontCache } from '../constants';

export const BRAVURA_FONT_FAMILY = 'Bravura';
export const BRAVURA_FONT_SIZE = 30;

const DEFAULT_FONT_STYLE = {
  weight: 400,
  width: 5,
  slant: 0,
} as const;

export type LoadedFontResource = {
  bravuraFont: SkFont;
  bravuraTypeface?: SkTypeface | null;
  fontManager?: SkFontMgr | null;
  cacheKeyPrefix?: string;
};

export type BravuraFontSource = LoadedFontResource | SkFont | null;

function isLoadedFontResource(
  value: BravuraFontSource
): value is LoadedFontResource {
  return Boolean(value) && 'bravuraFont' in (value as LoadedFontResource);
}

function normalizeLoadedFontResource(
  value: BravuraFontSource
): LoadedFontResource | null {
  if (!value) {
    return null;
  }

  if (isLoadedFontResource(value)) {
    return value;
  }

  return {
    bravuraFont: value,
    bravuraTypeface: value.getTypeface(),
    cacheKeyPrefix: BRAVURA_FONT_FAMILY,
  };
}

function createCachedFont(
  cacheKey: string,
  typeface: SkTypeface,
  fontSize: number
): SkFont {
  const cached = fontCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const font = Skia.Font(typeface, fontSize);
  fontCache.set(cacheKey, font);
  return font;
}

function createBravuraFont(
  fontSize: number,
  fontResource: LoadedFontResource
): SkFont {
  const typeface =
    fontResource.bravuraTypeface ?? fontResource.bravuraFont.getTypeface();

  if (typeface) {
    const cachePrefix = fontResource.cacheKeyPrefix ?? BRAVURA_FONT_FAMILY;

    try {
      return createCachedFont(`${cachePrefix}-${fontSize}`, typeface, fontSize);
    } catch {
      return fontResource.bravuraFont;
    }
  }

  return fontResource.bravuraFont;
}

export function getAdvanceWidth(font: SkFont, text: string): number {
  const glyphs = font.getGlyphIDs(text);
  const widths = font.getGlyphWidths(glyphs);
  return widths.reduce((sum, width) => sum + width, 0);
}

export function createFont(
  size: number,
  familyName?: string,
  bravuraSource?: BravuraFontSource
): SkFont {
  const fontSize = Number.isFinite(size) && size > 0 ? size : 12;
  const family = familyName?.trim();
  const fontResource = normalizeLoadedFontResource(bravuraSource ?? null);

  if (
    family?.toLowerCase().includes(BRAVURA_FONT_FAMILY.toLowerCase()) &&
    fontResource
  ) {
    return createBravuraFont(fontSize, fontResource);
  }

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
      const typeface = fontMgr.matchFamilyStyle(
        requestedFamily,
        DEFAULT_FONT_STYLE
      );

      if (typeface) {
        return Skia.Font(typeface, fontSize);
      }
    }

    for (let i = 0; i < fontMgr.countFamilies(); i++) {
      const systemFamily = fontMgr.getFamilyName(i);
      const typeface = fontMgr.matchFamilyStyle(
        systemFamily,
        DEFAULT_FONT_STYLE
      );

      if (typeface) {
        return Skia.Font(typeface, fontSize);
      }
    }
  } catch {
    if (fontResource) {
      return createBravuraFont(fontSize, fontResource);
    }
  }

  if (fontResource) {
    return createBravuraFont(fontSize, fontResource);
  }

  throw new Error('Unable to create a Skia font.');
}
