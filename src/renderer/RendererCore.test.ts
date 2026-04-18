import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@shopify/react-native-skia', () => {
  const createMockFont = (size = 12) => ({
    getGlyphIDs: (text: string) =>
      Array.from(text).map((_, index) => index + 1),
    getGlyphWidths: (glyphs: number[]) => glyphs.map(() => size * 0.6),
    getMetrics: () => ({
      ascent: -size * 0.8,
      descent: size * 0.2,
    }),
    getTypeface: () => ({ family: 'MockFamily' }),
    measureText: (text: string) => ({
      x: 0,
      y: -size * 0.8,
      width: text.length * size * 0.6,
      height: size,
    }),
  });

  const createPaint = () => ({
    setAntiAlias: jest.fn(),
    setBlendMode: jest.fn(),
    setColor: jest.fn(),
    setStrokeCap: jest.fn(),
    setStrokeJoin: jest.fn(),
    setStrokeWidth: jest.fn(),
    setStyle: jest.fn(),
  });

  const createPath = () => ({
    addArc: jest.fn(),
    addPath: jest.fn(),
    addRect: jest.fn(),
    close: jest.fn(),
    cubicTo: jest.fn(),
    lineTo: jest.fn(),
    moveTo: jest.fn(),
    quadTo: jest.fn(),
  });

  return {
    BlendMode: { Clear: 'clear' },
    Canvas: 'Canvas',
    PaintStyle: { Fill: 'fill', Stroke: 'stroke' },
    Picture: 'Picture',
    Skia: {
      Color: (color: string) => color,
      Font: jest.fn((_typeface: unknown, size: number) => {
        return createMockFont(size);
      }),
      FontMgr: {
        System: jest.fn(() => ({
          countFamilies: jest.fn(() => 1),
          getFamilyName: jest.fn(() => 'MockFamily'),
          matchFamilyStyle: jest.fn(() => ({ family: 'MockFamily' })),
        })),
      },
      Paint: jest.fn(() => createPaint()),
      Path: {
        Make: jest.fn(() => createPath()),
      },
      XYWHRect: jest.fn(
        (x: number, y: number, width: number, height: number) => ({
          x,
          y,
          width,
          height,
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
    useFont: jest.fn(() => null),
  };
});

import {
  createInfiniteScoreExampleConfig,
  INFINITE_SCORE_EXAMPLE_SCORE,
} from '../internalExamples/InfiniteScoreExample';
import SkiaVexflowContext from '../SkiaVexflowContext';
import { RendererCore } from './RendererCore';

const TEST_VIEWPORT = {
  width: 360,
  height: 480,
};

function createMockCanvas() {
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

function createConfig() {
  return createInfiniteScoreExampleConfig(TEST_VIEWPORT);
}

describe('RendererCore', () => {
  it('measures the shared infinite-score example deterministically', () => {
    const engine = new RendererCore<SkiaVexflowContext>();
    const request = {
      score: INFINITE_SCORE_EXAMPLE_SCORE,
      config: createConfig(),
    };

    const firstPlan = engine.measure(request);
    const secondPlan = engine.measure(request);

    expect(secondPlan).toEqual(firstPlan);
    expect(firstPlan.contentSize.width).toBeGreaterThan(
      request.config.viewport.width
    );
    expect(firstPlan.systems[0]?.range).toEqual({
      startMeasureIndex: 0,
      endMeasureIndex: 6,
    });
    expect(firstPlan.staves.map((staff) => staff.staffId)).toEqual([
      'staff-right-hand',
      'staff-left-hand',
    ]);
    expect(
      new Set(firstPlan.measures.map((measure) => measure.globalMeasureIndex))
    ).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(firstPlan.measures).toHaveLength(12);

    const changedMeterMeasures = firstPlan.measures.filter(
      (measure) => measure.globalMeasureIndex === 2
    );
    expect(changedMeterMeasures).toHaveLength(2);
    expect(
      changedMeterMeasures.every(
        (measure) => measure.resolvedState.meter.beats === 3
      )
    ).toBe(true);
    expect(
      changedMeterMeasures.every((measure) => measure.display.showTimeSignature)
    ).toBe(true);
  });

  it('renders exact geometry for the shared infinite-score example', () => {
    const engine = new RendererCore<SkiaVexflowContext>();
    const plan = engine.measure({
      score: INFINITE_SCORE_EXAMPLE_SCORE,
      config: createConfig(),
    });

    const fullContext = new SkiaVexflowContext(
      createMockCanvas() as never,
      null
    );
    const fullRender = engine.render({
      plan,
      context: fullContext,
    });

    const rangedContext = new SkiaVexflowContext(
      createMockCanvas() as never,
      null
    );
    const rangedRender = engine.render({
      plan,
      context: rangedContext,
      range: {
        startMeasureIndex: 2,
        endMeasureIndex: 5,
      },
    });

    expect(fullRender.contentSize).toEqual(plan.contentSize);
    expect(fullRender.measureLayouts).toHaveLength(12);
    expect(fullRender.noteBounds.length).toBeGreaterThan(0);
    expect(fullRender.noteBounds.every((note) => note.bounds.width > 0)).toBe(
      true
    );
    expect(fullRender.noteBounds.every((note) => note.bounds.height > 0)).toBe(
      true
    );

    expect(rangedRender.measureLayouts).toHaveLength(6);
    expect(
      rangedRender.measureLayouts.every(
        (measure) =>
          measure.globalMeasureIndex >= 2 && measure.globalMeasureIndex < 5
      )
    ).toBe(true);

    const fullRangeLayouts = fullRender.measureLayouts.filter(
      (measure) =>
        measure.globalMeasureIndex >= 2 && measure.globalMeasureIndex < 5
    );
    expect(rangedRender.measureLayouts).toEqual(fullRangeLayouts);

    const fullRangeNotes = fullRender.noteBounds.filter(
      (note) => note.globalMeasureIndex >= 2 && note.globalMeasureIndex < 5
    );
    expect(rangedRender.noteBounds).toEqual(fullRangeNotes);
  });
});
