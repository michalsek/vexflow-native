import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Articulation as VFArticulation, Element, Stave } from 'vexflow';

import type {
  Measure,
  Meter,
  NoteAttachment,
  Score,
  Step,
  VoiceItem,
} from '../../state';
import { insets, renderOptions, spacing } from '../constants';
import { measureScore } from '../measure';
import type { ScoreOptions } from '../types';

const TEST_OPTIONS: ScoreOptions = {
  insets: { ...insets },
  spacing: { ...spacing },
  render: { ...renderOptions },
};

const COMPOUND_METER: Meter = {
  beats: 6,
  beatUnit: 8,
  beamGroups: [
    { num: 3, den: 8 },
    { num: 3, den: 8 },
  ],
};

function makeEighthNotes(voiceId: string, octave: number): VoiceItem[] {
  const steps: Step[] = ['C', 'D', 'E', 'F', 'G', 'A'];

  return steps.map((step, index) => ({
    id: `${voiceId}-n${index + 1}`,
    type: 'note',
    voiceId,
    pitch: {
      step,
      octave,
    },
    duration: {
      length: '8',
    },
  }));
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('measureScore', () => {
  it('carries meter state forward between measures in grouped staves', () => {
    const score: Score = {
      id: 'carry-forward-meter',
      defaults: {
        meter: {
          beats: 4,
          beatUnit: 4,
        },
      },
      staffGroups: [
        {
          id: 'piano',
          role: 'grandStaff',
          staffIds: ['top', 'bottom'],
        },
      ],
      staves: [
        {
          id: 'top',
          order: 0,
          defaultClef: 'treble',
          measures: [
            {
              id: 'top-m1',
              number: 1,
              state: { meter: COMPOUND_METER },
              voices: [
                {
                  id: 'top-m1-v1',
                  index: 0,
                  items: makeEighthNotes('top-m1-v1', 5),
                },
              ],
            },
            {
              id: 'top-m2',
              number: 2,
              voices: [
                {
                  id: 'top-m2-v1',
                  index: 0,
                  items: makeEighthNotes('top-m2-v1', 5),
                },
              ],
            },
          ],
        },
        {
          id: 'bottom',
          order: 1,
          defaultClef: 'bass',
          measures: [
            {
              id: 'bottom-m1',
              number: 1,
              state: { meter: COMPOUND_METER },
              voices: [
                {
                  id: 'bottom-m1-v1',
                  index: 0,
                  items: makeEighthNotes('bottom-m1-v1', 3),
                },
              ],
            },
            {
              id: 'bottom-m2',
              number: 2,
              voices: [
                {
                  id: 'bottom-m2-v1',
                  index: 0,
                  items: makeEighthNotes('bottom-m2-v1', 3),
                },
              ],
            },
          ],
        },
      ],
    };

    const measuredScore = measureScore(score, TEST_OPTIONS);

    expect(measuredScore.measures).toHaveLength(2);
    expect(measuredScore.measures[1]).toMatchObject({
      groupId: 'piano',
      measureIndex: 1,
      measureNumbers: [2, 2],
    });
  });

  it('adds the time signature to measurement staves when showMeter is set', () => {
    const addTimeSignatureSpy = jest.spyOn(Stave.prototype, 'addTimeSignature');
    const score = makeSingleStaffScore({ showMeter: true });

    const measuredScore = measureScore(score, TEST_OPTIONS);

    expect(measuredScore.measures).toHaveLength(1);
    // Once on the left-modifier width probe stave, once on the
    // vertical-bounds stave.
    expect(addTimeSignatureSpy).toHaveBeenCalledTimes(2);
    expect(addTimeSignatureSpy).toHaveBeenCalledWith('4/4');
  });

  it('keeps measurement output unchanged when showMeter is absent', () => {
    const addTimeSignatureSpy = jest.spyOn(Stave.prototype, 'addTimeSignature');

    const withoutFlag = measureScore(makeSingleStaffScore(), TEST_OPTIONS);
    const withFalseFlag = measureScore(
      makeSingleStaffScore({ showMeter: false }),
      TEST_OPTIONS
    );

    expect(addTimeSignatureSpy).not.toHaveBeenCalled();
    expect(withFalseFlag).toEqual(withoutFlag);
  });

  describe('intrinsic width of shown left modifiers', () => {
    /* Under jest VexFlow has no text measurement canvas and every glyph
     * measures 0, which would silently turn these tests into no-ops — install
     * a proportional stub for this block. */
    const measurementCanvasStub = {
      getContext: (type: string) =>
        type === '2d'
          ? {
              font: '',
              measureText: (text: string) => ({
                width: text.length * 8,
                actualBoundingBoxAscent: 10,
                actualBoundingBoxDescent: 2,
                actualBoundingBoxLeft: 0,
                actualBoundingBoxRight: text.length * 8,
                fontBoundingBoxAscent: 10,
                fontBoundingBoxDescent: 2,
              }),
            }
          : null,
    } as unknown as HTMLCanvasElement;
    let previousCanvas: HTMLCanvasElement | undefined;

    beforeEach(() => {
      previousCanvas = Element.getTextMeasurementCanvas();
      Element.setTextMeasurementCanvas(measurementCanvasStub);
    });

    afterEach(() => {
      Element.setTextMeasurementCanvas(
        previousCanvas as unknown as HTMLCanvasElement
      );
    });

    it('reserves room for the time signature in an empty non-first measure', () => {
      const withMeter = measureScore(
        makeTwoMeasureScore({ showMeter: true }),
        TEST_OPTIONS
      );
      const withoutMeter = measureScore(makeTwoMeasureScore(), TEST_OPTIONS);

      // Reference width of a 4/4 signature: the note-start delta it causes on
      // a real VexFlow stave.
      const bareStave = new Stave(0, 0, 500);
      const signatureStave = new Stave(0, 0, 500);
      signatureStave.addTimeSignature('4/4');
      const timeSignatureWidth =
        signatureStave.getNoteStartX() - bareStave.getNoteStartX();

      expect(timeSignatureWidth).toBeGreaterThan(0);
      // Empty measure without modifiers keeps its pre-change width of 0.
      expect(withoutMeter.measures[1]!.intrinsicNoteWidth).toBe(0);
      // With showMeter the measure must at least fit the signature block.
      expect(withMeter.measures[1]!.intrinsicNoteWidth).toBeGreaterThanOrEqual(
        timeSignatureWidth
      );
    });

    describe('articulation vertical extents', () => {
      /* VexFlow positions an articulation only inside `draw()`, so accents
       * used to add zero measured height — the blind spot this block guards. */

      it('measures taller bounds when a note carries an accent above', () => {
        const withAccent = measureScore(
          makeStemsUpScore(accentAttachments()),
          TEST_OPTIONS
        );
        const withoutAccent = measureScore(makeStemsUpScore(), TEST_OPTIONS);

        const accentBounds = withAccent.measures[0]!.staffBounds[0]!;
        const plainBounds = withoutAccent.measures[0]!.staffBounds[0]!;

        // Accents sit above the stem tip of stems-up notes: the top bound
        // must move up (smaller y), and the bottom bound must not shrink.
        expect(accentBounds.top).toBeLessThan(plainBounds.top);
        expect(accentBounds.bottom).toBeGreaterThanOrEqual(plainBounds.bottom);
      });

      it('grows the bottom bound for placement below', () => {
        // Octave 4 noteheads reach the bottom staff area, so a below-placed
        // accent must extend past the stave's bottom line.
        const withBelow = measureScore(
          makeStemsUpScore(accentAttachments('below'), 4),
          TEST_OPTIONS
        );
        const withoutAccent = measureScore(
          makeStemsUpScore(undefined, 4),
          TEST_OPTIONS
        );

        const belowBounds = withBelow.measures[0]!.staffBounds[0]!;
        const plainBounds = withoutAccent.measures[0]!.staffBounds[0]!;

        expect(belowBounds.bottom).toBeGreaterThan(plainBounds.bottom);
      });

      it('keeps no-articulation measurement untouched by the articulation pass', () => {
        const drawSpy = jest.spyOn(VFArticulation.prototype, 'draw');

        const withoutAttachments = measureScore(
          makeStemsUpScore(),
          TEST_OPTIONS
        );
        const withEmptyAttachments = measureScore(
          { ...makeStemsUpScore(), attachments: [] },
          TEST_OPTIONS
        );

        // No articulation is placed, so output is identical with or without
        // the empty attachments array.
        expect(drawSpy).not.toHaveBeenCalled();
        expect(withEmptyAttachments).toEqual(withoutAttachments);
      });

      it('places the measured accent box fully above the stems-up note box', () => {
        // Canary: if a VexFlow upgrade breaks measurement-time placement,
        // the accent extent collapses back into the note bounds and this
        // delta disappears.
        const withAccent = measureScore(
          makeStemsUpScore(accentAttachments()),
          TEST_OPTIONS
        );
        const withoutAccent = measureScore(makeStemsUpScore(), TEST_OPTIONS);

        const topDelta =
          withoutAccent.measures[0]!.staffBounds[0]!.top -
          withAccent.measures[0]!.staffBounds[0]!.top;

        // The accent glyph (stub canvas: ascent 10 + descent 2 = 12) must
        // contribute at least one glyph height of extra headroom.
        expect(topDelta).toBeGreaterThanOrEqual(12);
      });
    });

    describe('grace note extents', () => {
      it('widens the intrinsic width by the grace group on the left', () => {
        const withGrace = measureScore(
          makeStemsUpScore(graceAttachments()),
          TEST_OPTIONS
        );
        const withoutGrace = measureScore(makeStemsUpScore(), TEST_OPTIONS);

        expect(withGrace.measures[0]!.intrinsicNoteWidth).toBeGreaterThan(
          withoutGrace.measures[0]!.intrinsicNoteWidth
        );
      });

      it('grows the top bound for grace notes above a low owner', () => {
        // Octave 4 owners with stems up stay inside the staff; octave 6
        // grace notes with their own up stems must push the top bound up.
        const withGrace = measureScore(
          makeStemsUpScore(graceAttachments(6), 4),
          TEST_OPTIONS
        );
        const withoutGrace = measureScore(
          makeStemsUpScore(undefined, 4),
          TEST_OPTIONS
        );

        const graceBounds = withGrace.measures[0]!.staffBounds[0]!;
        const plainBounds = withoutGrace.measures[0]!.staffBounds[0]!;

        expect(graceBounds.top).toBeLessThan(plainBounds.top);
        expect(graceBounds.bottom).toBeGreaterThanOrEqual(plainBounds.bottom);
      });
    });

    it('adds the modifier block on top of the note width', () => {
      const withMeter = measureScore(
        makeSingleStaffScore({ showMeter: true }),
        TEST_OPTIONS
      );
      const withoutMeter = measureScore(makeSingleStaffScore(), TEST_OPTIONS);

      // Same voices, same clef (measure 0 always shows one) — the showMeter
      // variant must be wider by a positive signature width.
      expect(withMeter.measures[0]!.intrinsicNoteWidth).toBeGreaterThan(
        withoutMeter.measures[0]!.intrinsicNoteWidth
      );
    });
  });
});

/** Two measures on one staff; the second is empty and optionally shows the
 * meter, so its intrinsic width isolates the time-signature term. */
function makeTwoMeasureScore(
  secondMeasureLeftModifiers?: Measure['leftModifiers']
): Score {
  const base = makeSingleStaffScore();
  const staff = base.staves[0]!;

  return {
    ...base,
    id: 'two-measure-meter',
    staves: [
      {
        ...staff,
        measures: [
          staff.measures[0]!,
          {
            id: 'solo-m2',
            number: 2,
            ...(secondMeasureLeftModifiers
              ? { leftModifiers: secondMeasureLeftModifiers }
              : {}),
            voices: [],
          },
        ],
      },
    ],
  };
}

/** Accent attachments for every note of `makeStemsUpScore`'s single voice. */
function accentAttachments(placement?: 'above' | 'below'): NoteAttachment[] {
  return [1, 2, 3, 4].map((index) => ({
    id: `accent-${index}`,
    ownerId: `stems-up-m1-v1-n${index}`,
    type: 'articulation' as const,
    articulation: 'accent' as const,
    ...(placement ? { placement } : {}),
  }));
}

/** A two-note slashed grace group on every note of `makeStemsUpScore`'s
 * single voice, pitched at `octave`. */
function graceAttachments(octave: number = 5): NoteAttachment[] {
  return [1, 2, 3, 4].map((index) => ({
    id: `grace-${index}`,
    ownerId: `stems-up-m1-v1-n${index}`,
    type: 'grace' as const,
    slash: true,
    notes: [
      {
        pitch: { step: 'C' as Step, octave },
        duration: { length: '16' as const },
      },
      {
        pitch: { step: 'D' as Step, octave },
        duration: { length: '16' as const },
      },
    ],
  }));
}

/** One measure of four stems-up quarter notes, pitched low enough that a
 * below-placed articulation must extend past the stave's bottom line. */
function makeStemsUpScore(
  attachments?: NoteAttachment[],
  octave: number = 5
): Score {
  return {
    id: 'stems-up-articulations',
    defaults: {
      meter: {
        beats: 4,
        beatUnit: 4,
      },
    },
    ...(attachments ? { attachments } : {}),
    staves: [
      {
        id: 'stems-up',
        order: 0,
        defaultClef: 'treble',
        measures: [
          {
            id: 'stems-up-m1',
            number: 1,
            voices: [
              {
                id: 'stems-up-m1-v1',
                index: 0,
                items: ['C', 'D', 'E', 'F'].map((step, index) => ({
                  id: `stems-up-m1-v1-n${index + 1}`,
                  type: 'note' as const,
                  voiceId: 'stems-up-m1-v1',
                  pitch: { step: step as Step, octave },
                  stemDirection: 'up' as const,
                  duration: { length: 'q' as const },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeSingleStaffScore(leftModifiers?: Measure['leftModifiers']): Score {
  return {
    id: 'single-staff-meter',
    defaults: {
      meter: {
        beats: 4,
        beatUnit: 4,
      },
    },
    staves: [
      {
        id: 'solo',
        order: 0,
        defaultClef: 'treble',
        measures: [
          {
            id: 'solo-m1',
            number: 1,
            ...(leftModifiers ? { leftModifiers } : {}),
            voices: [
              {
                id: 'solo-m1-v1',
                index: 0,
                items: ['C', 'D', 'E', 'F'].map((step, index) => ({
                  id: `solo-m1-v1-n${index + 1}`,
                  type: 'note' as const,
                  voiceId: 'solo-m1-v1',
                  pitch: { step: step as Step, octave: 4 },
                  duration: { length: 'q' as const },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}
