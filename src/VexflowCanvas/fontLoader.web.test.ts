import { beforeEach, describe, expect, it, jest } from '@jest/globals';

var mockLoadSkiaWeb = jest.fn(async () => undefined);
var mockRegisterFont = jest.fn();
var mockMakeFreeTypeFaceFromData = jest.fn();
var mockFont = jest.fn();
var mockDataFromURI = jest.fn();
var mockDataFromBytes = jest.fn();

jest.mock('@shopify/react-native-skia/src/web', () => ({
  LoadSkiaWeb: mockLoadSkiaWeb,
}));

jest.mock('@shopify/react-native-skia', () => ({
  Skia: {
    Data: {
      fromBytes: (...args: unknown[]) => mockDataFromBytes(...args),
      fromURI: (...args: unknown[]) => mockDataFromURI(...args),
    },
    Font: (...args: unknown[]) => mockFont(...args),
    Typeface: {
      MakeFreeTypeFaceFromData: (...args: unknown[]) =>
        mockMakeFreeTypeFaceFromData(...args),
    },
    TypefaceFontProvider: {
      Make: jest.fn(() => ({
        registerFont: (...args: unknown[]) => mockRegisterFont(...args),
      })),
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
}));

jest.mock('react-native', () => ({
  Image: {
    resolveAssetSource: jest.fn(() => ({
      uri: 'asset:///Bravura.otf',
    })),
  },
}));

import { loadWebFontResource } from './fontLoader.web';

describe('web font loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (globalThis as { CanvasKit?: unknown }).CanvasKit;
  });

  it('registers the Bravura typeface with a web font provider', async () => {
    const data = { bytes: 'font-data' };
    const typeface = { familyName: 'Bravura' };
    const font = { size: 30 };

    mockDataFromURI.mockImplementation(async () => data);
    mockMakeFreeTypeFaceFromData.mockReturnValue(typeface);
    mockFont.mockReturnValue(font);

    const resource = await loadWebFontResource(123 as any);

    expect(mockDataFromURI).toHaveBeenCalledWith('asset:///Bravura.otf');
    expect(mockMakeFreeTypeFaceFromData).toHaveBeenCalledWith(data);
    expect(mockRegisterFont).toHaveBeenCalledWith(typeface, 'Bravura');
    expect(mockFont).toHaveBeenCalledWith(typeface, 30);
    expect(resource).toEqual(
      expect.objectContaining({
        bravuraFont: font,
        bravuraTypeface: typeface,
        cacheKeyPrefix: 'Bravura-web',
      })
    );
    expect(resource?.fontManager).toEqual(
      expect.objectContaining({
        registerFont: expect.any(Function),
      })
    );
  });

  it('creates font data directly from Uint8Array sources', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const data = { bytes };
    const typeface = { familyName: 'Bravura' };

    mockDataFromBytes.mockReturnValue(data);
    mockMakeFreeTypeFaceFromData.mockReturnValue(typeface);
    mockFont.mockReturnValue({ size: 30 });

    await loadWebFontResource(bytes);

    expect(mockDataFromBytes).toHaveBeenCalledWith(bytes);
    expect(mockDataFromURI).not.toHaveBeenCalled();
  });
});
