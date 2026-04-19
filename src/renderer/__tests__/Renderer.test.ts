import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  Beam,
  Formatter,
  Stave,
  StaveConnector,
  StaveNote,
  Tuplet,
} from 'vexflow';

jest.mock('@shopify/react-native-skia', () => {
  const createMockFont = (size = 12) => ({
    getGlyphIDs: (text: string) =>
      Array.from(text).map((_, index) => index + 1),
    getGlyphWidths: (glyphs: number[]) => glyphs.map(() => size * 0.6),
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
    setStrokeWidth: jest.fn(),
    setStyle: jest.fn(),
  });

  const createPath = () => ({
    addArc: jest.fn(),
    addRect: jest.fn(),
    close: jest.fn(),
    cubicTo: jest.fn(),
    lineTo: jest.fn(),
    moveTo: jest.fn(),
    quadTo: jest.fn(),
  });

  const createPathBuilder = () => ({
    addArc: jest.fn(),
    addRect: jest.fn(),
    build: jest.fn(() => createPath()),
    close: jest.fn(),
    cubicTo: jest.fn(),
    lineTo: jest.fn(),
    moveTo: jest.fn(),
    quadTo: jest.fn(),
  });

  return {
    BlendMode: { Clear: 'clear' },
    FontSlant: {
      Upright: 'upright',
      Italic: 'italic',
      Oblique: 'oblique',
    },
    FontWeight: {
      Normal: 'normal',
      Bold: 'bold',
      Thin: 'thin',
      ExtraLight: 'extra-light',
      Light: 'light',
      Medium: 'medium',
      SemiBold: 'semi-bold',
      ExtraBold: 'extra-bold',
      Black: 'black',
    },
    FontWidth: {
      Normal: 'normal',
    },
    PaintStyle: { Fill: 'fill', Stroke: 'stroke' },
    Skia: {
      Color: (color: string) => color,
      Font: jest.fn((_typeface: unknown, size: number) => createMockFont(size)),
      Paint: jest.fn(() => createPaint()),
      PathBuilder: {
        Make: jest.fn(() => createPathBuilder()),
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
  };
});

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (value: Record<string, unknown>) => value.ios ?? value.default,
  },
}));

import SkiaVexflowContext from '../../base/SkiaVexflowContext';
import type { Score } from '../../state';
import { insets, renderOptions, spacing } from '../constants';
import Renderer from '../Renderer';
import RestRenderer from '../renderers/RestRenderer';
import VoiceRenderer from '../renderers/VoiceRenderer';
import type { RendererType, ScoreOptions } from '../types';

const VIEWPORT = {
  width: 360,
  height: 320,
};

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

function createFontProvider() {
  return {
    countFamilies: () => 1,
    getFamilyName: () => 'MockFamily',
    matchFamilyStyle: () => ({ family: 'MockFamily' }),
  };
}

function createOptions(): ScoreOptions {
  return {
    insets: { ...insets },
    spacing: { ...spacing },
    render: { ...renderOptions },
  };
}

function createRenderer(score: Score, type: RendererType = 'infiniteScore') {
  const context = new SkiaVexflowContext(
    createCanvas() as never,
    createFontProvider() as never,
    'MockFamily'
  );

  return new Renderer(context, VIEWPORT, createOptions(), score, type);
}

