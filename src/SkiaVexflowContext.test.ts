import { afterEach, describe, expect, it, jest } from '@jest/globals';

var mockBuildPath = { kind: 'built-path' };
var mockFirstBuilder = {
  addArc: jest.fn(),
  addRect: jest.fn(),
  build: jest.fn(() => mockBuildPath),
  close: jest.fn(),
  cubicTo: jest.fn(),
  lineTo: jest.fn(),
  moveTo: jest.fn(),
  quadTo: jest.fn(),
};
var mockSecondBuilder = {
  addArc: jest.fn(),
  addRect: jest.fn(),
  build: jest.fn(() => ({ kind: 'second-built-path' })),
  close: jest.fn(),
  cubicTo: jest.fn(),
  lineTo: jest.fn(),
  moveTo: jest.fn(),
  quadTo: jest.fn(),
};
var mockMakeBuilder = jest.fn(() => mockFirstBuilder);

jest.mock('@shopify/react-native-skia', () => ({
  BlendMode: { Clear: 'clear' },
  PaintStyle: { Fill: 'fill', Stroke: 'stroke' },
  Skia: {
    Color: (color: string) => color,
    Font: jest.fn(() => ({
      getGlyphIDs: jest.fn(() => []),
      getGlyphWidths: jest.fn(() => []),
      getMetrics: jest.fn(() => ({
        ascent: -9.6,
        descent: 2.4,
      })),
      getTypeface: jest.fn(() => ({ family: 'MockFamily' })),
      measureText: jest.fn(() => ({
        height: 12,
        width: 0,
        x: 0,
        y: -9.6,
      })),
    })),
    FontMgr: {
      System: jest.fn(() => ({
        countFamilies: jest.fn(() => 1),
        getFamilyName: jest.fn(() => 'MockFamily'),
        matchFamilyStyle: jest.fn(() => ({ family: 'MockFamily' })),
      })),
    },
    Paint: jest.fn(() => ({
      setAntiAlias: jest.fn(),
      setBlendMode: jest.fn(),
      setColor: jest.fn(),
      setStrokeCap: jest.fn(),
      setStrokeJoin: jest.fn(),
      setStrokeWidth: jest.fn(),
      setStyle: jest.fn(),
    })),
    PathBuilder: {
      Make: () => mockMakeBuilder(),
    },
    XYWHRect: jest.fn(
      (x: number, y: number, width: number, height: number) => ({
        height,
        width,
        x,
        y,
      })
    ),
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

import SkiaVexflowContext from './SkiaVexflowContext';

function createCanvas() {
  return {
    clear: jest.fn(),
    drawPath: jest.fn(),
    drawRect: jest.fn(),
    drawText: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    scale: jest.fn(),
  };
}

afterEach(() => {
  jest.clearAllMocks();
  mockMakeBuilder.mockReset().mockImplementation(() => mockFirstBuilder);
});

describe('SkiaVexflowContext', () => {
  it('creates a fresh path builder on beginPath', () => {
    const canvas = createCanvas();
    mockMakeBuilder
      .mockReturnValueOnce(mockFirstBuilder)
      .mockReturnValueOnce(mockSecondBuilder);
    const context = new SkiaVexflowContext(canvas as never);

    context.beginPath().moveTo(10, 20).lineTo(30, 40);

    expect(mockMakeBuilder).toHaveBeenCalledTimes(2);
    expect(mockSecondBuilder.moveTo).toHaveBeenCalledWith(10, 20);
    expect(mockSecondBuilder.lineTo).toHaveBeenCalledWith(30, 40);
    expect(mockFirstBuilder.moveTo).not.toHaveBeenCalled();
  });

  it('routes path construction methods through PathBuilder', () => {
    const canvas = createCanvas();
    mockMakeBuilder.mockReturnValue(mockFirstBuilder);
    const context = new SkiaVexflowContext(canvas as never);

    context
      .moveTo(1, 2)
      .lineTo(3, 4)
      .quadraticCurveTo(5, 6, 7, 8)
      .bezierCurveTo(9, 10, 11, 12, 13, 14)
      .rect(15, 16, 17, 18)
      .arc(20, 21, 22, 0, Math.PI, false)
      .closePath();

    expect(mockFirstBuilder.moveTo).toHaveBeenCalledWith(1, 2);
    expect(mockFirstBuilder.lineTo).toHaveBeenCalledWith(3, 4);
    expect(mockFirstBuilder.quadTo).toHaveBeenCalledWith(5, 6, 7, 8);
    expect(mockFirstBuilder.cubicTo).toHaveBeenCalledWith(
      9,
      10,
      11,
      12,
      13,
      14
    );
    expect(mockFirstBuilder.addRect).toHaveBeenCalledWith({
      height: 18,
      width: 17,
      x: 15,
      y: 16,
    });
    expect(mockFirstBuilder.addArc).toHaveBeenCalledWith(
      {
        height: 44,
        width: 44,
        x: -2,
        y: -1,
      },
      0,
      180
    );
    expect(mockFirstBuilder.close).toHaveBeenCalled();
  });

  it('builds immutable paths for fill and stroke without clearing the builder', () => {
    const canvas = createCanvas();
    mockMakeBuilder.mockReturnValue(mockFirstBuilder);
    const context = new SkiaVexflowContext(canvas as never);

    context.moveTo(0, 0).lineTo(10, 10);
    context.fill();
    context.stroke();

    expect(mockFirstBuilder.build).toHaveBeenCalledTimes(2);
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      1,
      mockBuildPath,
      expect.any(Object)
    );
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      2,
      mockBuildPath,
      expect.any(Object)
    );
    expect(mockFirstBuilder.moveTo).toHaveBeenCalledTimes(1);
    expect(mockFirstBuilder.lineTo).toHaveBeenCalledTimes(1);
  });
});
