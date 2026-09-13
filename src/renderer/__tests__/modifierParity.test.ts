import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

/* Every note modifier the parser attaches must reach the vertical-bounds
 * measurement exactly as it reaches rendering: both passes build their voices
 * through `makeVFVoice`, so the note arrays handed to `Beam.generateBeams`
 * (once per voice per pass) are compared modifier by modifier. */

// Platform 'web' routes VexflowRecordingContext to the Element text
// measurement canvas installed below (no Skia under jest).
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

jest.mock('@shopify/react-native-skia', () => ({
  FontWeight: { Normal: 'Normal', Bold: 'Bold' },
  FontSlant: { Upright: 'Upright', Italic: 'Italic', Oblique: 'Oblique' },
  FontWidth: { Normal: 'Normal' },
  Skia: { Font: jest.fn() },
}));

import { Articulation, Beam, Element, Font, Modifier, Ornament } from 'vexflow';
import type { GraceNoteGroup, Note, StaveNote } from 'vexflow';

import { __test__ as fontFallbacks } from '../../base/setupVexflowReactNative';
import VexflowRecordingContext from '../../base/VexflowRecordingContext';
import type {
  DurationValue,
  Measure,
  NoteAttachment,
  Pitch,
  Score,
  Step,
  VoiceItem,
} from '../../state';
import { ONE_LINE_STAFF_PITCH } from '../../state';
import { insets, renderOptions, spacing } from '../constants';
import { layoutScore } from '../layout';
import { measureScore } from '../measure';
import { renderScore } from '../render';
import { createContentViewport, getRenderScale } from '../scale';
import type { ScoreItemHooks, ScoreItemsLayout } from '../types';
import { fakeFontProvider, measurementCanvasStub } from './stubs';

const TEST_OPTIONS = {
  insets: { ...insets },
  spacing: { ...spacing },
  render: { ...renderOptions },
};

const q: DurationValue = { length: 'q' };

const makePitch = (step: Step, extra: Partial<Pitch> = {}): Pitch => ({
  step,
  octave: 5,
  ...extra,
});

const makeNote = (id: string, pitch: Pitch, duration = q): VoiceItem => ({
  id,
  type: 'note',
  voiceId: 'v',
  pitch,
  duration,
});

const ITEMS: VoiceItem[] = [
  makeNote('dotted', makePitch('C'), { length: '8', dots: 1 }),
  makeNote('sharp', makePitch('F', { accidental: '#' })),
  {
    id: 'chord',
    type: 'chord',
    voiceId: 'v',
    pitches: [makePitch('C'), makePitch('E', { accidental: 'b' })],
    duration: q,
  },
  makeNote('parenthesized', makePitch('D', { parenthesized: true })),
  {
    id: 'accented-chord',
    type: 'chord',
    voiceId: 'v',
    pitches: [makePitch('C'), makePitch('E')],
    duration: q,
  },
  makeNote('above', makePitch('G')),
  makeNote('below', makePitch('G')),
  makeNote('sticking', makePitch('A')),
  { id: 'rest', type: 'rest', voiceId: 'v', duration: q },
  makeNote('graced', makePitch('B')),
  { id: 'spacer', type: 'rest', voiceId: 'v', kind: 'spacer', duration: q },
  { id: 'hidden', type: 'rest', voiceId: 'v', kind: 'hidden', duration: q },
  {
    id: 'parenthesized-chord',
    type: 'chord',
    voiceId: 'v',
    pitches: [makePitch('C', { parenthesized: true }), makePitch('E')],
    duration: { length: '8' },
    stemDirection: 'up',
  },
];

