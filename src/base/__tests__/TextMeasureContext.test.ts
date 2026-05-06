import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Font } from 'vexflow';

jest.mock('vexflow', () => ({
  Font: {
    fromCSSString: jest.fn(),
  },
}));

import TextMeasureContext from '../TextMeasureContext';

const mockFromCSSString = Font.fromCSSString as jest.Mock;

type MockFont = {
  measureText: ReturnType<typeof jest.fn>;
  getGlyphIDs: ReturnType<typeof jest.fn>;
  getGlyphWidths: ReturnType<typeof jest.fn>;
};

function createContext(font: MockFont) {
  return {
    getCurrentSkFont: jest.fn(() => font),
    setFont: jest.fn(),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
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

  it('updates the backing context font from a canvas-style font string', () => {
    const fontInfo = {
      family: 'Bravura',
      size: '30pt',
      weight: 'normal',
      style: 'normal',
    };
    mockFromCSSString.mockReturnValue(fontInfo);
    const font = {
      measureText: jest.fn(),
      getGlyphIDs: jest.fn(),
      getGlyphWidths: jest.fn(),
    };
    const context = createContext(font);
    const textMeasureContext = new TextMeasureContext(context as never);

    textMeasureContext.font = '30pt Bravura';

    expect(textMeasureContext.font).toBe('30pt Bravura');
    expect(textMeasureContext.get()).toBe('30pt Bravura');
    expect(mockFromCSSString).toHaveBeenCalledWith('30pt Bravura');
    expect(context.setFont).toHaveBeenCalledWith(fontInfo);

    textMeasureContext.set('12px Academico');

    expect(textMeasureContext.font).toBe('12px Academico');
    expect(mockFromCSSString).toHaveBeenCalledWith('12px Academico');
  });

  it('uses the updated backing context font for later measurements', () => {
    const initialFont = {
      measureText: jest.fn(),
      getGlyphIDs: jest.fn(),
      getGlyphWidths: jest.fn(),
    };
    const updatedFont = {
      measureText: jest.fn(() => ({
        x: 0,
        y: -6,
        width: 20,
        height: 9,
      })),
      getGlyphIDs: jest.fn(() => [31, 32]),
      getGlyphWidths: jest.fn(() => [7, 8]),
    };
    const context = createContext(initialFont);
    context.setFont.mockImplementation(() => {
      context.getCurrentSkFont.mockReturnValue(updatedFont);
    });
    mockFromCSSString.mockReturnValue({
      family: 'Academico',
      size: '12px',
      weight: 'normal',
      style: 'normal',
    });
    const textMeasureContext = new TextMeasureContext(context as never);

    textMeasureContext.set('12px Bravura');

    expect(textMeasureContext.measureText('hi')).toMatchObject({
      width: 15,
      actualBoundingBoxAscent: 6,
      actualBoundingBoxDescent: 3,
    });
    expect(updatedFont.measureText).toHaveBeenCalledWith('hi');
  });
});
