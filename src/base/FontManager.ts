import type { FontInfo } from 'vexflow';
import {
  FontWeight,
  FontSlant,
  FontWidth,
  Skia,
} from '@shopify/react-native-skia';
import type {
  SkFont,
  SkFontMgr,
  SkTypeface,
  SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

// import Logger, { LogCategory } from '../shared/Logger';

// const Log = Logger.extend(LogCategory.FontManager);

interface ResolvedFont {
  family: string;
  size: number;
  weight: FontWeight;
  slant: FontSlant;
  width: FontWidth;
}

const PT_TO_PX = 4 / 3; // 1pt = 1.333px

function parseSize(size?: string | number): number {
  'worklet';

  if (typeof size === 'number') {
    return size;
  }

  if (typeof size === 'string') {
    const match = size.trim().match(/^(\d+(?:\.\d+)?)(px|pt|em|%)?$/);

    if (match) {
      const value = parseFloat(match?.[1] || '30');
      const unit = match[2] || 'pt';

      switch (unit) {
        case 'px':
          return value * 0.75; // 1px = 0.75pt
        case 'em':
          return value * 12; // Assuming 1em = 16px = 12pt
        case '%':
          return value * 0.12; // Assuming 100% = 12pt
        case 'pt':
        default:
          return value;
      }
    }
  }

  return 30; // Default font size in pixels
}

function parseWeight(weight?: string | number): FontWeight {
  'worklet';

  const weightStr = String(weight || 'normal').toLowerCase();

  return (
    {
      'normal': FontWeight.Normal,
      'bold': FontWeight.Bold,
      '100': FontWeight.Thin,
      '200': FontWeight.ExtraLight,
      '300': FontWeight.Light,
      '400': FontWeight.Normal,
      '500': FontWeight.Medium,
      '600': FontWeight.SemiBold,
      '700': FontWeight.Bold,
      '800': FontWeight.ExtraBold,
      '900': FontWeight.Black,
    }[weightStr] || FontWeight.Normal
  );
}

function parseSlant(style?: string): FontSlant {
  'worklet';

  const styleStr = String(style || 'normal').toLowerCase();

  return (
    {
      normal: FontSlant.Upright,
      italic: FontSlant.Italic,
      oblique: FontSlant.Oblique,
    }[styleStr] || FontSlant.Upright
  );
}

export default class FontManager {
  __workletClass = true;

  private fontProvider: SkTypefaceFontProvider;
  private defaultFontName: string;
  private familiesLower: string[];
  // Each runtime's clone of a __workletClass instance owns its own caches
  // from the moment of capture; entries only ever hold same-usage-pattern
  // Skia host objects, which are shareable across reanimated runtimes (the
  // provider itself already crosses the same way).
  private familyMatchCache: Record<string, string> = {};
  private skFontCache: Record<string, SkFont> = {};
  private systemFontMgr: SkFontMgr | null | undefined;

  constructor(fontProvider: SkTypefaceFontProvider, defaultFontName: string) {
    this.fontProvider = fontProvider;
    this.defaultFontName = defaultFontName;

    const families: string[] = [];

    for (let i = 0; i < fontProvider.countFamilies(); i++) {
      families.push(fontProvider.getFamilyName(i));
    }

    if (!families.includes(defaultFontName)) {
      throw new Error(
        `Default font "${defaultFontName}" is not available in the font provider. Available fonts: ${families.join(
          ', '
        )}`
      );
    }

    this.familiesLower = families.map((family) => family.toLowerCase());
  }

  private isFamilyAvailable(family: string): boolean {
    return this.familiesLower.includes(family.toLowerCase());
  }

  private getFamiliesFromFont(font: string | FontInfo): string[] {
    if (typeof font === 'string') {
      return font.split(',').map((f) => f.trim());
    }

    return (font as FontInfo).family
      ? (font as FontInfo).family!.split(',').map((f) => f.trim())
      : [];
  }

  private matchFontFamilyName(font: string | FontInfo): string {
    if (!font) {
      return this.defaultFontName;
    }

    const cacheKey = typeof font === 'string' ? font : font.family ?? '';
    const cached = this.familyMatchCache[cacheKey];

    if (cached != null) {
      return cached;
    }

    const families = this.getFamiliesFromFont(font);
    let matched = this.defaultFontName;

    for (const family of families) {
      if (this.isFamilyAvailable(family)) {
        matched = family;
        break;
      }
    }

    this.familyMatchCache[cacheKey] = matched;
    return matched;
  }

  /** A system typeface for the first requested family the OS knows, walking
   * the list in order until a provider family is reached — so a requested
   * family the OS knows wins over a later provider family; null when the OS
   * knows none of them, or when the provider has the first one. */
  private matchSystemTypeface(
    font: string | FontInfo | undefined,
    style: { weight: FontWeight; slant: FontSlant; width: FontWidth }
  ): SkTypeface | null {
    if (!font || this.matchFontFamilyName(font) !== this.defaultFontName) {
      return null;
    }

    if (this.systemFontMgr === undefined) {
      try {
        this.systemFontMgr = Skia.FontMgr.System();
      } catch {
        this.systemFontMgr = null;
      }
    }

    if (!this.systemFontMgr) {
      return null;
    }

    for (const family of this.getFamiliesFromFont(font)) {
      if (this.isFamilyAvailable(family)) {
        return null;
      }
      try {
        const typeface = this.systemFontMgr.matchFamilyStyle(family, style);
        if (typeface) {
          return typeface;
        }
      } catch {
        // The OS has no such family; try the next one.
      }
    }

    return null;
  }

  resolveFontDescriptor(
    font?: string | FontInfo,
    size?: string | number,
    weight?: string | number,
    style?: string
  ): ResolvedFont {
    return {
      family: this.matchFontFamilyName(font || ''),
      size: parseSize(
        typeof font === 'string' ? size : (font as FontInfo).size || size
      ),
      weight: parseWeight(weight),
      slant: parseSlant(style),
      width: FontWidth.Normal,
    };
  }

  createSkFont(
    font?: string | FontInfo,
    size?: string | number,
    weight?: string | number,
    style?: string
  ): SkFont {
    const {
      family,
      size: resolvedSize,
      weight: resolvedWeight,
      slant,
    } = this.resolveFontDescriptor(font, size, weight, style);

    const fontStyle = {
      weight: resolvedWeight,
      slant,
      width: FontWidth.Normal,
    };
    const requested = typeof font === 'string' ? font : font?.family ?? '';
    const cacheKey = `${requested}|${family} ${resolvedSize} ${resolvedWeight} ${slant}`;
    const cached = this.skFontCache[cacheKey];

    if (cached != null) {
      return cached;
    }

    const typeface =
      this.matchSystemTypeface(font, fontStyle) ??
      this.fontProvider.matchFamilyStyle(family, fontStyle);

    if (!typeface) {
      throw new Error(
        `Failed to create SkFont. No matching typeface found for family "${family}" with weight "${resolvedWeight}" and slant "${slant}".`
      );
    }

    const skFont = Skia.Font(typeface, resolvedSize * PT_TO_PX); // Convert from points to pixels
    this.skFontCache[cacheKey] = skFont;
    return skFont;
  }
}
