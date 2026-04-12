import { describe, expect, it, jest } from '@jest/globals';

import type { Score } from 'vexflow-native/state';
import type { RendererConfig } from 'vexflow-native/renderer';

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

import { RendererCore } from './RendererCore';
import SkiaVexflowContext from '../SkiaVexflowContext';

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

function createScore(): Score {
  return {
    id: 'score-1',
    defaultMeter: {
      beats: 4,
      beatUnit: 4,
      beaming: [2, 2],
    },
    staves: [
      {
        id: 'staff-top',
        order: 0,
        clef: 'treble',
        systemGroupId: 'grand',
        systemGroupRole: 'top',
        measures: [
          {
            id: 'top-measure-1',
            number: 1,
            keySignature: {
              tonic: 'G',
              mode: 'major',
            },
            voices: [
              {
                id: 'top-voice-1',
                index: 0,
                items: [
                  {
                    id: 'top-note-1',
                    type: 'note',
                    pitch: { step: 'C', octave: 4 },
                    duration: { length: 'q' },
                    voiceId: 'top-voice-1',
                  },
                  {
                    id: 'top-note-2',
                    type: 'note',
                    pitch: { step: 'D', octave: 4, accidental: '#' },
                    duration: { length: 'q' },
                    voiceId: 'top-voice-1',
                  },
                  {
                    id: 'top-note-3',
                    type: 'chord',
                    pitches: [
                      { step: 'E', octave: 4 },
                      { step: 'G', octave: 4 },
                    ],
                    duration: { length: 'q' },
                    voiceId: 'top-voice-1',
                  },
                  {
                    id: 'top-rest-1',
                    type: 'rest',
                    duration: { length: 'q' },
                    voiceId: 'top-voice-1',
                  },
                ],
              },
            ],
          },
          {
            id: 'top-measure-2',
            number: 2,
            meter: {
              beats: 3,
              beatUnit: 4,
              beaming: [3],
            },
            voices: [
              {
                id: 'top-voice-2',
                index: 0,
                items: [
                  {
                    id: 'top-note-4',
                    type: 'note',
                    pitch: { step: 'E', octave: 4 },
                    duration: { length: 'q' },
                    voiceId: 'top-voice-2',
                  },
                  {
                    id: 'top-note-5',
                    type: 'note',
                    pitch: { step: 'F', octave: 4 },
                    duration: { length: 'q' },
                    voiceId: 'top-voice-2',
                  },
                  {
                    id: 'top-note-6',
                    type: 'note',
                    pitch: { step: 'G', octave: 4 },
                    duration: { length: 'q' },
                    voiceId: 'top-voice-2',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'staff-bottom',
        order: 1,
        clef: 'bass',
        systemGroupId: 'grand',
        systemGroupRole: 'bottom',
        measures: [
          {
            id: 'bottom-measure-1',
            number: 1,
            voices: [
              {
                id: 'bottom-voice-1',
                index: 0,
                items: [
                  {
                    id: 'bottom-note-1',
                    type: 'note',
                    pitch: { step: 'C', octave: 3 },
                    duration: { length: 'h' },
                    voiceId: 'bottom-voice-1',
                  },
                  {
                    id: 'bottom-note-2',
                    type: 'note',
                    pitch: { step: 'G', octave: 2 },
                    duration: { length: 'h' },
                    voiceId: 'bottom-voice-1',
                  },
                ],
              },
            ],
          },
          {
            id: 'bottom-measure-2',
            number: 2,
            voices: [
              {
                id: 'bottom-voice-2',
                index: 0,
                items: [
                  {
                    id: 'bottom-note-3',
                    type: 'note',
                    pitch: { step: 'C', octave: 3 },
                    duration: { length: 'q' },
                    voiceId: 'bottom-voice-2',
                  },
                  {
                    id: 'bottom-note-4',
                    type: 'note',
                    pitch: { step: 'B', octave: 2 },
                    duration: { length: 'q' },
                    voiceId: 'bottom-voice-2',
                  },
                  {
                    id: 'bottom-note-5',
                    type: 'note',
                    pitch: { step: 'A', octave: 2 },
                    duration: { length: 'q' },
                    voiceId: 'bottom-voice-2',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function createConfig(): RendererConfig {
  return {
    layoutMode: 'infiniteScore',
    viewport: {
      width: 720,
      height: 480,
    },
    padding: {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    },
    spacing: {
      staffGap: 84,
      groupGap: 40,
      measureGap: 18,
      minimumMeasureWidth: 180,
    },
  };
}

describe('RendererCore', () => {
  it('measures deterministically and preserves grouped-staff planning', () => {
    const engine = new RendererCore<SkiaVexflowContext>();
    const request = {
      score: createScore(),
      config: createConfig(),
    };

    const firstPlan = engine.measure(request);
    const secondPlan = engine.measure(request);

    expect(secondPlan).toEqual(firstPlan);
    expect(firstPlan.systems[0]?.range).toEqual({
      startMeasureIndex: 0,
      endMeasureIndex: 2,
    });
    expect(firstPlan.staves.map((staff) => staff.staffId)).toEqual([
      'staff-top',
      'staff-bottom',
    ]);
    expect(
      firstPlan.measures.map((measure) => measure.globalMeasureIndex)
    ).toEqual([0, 1, 0, 1]);

    const secondMeasurePlans = firstPlan.measures.filter(
      (measure) => measure.globalMeasureIndex === 1
    );
    expect(secondMeasurePlans).toHaveLength(2);
    expect(
      secondMeasurePlans.every(
        (measure) => measure.resolvedState.meter.beats === 3
      )
    ).toBe(true);
    expect(
      secondMeasurePlans.every((measure) => measure.display.showTimeSignature)
    ).toBe(true);
  });

  it('renders exact note geometry and keeps range rendering aligned with the plan', () => {
    const engine = new RendererCore<SkiaVexflowContext>();
    const plan = engine.measure({
      score: createScore(),
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

    const rangeContext = new SkiaVexflowContext(
      createMockCanvas() as never,
      null
    );
    const rangedRender = engine.render({
      plan,
      context: rangeContext,
      range: {
        startMeasureIndex: 1,
        endMeasureIndex: 2,
      },
    });

    expect(fullRender.measureLayouts).toHaveLength(4);
    expect(fullRender.noteBounds.length).toBeGreaterThanOrEqual(10);
    expect(fullRender.noteBounds.every((note) => note.bounds.width > 0)).toBe(
      true
    );
    expect(fullRender.noteBounds.every((note) => note.bounds.height > 0)).toBe(
      true
    );

    expect(rangedRender.measureLayouts).toHaveLength(2);
    expect(
      rangedRender.measureLayouts.every(
        (measure) => measure.globalMeasureIndex === 1
      )
    ).toBe(true);

    const fullRangeLayouts = fullRender.measureLayouts.filter(
      (measure) => measure.globalMeasureIndex === 1
    );
    expect(rangedRender.measureLayouts).toEqual(fullRangeLayouts);

    const fullRangeNotes = fullRender.noteBounds.filter(
      (note) => note.globalMeasureIndex === 1
    );
    expect(rangedRender.noteBounds).toEqual(fullRangeNotes);
  });
});
