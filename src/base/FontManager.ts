import type { FontInfo } from 'vexflow';
import {
  FontWeight,
  FontSlant,
  FontWidth,
  Skia,
} from '@shopify/react-native-skia';
import type {
  SkFont,
  SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import Logger, { LogCategory } from '../shared/Logger';

const Log = Logger.extend(LogCategory.FontManager);

interface ResolvedFont {
  family: string;
  size: number;
  weight: FontWeight;
  slant: FontSlant;
  width: FontWidth;
}

const PT_TO_PX = 4 / 3; // 1pt = 1.333px

export default class FontManager {
  private fontProvider: SkTypefaceFontProvider;
  private defaultFontName: string;

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
  }

  private isFamilyAvailable(family: string): boolean {
    for (let i = 0; i < this.fontProvider.countFamilies(); i++) {
      if (
        this.fontProvider.getFamilyName(i).toLowerCase() ===
        family.toLowerCase()
      ) {
        return true;
      }
    }

    return false;
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

    const families = this.getFamiliesFromFont(font);

    for (const family of families) {
      if (this.isFamilyAvailable(family)) {
        return family;
      }
    }

    return this.defaultFontName;
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

    const typeface = this.fontProvider.matchFamilyStyle(family, {
      weight: resolvedWeight,
      slant,
      width: FontWidth.Normal,
    });

    if (!typeface) {
      throw new Error(
        `Failed to create SkFont. No matching typeface found for family "${family}" with weight "${resolvedWeight}" and slant "${slant}".`
      );
    }

    Log.log(
      `Created SkFont with family "${family}", size ${resolvedSize}px, weight ${resolvedWeight}, slant ${slant}.`
    );

    return Skia.Font(typeface, resolvedSize * PT_TO_PX); // Convert from points to pixels
  }
}

function parseSize(size?: string | number): number {
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
  const styleStr = String(style || 'normal').toLowerCase();

  return (
    {
      normal: FontSlant.Upright,
      italic: FontSlant.Italic,
      oblique: FontSlant.Oblique,
    }[styleStr] || FontSlant.Upright
  );
}