const ATTACHMENTS: NoteAttachment[] = [
  {
    id: 'a1',
    ownerId: 'above',
    type: 'articulation',
    articulation: 'staccato',
  },
  {
    id: 'a2',
    ownerId: 'below',
    type: 'articulation',
    articulation: 'accent',
    placement: 'below',
  },
  {
    id: 'a2b',
    ownerId: 'accented-chord',
    type: 'articulation',
    articulation: 'accent',
    pitchIndices: [1],
  },
  { id: 'a3', ownerId: 'sticking', type: 'annotation', text: 'R' },
  { id: 'a3b', ownerId: 'sticking', type: 'lyric', text: 'la', verse: 1 },
  { id: 'a3c', ownerId: 'sticking', type: 'dynamic', dynamic: 'mf' },
  {
    id: 'a4',
    ownerId: 'rest',
    type: 'annotation',
    text: 'L',
    placement: 'above',
  },
  {
    id: 'a5',
    ownerId: 'graced',
    type: 'grace',
    slash: true,
    notes: [
      { pitch: makePitch('A'), duration: { length: '16' } },
      { pitch: makePitch('B'), duration: { length: '16' } },
    ],
  },
];

/** `extra.voices` follow the voice built from `items`. */
const measure = (
  id: string,
  items: VoiceItem[],
  extra: Partial<Measure> = {}
): Measure => ({
  id,
  number: Number(id.slice(-1)),
  ...extra,
  voices: [
    { id: 'v', index: 0, timingMode: 'soft', items },
    ...(extra.voices ?? []),
  ],
});

const SHOW_METER = { leftModifiers: { showMeter: true } };

const HOOKS: ScoreItemHooks = {
  decorateItem: (item, note) => {
    if (item.id === 'sharp') {
      note.addModifier(new Ornament('tr'));
    }

    if (item.id === 'rest') {
      note.addModifier(new Articulation('a@a'));
    }
  },
};

const TEST_SCORE: Score = {
  id: 'modifier-parity',
  defaults: { meter: { beats: 4, beatUnit: 4 } },
  attachments: ATTACHMENTS,
  staves: [
    {
      id: 'five',
      order: 0,
      defaultClef: 'treble',
      measures: [
        measure('five-m1', ITEMS),
        measure('five-m2', [makeNote('five-m2-n', makePitch('C'))], {
          ...SHOW_METER,
          voices: [
            {
              id: 'v2',
              index: 1,
              timingMode: 'soft',
              items: [
                { ...makeNote('five-m2-v2-n', makePitch('A')), voiceId: 'v2' },
              ],
            },
          ],
          directions: [
            { id: 'd1', type: 'text', text: 'Solo' },
            { id: 'd2', type: 'text', text: 'rit.', placement: 'below' },
          ],
        }),
      ],
    },
    {
      id: 'one',
      order: 1,
      defaultClef: 'percussion',
      lines: 1,
      measures: [
        measure('one-m1', [makeNote('one-m1-n', ONE_LINE_STAFF_PITCH)]),
        measure(
          'one-m2',
          [makeNote('one-m2-n', ONE_LINE_STAFF_PITCH)],
          SHOW_METER
        ),
      ],
    },
  ],
};

type ModifierSignature = [
  category: string,
  position: number,
  verticalJustification: number | undefined,
  index: number | undefined,
  text: string,
  graceKeys: string[][] | undefined
];

type NoteSignature = [
  category: string,
  stemDirection: number | undefined,
  keys: string[],
  duration: string,
  modifiers: ModifierSignature[]
];

const stemDirectionOf = (note: Note) => {
  try {
    return note.getStemDirection();
  } catch {
    return undefined;
  }
};

const signature = (note: Note): NoteSignature => [
  note.getCategory(),
  stemDirectionOf(note),
  note.getKeys(),
  note.getDuration(),
  note
    .getModifiers()
    .map(
      (modifier): ModifierSignature => [
        modifier.getCategory(),
        modifier.getPosition(),
        'verticalJustification' in modifier
          ? (modifier.verticalJustification as number)
          : undefined,
        modifier.getIndex(),
        modifier.getText(),
        'getGraceNotes' in modifier
          ? (modifier as GraceNoteGroup)
              .getGraceNotes()
              .map((grace) => grace.getKeys())
          : undefined,
      ]
    ),
];

