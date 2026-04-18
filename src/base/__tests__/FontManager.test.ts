import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { FontInfo } from 'vexflow';

jest.mock('@shopify/react-native-skia', () => ({
  FontWeight: {
    Thin: 'Thin',
    ExtraLight: 'ExtraLight',
    Light: 'Light',
    Normal: 'Normal',
    Medium: 'Medium',
    SemiBold: 'SemiBold',
    Bold: 'Bold',
    ExtraBold: 'ExtraBold',
    Black: 'Black',
  },
  FontSlant: {
    Upright: 'Upright',
    Italic: 'Italic',
    Oblique: 'Oblique',
  },
  FontWidth: {
    Normal: 'Normal',
  },
  Skia: {
    Font: jest.fn(),
  },
}));

import {
  FontSlant,
  FontWeight,
  FontWidth,
  Skia,
} from '@shopify/react-native-skia';
import FontManager from '../FontManager';

const mockSkiaFont = Skia.Font as jest.Mock;

type MockFontProvider = {
  countFamilies: ReturnType<typeof jest.fn>;
  getFamilyName: ReturnType<typeof jest.fn>;
  matchFamilyStyle: ReturnType<typeof jest.fn>;
};

function createFontProvider(families: string[]): MockFontProvider {
  return {
    countFamilies: jest.fn(() => families.length),
    getFamilyName: jest.fn((index: number) => families[index] ?? ''),
    matchFamilyStyle: jest.fn((family: string, style: unknown) => ({
      family,
      style,
    })),
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('FontManager', () => {
  it('throws when the configured default family is not available', () => {
    const fontProvider = createFontProvider(['Bravura', 'Academico']);

    expect(() => new FontManager(fontProvider as never, 'Fallback')).toThrow(
      'Default font "Fallback" is not available in the font provider. Available fonts: Bravura, Academico'
    );
  });

  it('resolves the first available family from a comma-separated font string', () => {
    const fontProvider = createFontProvider([
      'DefaultFamily',
      'Bravura',
      'Academico',
    ]);
    const manager = new FontManager(fontProvider as never, 'DefaultFamily');

    expect(
      manager.resolveFontDescriptor(
        'Missing, academico',
        '16px',
        '700',
        'italic'
      )
    ).toEqual({
      family: 'academico',
      size: 12,
      weight: FontWeight.Bold,
      slant: FontSlant.Italic,
      width: FontWidth.Normal,
    });
  });

  it('falls back to the default family and parses size from a FontInfo object', () => {
    const fontProvider = createFontProvider(['DefaultFamily', 'Bravura']);
    const manager = new FontManager(fontProvider as never, 'DefaultFamily');
    const font = {
      family: 'Missing',
      size: '150%',
    } as FontInfo;

    expect(manager.resolveFontDescriptor(font)).toEqual({
      family: 'DefaultFamily',
      size: 18,
      weight: FontWeight.Normal,
      slant: FontSlant.Upright,
      width: FontWidth.Normal,
    });
  });

  it('creates a Skia font with the resolved family, size, weight, and slant', () => {
    const fontProvider = createFontProvider(['DefaultFamily', 'Academico']);
    const manager = new FontManager(fontProvider as never, 'DefaultFamily');
    const typeface = { name: 'Academico-MediumOblique' };
    const font = {
      family: 'Missing, Academico',
      size: '2em',
    } as FontInfo;

    fontProvider.matchFamilyStyle.mockReturnValue(typeface);
    mockSkiaFont.mockReturnValue({ typeface, size: 32 });

    expect(manager.createSkFont(font, undefined, 500, 'oblique')).toEqual({
      typeface,
      size: 32,
    });

    expect(fontProvider.matchFamilyStyle).toHaveBeenCalledWith('Academico', {
      weight: FontWeight.Medium,
      slant: FontSlant.Oblique,
      width: FontWidth.Normal,
    });

    expect(mockSkiaFont).toHaveBeenCalledWith(typeface, 32);
  });

  it('throws when the font provider cannot supply a matching typeface', () => {
    const fontProvider = createFontProvider(['DefaultFamily']);
    const manager = new FontManager(fontProvider as never, 'DefaultFamily');

    fontProvider.matchFamilyStyle.mockReturnValue(null);

    expect(() => manager.createSkFont('', undefined, 'bold', 'italic')).toThrow(
      'Failed to create SkFont. No matching typeface found for family "DefaultFamily" with weight "Bold" and slant "Italic".'
    );
  });
});
