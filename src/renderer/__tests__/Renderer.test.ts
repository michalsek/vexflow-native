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
    ClipOp: { Intersect: 'intersect' },
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
import type { MeasureLayout, RendererType, ScoreOptions } from '../types';

const VIEWPORT = {
  width: 360,
  height: 320,
};

const WRAP_VIEWPORT = {
  width: 650,
  height: 320,
};

const EVEN_WRAP_VIEWPORT = {
  width: 820,
  height: 320,
};

const FRACTIONAL_WRAP_VIEWPORT = {
  width: 821,
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

function createRenderer(
  score: Score,
  type: RendererType = 'infiniteScore',
  viewport = VIEWPORT
) {
  const context = new SkiaVexflowContext(
    createCanvas() as never,
    createFontProvider() as never,
    'MockFamily'
  );

  return new Renderer(context, viewport, createOptions(), score, type);
}

function createLaidOutPlan(renderer: Renderer) {
  return renderer.layout(renderer.measure());
}

function expectLineToBePixelAligned(
  layouts: MeasureLayout[],
  expectedLineWidth: number
) {
  const epsilon = 1e-9;

  expect(layouts.length).toBeGreaterThan(1);

  layouts.forEach((layout) => {
    expect(
      Math.abs(layout.bounds.x - Math.round(layout.bounds.x))
    ).toBeLessThan(epsilon);
    expect(
      Math.abs(layout.bounds.width - Math.round(layout.bounds.width))
    ).toBeLessThan(epsilon);
  });

  layouts.slice(1).forEach((layout, index) => {
    const previousLayout = layouts[index]!;

    expect(layout.bounds.x).toBe(
      previousLayout.bounds.x + previousLayout.bounds.width
    );
  });

  expect(
    Math.abs(
      layouts.reduce((sum, layout) => sum + layout.bounds.width, 0) -
        expectedLineWidth
    )
  ).toBeLessThan(epsilon);
}

function groupLayoutsByLine(layouts: MeasureLayout[]): MeasureLayout[][] {
  return Array.from(
    layouts.reduce<Map<number, MeasureLayout[]>>((groups, layout) => {
      const lineLayouts = groups.get(layout.bounds.y) ?? [];

      lineLayouts.push(layout);
      groups.set(layout.bounds.y, lineLayouts);
      return groups;
    }, new Map())
  )
    .sort((left, right) => left[0] - right[0])
    .map(([, lineLayouts]) =>
      [...lineLayouts].sort((left, right) => left.bounds.x - right.bounds.x)
    );
}

function intersectsRect(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
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

function createWrappingScore(): Score {
  const topMeasures = [
    {
      id: 'wrap-top-1',
      number: 1,
      voices: [
        {
          id: 'wrap-top-voice-1',
          index: 0,
          items: [
            note('wrap-top-1-a', 'C', 4, 'q'),
            note('wrap-top-1-b', 'D', 4, 'q'),
          ],
        },
      ],
    },
    {
      id: 'wrap-top-2',
      number: 2,
      directions: ['cantabile'],
      voices: [
        {
          id: 'wrap-top-voice-2',
          index: 0,
          items: [
            note('wrap-top-2-a', 'C', 5, '8'),
            note('wrap-top-2-b', 'D', 5, '8'),
            note('wrap-top-2-c', 'E', 5, '8'),
            note('wrap-top-2-d', 'F', 5, '8'),
          ],
        },
      ],
    },
    {
      id: 'wrap-top-3',
      number: 3,
      voices: [
        {
          id: 'wrap-top-voice-3',
          index: 0,
          items: [
            note('wrap-top-3-a', 'E', 4, 'q'),
            note('wrap-top-3-b', 'F', 4, 'q'),
          ],
        },
      ],
    },
    {
      id: 'wrap-top-4',
      number: 4,
      voices: [
        {
          id: 'wrap-top-voice-4',
          index: 0,
          items: [
            note('wrap-top-4-a', 'G', 4, 'q'),
            note('wrap-top-4-b', 'A', 4, 'q'),
          ],
        },
      ],
    },
    {
      id: 'wrap-top-5',
      number: 5,
      voices: [
        {
          id: 'wrap-top-voice-5',
          index: 0,
          items: [
            note('wrap-top-5-a', 'A', 4, 'q'),
            note('wrap-top-5-b', 'B', 4, 'q'),
          ],
        },
      ],
    },
  ];
  const bottomMeasures = [
    {
      id: 'wrap-bottom-1',
      number: 1,
      voices: [
        {
          id: 'wrap-bottom-voice-1',
          index: 0,
          items: [chord('wrap-bottom-1-a', ['C', 'G'], 3, 'w')],
        },
      ],
    },
    {
      id: 'wrap-bottom-2',
      number: 2,
      voices: [
        {
          id: 'wrap-bottom-voice-2',
          index: 0,
          items: [
            note('wrap-bottom-2-a', 'C', 3, 'q'),
            note('wrap-bottom-2-b', 'D', 3, 'q'),
          ],
        },
      ],
    },
    {
      id: 'wrap-bottom-3',
      number: 3,
      voices: [
        {
          id: 'wrap-bottom-voice-3',
          index: 0,
          items: [chord('wrap-bottom-3-a', ['F', 'C'], 3, 'w')],
        },
      ],
    },
    {
      id: 'wrap-bottom-4',
      number: 4,
      voices: [
        {
          id: 'wrap-bottom-voice-4',
          index: 0,
          items: [chord('wrap-bottom-4-a', ['G', 'D'], 3, 'w')],
        },
      ],
    },
    {
      id: 'wrap-bottom-5',
      number: 5,
      voices: [
        {
          id: 'wrap-bottom-voice-5',
          index: 0,
          items: [chord('wrap-bottom-5-a', ['A', 'E'], 3, 'w')],
        },
      ],
    },
  ];

  return {
    id: 'wrap-score',
    defaultMeter: {
      beats: 4,
      beatUnit: 4,
    },
    staves: [
      {
        id: 'wrap-top',
        order: 0,
        clef: 'treble',
        systemGroupId: 'wrap-group',
        systemGroupRole: 'top',
        measures: topMeasures,
      },
      {
        id: 'wrap-bottom',
        order: 1,
        clef: 'bass',
        systemGroupId: 'wrap-group',
        systemGroupRole: 'bottom',
        measures: bottomMeasures,
      },
    ],
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Renderer', () => {
  it('keeps measurement deterministic and renderer-type agnostic', () => {
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

    const renderResult = renderer.render(createLaidOutPlan(renderer));
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

    renderer.render(createLaidOutPlan(renderer));

    expect(beamSpy).toHaveBeenCalled();
    expect(tupletSpy).toHaveBeenCalled();
    expect(connectorSpy).toHaveBeenCalled();
  });

  it('lays out infinite scores horizontally during render', () => {
    const renderer = createRenderer(createScore());

    const renderResult = renderer.render(createLaidOutPlan(renderer));
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
    expect(secondTopLayout?.bounds.x).toBeGreaterThan(insets.left);
    expect(secondTopLayout?.bounds.x).toBe(
      (firstTopLayout?.bounds.x ?? 0) + (firstTopLayout?.bounds.width ?? 0)
    );
  });

  it('wraps document layout lines, stretches non-last lines, and keeps wrap display flags unchanged', () => {
    const renderer = createRenderer(
      createWrappingScore(),
      'document',
      WRAP_VIEWPORT
    );
    const measuredPlan = renderer.measure();
    const laidOutPlan = createLaidOutPlan(renderer);
    const topLayouts = renderer
      .render(laidOutPlan)
      .measureLayouts.filter((layout) => layout.staffId === 'wrap-top')
      .sort(
        (left, right) => left.globalMeasureIndex - right.globalMeasureIndex
      );
    const lineGroups = groupLayoutsByLine(topLayouts);
    const nonLastLineWidths = lineGroups
      .slice(0, -1)
      .map((layouts) =>
        layouts.reduce((sum, layout) => sum + layout.bounds.width, 0)
      );
    const lastLineWidth = lineGroups
      .at(-1)
      ?.reduce((sum, layout) => sum + layout.bounds.width, 0);
    const wrappedMeasure = laidOutPlan.measures.find(
      (measure) =>
        measure.staffId === 'wrap-top' && measure.globalMeasureIndex === 2
    );
    const measuredWrappedMeasure = measuredPlan.measures.find(
      (measure) =>
        measure.staffId === 'wrap-top' && measure.globalMeasureIndex === 2
    );

    expect(topLayouts).toHaveLength(5);
    expect(lineGroups.length).toBeGreaterThan(1);
    nonLastLineWidths.forEach((lineWidth) => {
      expect(lineWidth).toBeCloseTo(
        WRAP_VIEWPORT.width - insets.left - insets.right,
        5
      );
    });
    expect(lastLineWidth).toBeLessThan(
      WRAP_VIEWPORT.width - insets.left - insets.right
    );
    expect(wrappedMeasure?.display.showClef).toBe(false);
    expect(wrappedMeasure?.display.showKeySignature).toBe(false);
    expect(wrappedMeasure?.display.showTimeSignature).toBe(
      measuredWrappedMeasure?.display.showTimeSignature
    );
  });

  it('uses equal widths for full documentEven lines and preserves the trailing gap on the last line', () => {
    const renderer = createRenderer(
      createWrappingScore(),
      'documentEven',
      EVEN_WRAP_VIEWPORT
    );
    const topLayouts = renderer
      .render(createLaidOutPlan(renderer))
      .measureLayouts.filter((layout) => layout.staffId === 'wrap-top')
      .sort(
        (left, right) => left.globalMeasureIndex - right.globalMeasureIndex
      );
    const fullLineWidth = topLayouts
      .slice(0, 2)
      .reduce((sum, layout) => sum + layout.bounds.width, 0);
    const lastLineWidth = topLayouts
      .filter((layout) => layout.bounds.y === topLayouts[4]?.bounds.y)
      .reduce((sum, layout) => sum + layout.bounds.width, 0);

    expect(topLayouts[0]?.bounds.width).toBeCloseTo(
      topLayouts[1]?.bounds.width ?? 0,
      5
    );
    expect(topLayouts[0]?.bounds.width).toBeCloseTo(
      topLayouts[2]?.bounds.width ?? 0,
      5
    );
    expect(topLayouts[2]?.bounds.width).toBeCloseTo(
      topLayouts[3]?.bounds.width ?? 0,
      5
    );
    expect(topLayouts[3]?.bounds.width).toBeCloseTo(
      topLayouts[4]?.bounds.width ?? 0,
      5
    );
    expect(fullLineWidth).toBeCloseTo(
      EVEN_WRAP_VIEWPORT.width - insets.left - insets.right,
      5
    );
    expect(lastLineWidth).toBeLessThan(
      EVEN_WRAP_VIEWPORT.width - insets.left - insets.right
    );
  });

  it('snaps documentEven measure geometry to whole pixels on fractional viewports', () => {
    const renderer = createRenderer(
      createWrappingScore(),
      'documentEven',
      FRACTIONAL_WRAP_VIEWPORT
    );
    const topLayouts = renderer
      .render(createLaidOutPlan(renderer))
      .measureLayouts.filter((layout) => layout.staffId === 'wrap-top')
      .sort(
        (left, right) => left.globalMeasureIndex - right.globalMeasureIndex
      );
    const firstLineY = topLayouts[0]?.bounds.y;
    const firstLineLayouts = topLayouts.filter(
      (layout) => layout.bounds.y === firstLineY
    );

    expectLineToBePixelAligned(
      firstLineLayouts,
      FRACTIONAL_WRAP_VIEWPORT.width - insets.left - insets.right
    );
  });

  it('snaps stretched document measure geometry to whole pixels', () => {
    const renderer = createRenderer(
      createWrappingScore(),
      'document',
      WRAP_VIEWPORT
    );
    const topLayouts = renderer
      .render(createLaidOutPlan(renderer))
      .measureLayouts.filter((layout) => layout.staffId === 'wrap-top')
      .sort(
        (left, right) => left.globalMeasureIndex - right.globalMeasureIndex
      );
    const lineGroups = groupLayoutsByLine(topLayouts);
    const nonLastLineGroups = lineGroups.slice(0, -1);

    expect(nonLastLineGroups.length).toBeGreaterThan(0);
    nonLastLineGroups.forEach((lineLayouts) => {
      expectLineToBePixelAligned(
        lineLayouts,
        WRAP_VIEWPORT.width - insets.left - insets.right
      );
    });
  });

  it('renders only measures intersecting the visible viewport and keeps partial edge measures', () => {
    const renderer = createRenderer(createWrappingScore(), 'infiniteScore');
    const laidOutPlan = createLaidOutPlan(renderer);
    const fullRender = renderer.render(laidOutPlan);
    const topLayouts = fullRender.measureLayouts
      .filter((layout) => layout.staffId === 'wrap-top')
      .sort(
        (left, right) => left.globalMeasureIndex - right.globalMeasureIndex
      );
    const visibleViewport = {
      x: topLayouts[1]!.bounds.x + topLayouts[1]!.bounds.width - 20,
      y: 0,
      width:
        topLayouts[3]!.bounds.x +
        20 -
        (topLayouts[1]!.bounds.x + topLayouts[1]!.bounds.width - 20),
      height: laidOutPlan.contentSize.height,
    };

    const renderResult = renderer.render(laidOutPlan, { visibleViewport });
    const visibleTopIndices = renderResult.measureLayouts
      .filter((layout) => layout.staffId === 'wrap-top')
      .map((layout) => layout.globalMeasureIndex)
      .sort((left, right) => left - right);
    const visibleBottomIndices = renderResult.measureLayouts
      .filter((layout) => layout.staffId === 'wrap-bottom')
      .map((layout) => layout.globalMeasureIndex)
      .sort((left, right) => left - right);

    expect(visibleTopIndices).toEqual([1, 2, 3]);
    expect(visibleBottomIndices).toEqual([1, 2, 3]);
    expect(renderResult.noteBounds.length).toBeGreaterThan(0);
    renderResult.noteBounds.forEach((noteBound) => {
      expect(intersectsRect(noteBound.bounds, visibleViewport)).toBe(true);
    });
  });

  it('renders grouped staff connectors per wrapped visual system', () => {
    const connectorSpy = jest.spyOn(StaveConnector.prototype, 'draw');
    const renderer = createRenderer(
      createWrappingScore(),
      'documentEven',
      EVEN_WRAP_VIEWPORT
    );

    renderer.render(createLaidOutPlan(renderer));

    expect(connectorSpy).toHaveBeenCalledTimes(9);
  });

  it('excludes fully offscreen systems while preserving content size for cropped renders', () => {
    const connectorSpy = jest.spyOn(StaveConnector.prototype, 'draw');
    const renderer = createRenderer(
      createWrappingScore(),
      'documentEven',
      EVEN_WRAP_VIEWPORT
    );
    const laidOutPlan = createLaidOutPlan(renderer);
    const fullRender = renderer.render(laidOutPlan);
    const topLayouts = fullRender.measureLayouts
      .filter((layout) => layout.staffId === 'wrap-top')
      .sort(
        (left, right) => left.globalMeasureIndex - right.globalMeasureIndex
      );
    const bottomLayouts = fullRender.measureLayouts
      .filter((layout) => layout.staffId === 'wrap-bottom')
      .sort(
        (left, right) => left.globalMeasureIndex - right.globalMeasureIndex
      );
    const visibleViewport = {
      x: 0,
      y: topLayouts[2]!.bounds.y + 8,
      width: laidOutPlan.contentSize.width,
      height:
        bottomLayouts[3]!.bounds.y +
        bottomLayouts[3]!.bounds.height -
        (topLayouts[2]!.bounds.y + 16),
    };

    connectorSpy.mockClear();

    const renderResult = renderer.render(laidOutPlan, { visibleViewport });
    const visibleTopIndices = renderResult.measureLayouts
      .filter((layout) => layout.staffId === 'wrap-top')
      .map((layout) => layout.globalMeasureIndex)
      .sort((left, right) => left - right);
    const visibleBottomIndices = renderResult.measureLayouts
      .filter((layout) => layout.staffId === 'wrap-bottom')
      .map((layout) => layout.globalMeasureIndex)
      .sort((left, right) => left - right);

    expect(visibleTopIndices).toEqual([2, 3]);
    expect(visibleBottomIndices).toEqual([2, 3]);
    expect(connectorSpy).toHaveBeenCalledTimes(3);
    expect(renderResult.contentSize).toEqual(laidOutPlan.contentSize);
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