function createScore(): Score {
  return {
    id: 'score-1',
    defaultMeter: {
      beats: 4,
      beatUnit: 4,
    },
    defaultKeySignature: {
      tonic: 'G',
      mode: 'major',
    },
    tempo: {
      bpm: 120,
      beatUnit: 'q',
      text: 'Allegro',
    },
    staves: [
      {
        id: 'staff-top',
        order: 0,
        clef: 'treble',
        systemGroupId: 'piano',
        systemGroupRole: 'top',
        measures: [
          {
            id: 'measure-top-1',
            number: 1,
            voices: [
              {
                id: 'voice-top-1',
                index: 0,
                items: [
                  note('top-1-a', 'C', 4, '8'),
                  note('top-1-b', 'D', 4, '8'),
                  note('top-1-c', 'E', 4, '8'),
                  note('top-1-d', 'F', 4, '8'),
                  note('top-1-e', 'G', 4, '8'),
                  note('top-1-f', 'A', 4, '8'),
                  note('top-1-g', 'B', 4, '8'),
                  note('top-1-h', 'C', 5, '8'),
                ],
              },
            ],
          },
          {
            id: 'measure-top-2',
            number: 2,
            meter: {
              beats: 3,
              beatUnit: 4,
              beaming: [3],
            },
            directions: ['dolce'],
            voices: [
              {
                id: 'voice-top-2',
                index: 0,
                items: [
                  note('triplet-1', 'C', 5, '8', { num: 3, den: 2 }),
                  note('triplet-2', 'D', 5, '8', { num: 3, den: 2 }),
                  note('triplet-3', 'E', 5, '8', { num: 3, den: 2 }),
                  note('quarter-1', 'F', 5, 'q', undefined, 'la'),
                  note('quarter-2', 'G', 5, 'q'),
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
        systemGroupId: 'piano',
        systemGroupRole: 'bottom',
        measures: [
          {
            id: 'measure-bottom-1',
            number: 1,
            voices: [
              {
                id: 'voice-bottom-1',
                index: 0,
                items: [chord('bass-1', ['C', 'G'], 3, 'w')],
              },
            ],
          },
          {
            id: 'measure-bottom-2',
            number: 2,
            voices: [
              {
                id: 'voice-bottom-2',
                index: 0,
                items: [
                  note('bass-2-a', 'C', 3, 'q'),
                  note('bass-2-b', 'D', 3, 'q'),
                  note('bass-2-c', 'E', 3, 'q'),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function note(
  id: string,
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B',
  octave: number,
  length: 'w' | 'h' | 'q' | '8',
  tuplet?: { num: number; den: number },
  lyric?: string
) {
  return {
    id,
    type: 'note' as const,
    voiceId: `${id}-voice`,
    pitch: { step, octave },
    duration: {
      length,
      ...(tuplet ? { tuplet } : {}),
    },
    ...(lyric ? { lyric } : {}),
  };
}

function chord(
  id: string,
  steps: Array<'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'>,
  octave: number,
  length: 'w' | 'h' | 'q' | '8'
) {
  return {
    id,
    type: 'chord' as const,
    voiceId: `${id}-voice`,
    pitches: steps.map((step) => ({ step, octave })),
    duration: { length },
  };
}

function createTripletScore(): Score {
  return {
    id: 'triplet-score',
    defaultMeter: {
      beats: 3,
      beatUnit: 4,
      beaming: [3],
    },
    staves: [
      {
        id: 'triplet-staff',
        order: 0,
        clef: 'treble',
        measures: [
          {
            id: 'triplet-measure',
            number: 1,
            voices: [
              {
                id: 'triplet-voice',
                index: 0,
                items: [
                  note('triplet-a', 'C', 5, '8', { num: 3, den: 2 }),
                  note('triplet-b', 'D', 5, '8', { num: 3, den: 2 }),
                  note('triplet-c', 'E', 5, '8', { num: 3, den: 2 }),
                  note('quarter-a', 'F', 5, 'q'),
                  note('quarter-b', 'G', 5, 'q'),
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Renderer', () => {
  it('recomputes deterministic measurements, aggregates widths per global measure, and ignores rendererType', () => {
    const score = createScore();
    const infiniteRenderer = createRenderer(score, 'infiniteScore');
    const documentRenderer = createRenderer(score, 'documentEven');

    const firstPlan = infiniteRenderer.measure();
    const secondPlan = infiniteRenderer.measure();
    const documentPlan = documentRenderer.measure();

    expect(secondPlan).not.toBe(firstPlan);
    expect(secondPlan.globalMeasureWidths).toEqual(
      firstPlan.globalMeasureWidths
    );
    expect(secondPlan.contentSize).toEqual(firstPlan.contentSize);
    expect(documentPlan.globalMeasureWidths).toEqual(
      firstPlan.globalMeasureWidths
    );
    expect(documentPlan.contentSize).toEqual(firstPlan.contentSize);
    expect(firstPlan.staves.map((staff) => staff.staffId)).toEqual([
      'staff-top',
      'staff-bottom',
    ]);

    const topSecondMeasure = firstPlan.measures.find(
      (measure) =>
        measure.staffId === 'staff-top' && measure.globalMeasureIndex === 1
    );
    const topFirstMeasure = firstPlan.measures.find(
      (measure) =>
        measure.staffId === 'staff-top' && measure.globalMeasureIndex === 0
    );
    const bottomSecondMeasure = firstPlan.measures.find(
      (measure) =>
        measure.staffId === 'staff-bottom' && measure.globalMeasureIndex === 1
    );

    expect(topFirstMeasure).toBeDefined();
    expect(topSecondMeasure).toBeDefined();
    expect(bottomSecondMeasure).toBeDefined();

    expect(topSecondMeasure?.display.showTimeSignature).toBe(true);
    expect(bottomSecondMeasure?.display.showTimeSignature).toBe(true);
    expect(topSecondMeasure?.display.showDirections).toBe(true);
    expect(topFirstMeasure?.bounds.x).toBe(insets.left);
    expect(topSecondMeasure?.bounds.x).toBe(insets.left);
    expect(topFirstMeasure?.bounds.x).toBe(topSecondMeasure?.bounds.x);
    expect(topSecondMeasure?.minimumWidth).toBeGreaterThan(
      bottomSecondMeasure?.minimumWidth ?? 0
    );
    expect(topSecondMeasure?.allocatedWidth).toBe(
      bottomSecondMeasure?.allocatedWidth
    );
    expect(topSecondMeasure?.contentBounds.x).toBe(
      insets.left +
        Math.max(
          (topSecondMeasure?.modifierReservations.clef ?? 0) +
            (topSecondMeasure?.modifierReservations.keySignature ?? 0) +
            (topSecondMeasure?.modifierReservations.timeSignature ?? 0) +
            (topSecondMeasure?.modifierReservations.barlines ?? 0),
          topSecondMeasure?.modifierReservations.tempo ?? 0,
          topSecondMeasure?.modifierReservations.directions ?? 0
        ) +
        spacing.measureHorizontalPadding
    );
    expect(bottomSecondMeasure?.contentBounds.x).toBe(
      insets.left +
        Math.max(
          (bottomSecondMeasure?.modifierReservations.clef ?? 0) +
            (bottomSecondMeasure?.modifierReservations.keySignature ?? 0) +
            (bottomSecondMeasure?.modifierReservations.timeSignature ?? 0) +
            (bottomSecondMeasure?.modifierReservations.barlines ?? 0),
          bottomSecondMeasure?.modifierReservations.tempo ?? 0,
          bottomSecondMeasure?.modifierReservations.directions ?? 0
        ) +
        spacing.measureHorizontalPadding
    );
    expect(topSecondMeasure?.contentBounds.x).toBeGreaterThan(
      bottomSecondMeasure?.contentBounds.x ?? 0
    );
  });

  it('renders from recomputed measurement data and compresses triplet spacing with tick multipliers', () => {
    const renderer = createRenderer(createTripletScore());
    const measuredPlan = renderer.measure();
    const measureSpy = jest.spyOn(renderer, 'measure');

    const renderResult = renderer.render();
    const repeatedPlan = renderer.measure();
    const voice = createTripletScore().staves[0]!.measures[0]!.voices[0]!;
    const voiceRenderData = new VoiceRenderer(
      voice,
      'treble',
      {
        beats: 3,
        beatUnit: 4,
        beaming: [3],
      },
      0
    ).render();
    const formatter = new Formatter();
    const stave = new Stave(0, 0, measuredPlan.measures[0]!.allocatedWidth);

    expect(measureSpy).toHaveBeenCalledTimes(2);
    expect(repeatedPlan).not.toBe(measuredPlan);
    expect(renderResult.contentSize).toEqual(measuredPlan.contentSize);
    expect(repeatedPlan.contentSize).toEqual(measuredPlan.contentSize);
    expect(repeatedPlan.globalMeasureWidths).toEqual(
      measuredPlan.globalMeasureWidths
    );

    formatter.formatToStave([voiceRenderData.voice], stave);

    const positions = voiceRenderData.tickables
      .map((tickableEntry) => tickableEntry.tickable.getAbsoluteX())
      .sort((left, right) => left - right);

    expect(positions).toHaveLength(5);

    const firstQuarterStart = positions[3]!;
    const tripletStart = positions[0]!;
    const secondQuarterStart = positions[4]!;

    const tripletBeatSpan = firstQuarterStart - tripletStart;
    const quarterBeatSpan = secondQuarterStart - firstQuarterStart;
    const ratio = tripletBeatSpan / quarterBeatSpan;

    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.7);
  });

  it('draws beams, tuplets, and grouped staff connectors during render', () => {
    const beamSpy = jest.spyOn(Beam.prototype, 'draw');
    const tupletSpy = jest.spyOn(Tuplet.prototype, 'draw');
    const connectorSpy = jest.spyOn(StaveConnector.prototype, 'draw');
    const renderer = createRenderer(createScore());

    renderer.measure();
    renderer.render();

    expect(beamSpy).toHaveBeenCalled();
    expect(tupletSpy).toHaveBeenCalled();
    expect(connectorSpy).toHaveBeenCalled();
  });

  it('renders later measures at the same starting x until placement runs', () => {
    const renderer = createRenderer(createScore());

    const renderResult = renderer.render();
    const firstTopLayout = renderResult.measureLayouts.find(
      (layout) =>
        layout.staffId === 'staff-top' && layout.globalMeasureIndex === 0
    );
    const secondTopLayout = renderResult.measureLayouts.find(
      (layout) =>
        layout.staffId === 'staff-top' && layout.globalMeasureIndex === 1
    );

    expect(firstTopLayout).toBeDefined();
    expect(secondTopLayout).toBeDefined();
    expect(firstTopLayout?.bounds.x).toBe(insets.left);
    expect(secondTopLayout?.bounds.x).toBe(insets.left);
    expect(secondTopLayout?.bounds.x).toBe(firstTopLayout?.bounds.x);
  });

  it('styles spacer rests as invisible while keeping them renderable', () => {
    const setStyleSpy = jest.spyOn(StaveNote.prototype as never, 'setStyle');
    const renderer = new RestRenderer(
      {
        id: 'spacer-rest',
        type: 'rest',
        voiceId: 'voice-rest',
        duration: { length: 'q' },
        isSpacer: true,
      },
      'treble'
    );

    renderer.render();

    expect(setStyleSpy).toHaveBeenCalledWith({
      fillStyle: 'rgba(0,0,0,0)',
      strokeStyle: 'rgba(0,0,0,0)',
    });
  });
});
