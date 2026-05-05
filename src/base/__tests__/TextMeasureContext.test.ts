import { afterEach, describe, expect, it, jest } from '@jest/globals';

import TextMeasureContext from '../TextMeasureContext';

type MockFont = {
  measureText: ReturnType<typeof jest.fn>;
  getGlyphIDs: ReturnType<typeof jest.fn>;
  getGlyphWidths: ReturnType<typeof jest.fn>;
};

function createContext(font: MockFont) {
  return {
    getCurrentSkFont: jest.fn(() => font),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TextMeasureContext', () => {
  it('measures text using glyph advance widths and bounding rect metrics', () => {
    const font = {
      measureText: jest.fn(() => ({
        x: -2,
        y: -9,
        width: 18,
        height: 13,
      })),
      getGlyphIDs: jest.fn(() => [11, 12, 13]),
      getGlyphWidths: jest.fn(() => [4, 5.5, 6]),
    };
    const context = createContext(font);
    const textMeasureContext = new TextMeasureContext(context as never);

    expect(textMeasureContext.measureText('abc')).toEqual({
      width: 15.5,
      actualBoundingBoxAscent: 9,
      actualBoundingBoxDescent: 4,
      fontBoundingBoxAscent: 9,
      fontBoundingBoxDescent: 4,
      actualBoundingBoxLeft: -2,
      actualBoundingBoxRight: 16,
    });
    expect(context.getCurrentSkFont).toHaveBeenCalledTimes(1);
    expect(font.measureText).toHaveBeenCalledWith('abc');
    expect(font.getGlyphIDs).toHaveBeenCalledWith('abc');
    expect(font.getGlyphWidths).toHaveBeenCalledWith([11, 12, 13]);
  });

  it('clamps ascent at zero when the measured rect starts below the baseline', () => {
    const font = {
      measureText: jest.fn(() => ({
        x: 1,
        y: 3,
        width: 9,
        height: 7,
      })),
      getGlyphIDs: jest.fn(() => [21]),
      getGlyphWidths: jest.fn(() => [12]),
    };
    const textMeasureContext = new TextMeasureContext(
      createContext(font) as never
    );

    expect(textMeasureContext.measureText('x')).toEqual({
      width: 12,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 10,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 10,
      actualBoundingBoxLeft: 1,
      actualBoundingBoxRight: 10,
    });
  });

  it('logs for the unimplemented get and set accessors', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const font = {
      measureText: jest.fn(),
      getGlyphIDs: jest.fn(),
      getGlyphWidths: jest.fn(),
    };
    const textMeasureContext = new TextMeasureContext(
      createContext(font) as never
    );

    expect(textMeasureContext.get()).toBe('');
    textMeasureContext.set('12px Bravura');

    expect(consoleSpy).toHaveBeenNthCalledWith(
      1,
      'TextMeasureContext: Method "get" is not implemented yet.'
    );
    expect(consoleSpy).toHaveBeenNthCalledWith(
      2,
      'TextMeasureContext: Method "set" is not implemented yet.'
    );
  });
});
