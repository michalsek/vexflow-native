import { describe, expect, it, jest } from '@jest/globals';

var mockSkiaFont = jest.fn((typeface: unknown, size: number) => ({
  size,
  typeface,
}));

var mockFontMgr = {
  countFamilies: jest.fn(() => 0),
  getFamilyName: jest.fn(() => ''),
  matchFamilyStyle: jest.fn(() => null),
};

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Font: (...args: any[]) => (mockSkiaFont as any)(...args),
    FontMgr: {
      System: jest.fn(() => mockFontMgr),
    },
  },
  StrokeCap: {
    Butt: 'butt',
    Round: 'round',
    Square: 'square',
  },
  StrokeJoin: {
    Bevel: 'bevel',
    Miter: 'miter',
    Round: 'round',
  },
  useFont: jest.fn(),
}));

import { createNativeFontResource } from './fontLoader.native';
import { createFont } from './fontUtils';

describe('font utils', () => {
  it('recreates Bravura fonts from an explicit typeface without getTypeface', () => {
    const bravuraFont = {
      getTypeface: jest.fn(() => null),
    };
    const typeface = { familyName: 'Bravura' };

    const font = createFont(24, 'Bravura', {
      bravuraFont: bravuraFont as any,
      bravuraTypeface: typeface as any,
      cacheKeyPrefix: 'Bravura-web',
    });

    expect(font).toEqual({ size: 24, typeface });
    expect(mockSkiaFont).toHaveBeenCalledWith(typeface, 24);
    expect(bravuraFont.getTypeface).not.toHaveBeenCalled();
  });

  it('falls back to the loaded Bravura font when typeface cloning fails', () => {
    const bravuraFont = {
      getTypeface: jest.fn(() => ({ familyName: 'Bravura' })),
    };

    mockSkiaFont.mockImplementationOnce(() => {
      throw new Error('Typeface clone failed');
    });

    const font = createFont(18, 'Bravura', bravuraFont as any);

    expect(font).toBe(bravuraFont);
  });

  it('captures the native typeface for downstream sized font creation', () => {
    const typeface = { familyName: 'Bravura' };
    const bravuraFont = {
      getTypeface: jest.fn(() => typeface),
    };

    expect(createNativeFontResource(bravuraFont as any)).toEqual({
      bravuraFont,
      bravuraTypeface: typeface,
      cacheKeyPrefix: 'Bravura-native',
    });
  });
});