function renderTestScore(): ScoreItemsLayout {
  const measured = measureScore(TEST_SCORE, TEST_OPTIONS);
  const scale = getRenderScale(TEST_OPTIONS);
  const viewport = createContentViewport(
    { x: 0, y: 0, width: 800, height: 600 },
    scale
  );
  const layoutPlan = layoutScore(
    TEST_SCORE,
    measured,
    TEST_OPTIONS,
    'documentEven',
    viewport
  );

  return renderScore(
    new VexflowRecordingContext(fakeFontProvider as never, 'Bravura'),
    TEST_SCORE,
    layoutPlan,
    TEST_OPTIONS
  );
}

beforeAll(() => {
  // Dot/Parenthesis.setNote parse the note font through Font.fromCSSString,
  // which needs a DOM; the 'web' Platform mock above skips the RN fallback.
  Font.fromCSSString =
    fontFallbacks.parseCssFontShorthand as typeof Font.fromCSSString;
  Element.setTextMeasurementCanvas(measurementCanvasStub);
});

afterAll(() => {
  Font.fromCSSString = fontFallbacks.originalFromCSSString;
});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('measurement and rendering voice parity', () => {
  it('hands every modifier to measurement exactly as to rendering', () => {
    const spy = jest.spyOn(Beam, 'generateBeams');
    const signaturesOf = () =>
      spy.mock.calls.map(([notes]) => notes.map(signature));

    const measured = measureScore(TEST_SCORE, TEST_OPTIONS, HOOKS);
    const measuredSignatures = signaturesOf();

    const categories = measuredSignatures.flatMap((notes) =>
      notes.flatMap(([, , , , modifiers]) =>
        modifiers.map(([category]) => category)
      )
    );

    expect([...new Set(categories)].sort()).toEqual([
      'Accidental',
      'Annotation',
      'Articulation',
      'Dot',
      'GraceNoteGroup',
      'Ornament',
      'Parenthesis',
    ]);
    spy.mockClear();

    const scale = getRenderScale(TEST_OPTIONS);
    const viewport = createContentViewport(
      { x: 0, y: 0, width: 800, height: 600 },
      scale
    );
    const layoutPlan = layoutScore(
      TEST_SCORE,
      measured,
      TEST_OPTIONS,
      'documentEven',
      viewport
    );

    renderScore(
      new VexflowRecordingContext(fakeFontProvider as never, 'Bravura'),
      TEST_SCORE,
      layoutPlan,
      TEST_OPTIONS,
      HOOKS
    );

    expect(signaturesOf()).toEqual(measuredSignatures);
  });
});

describe('items layout modifier extents', () => {
  let layout: ScoreItemsLayout;
  let parenthesizedChord: StaveNote;

  beforeAll(() => {
    const spy = jest.spyOn(Beam, 'generateBeams');

    layout = renderTestScore();
    parenthesizedChord = spy.mock.calls
      .flatMap(([notes]) => notes)
      .filter(
        (note) =>
          note.getCategory() === 'StaveNote' &&
          note.getKeys().join() === 'c/5,e/5' &&
          note.getDuration() === '8'
      )
      .at(-1) as StaveNote;
    spy.mockRestore();
  });

  it('boxes grace notes left of the head and annotations below the stave, omitting bare notes', () => {
    const graced = layout.items.graced!;
    const sticking = layout.items.sticking!;
    const { staveLineBottomY } = layout.measures[0]!;

    expect(graced.modifierBounds!.right).toBeLessThanOrEqual(
      graced.headCenterX
    );
    expect(graced.modifierBounds!.left).toBeLessThan(
      graced.modifierBounds!.right
    );
    expect(sticking.modifierBounds!.bottom).toBeGreaterThan(staveLineBottomY);
    expect(layout.items['one-m1-n']).not.toHaveProperty('modifierBounds');
  });

  it('anchors a lower-pitch parenthesis right of the flag of a stem-up chord', () => {
    const { RIGHT } = Modifier.Position;
    const flagWidth =
      parenthesizedChord.getModifierStartXY(RIGHT, 1).x -
      parenthesizedChord.getModifierStartXY(RIGHT, 0).x;

    expect(flagWidth).toBeGreaterThan(0);
    expect(
      layout.items['parenthesized-chord']!.modifierBounds!.right
    ).toBeGreaterThanOrEqual(parenthesizedChord.getNoteHeadEndX() + flagWidth);
  });
});
