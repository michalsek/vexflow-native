import { beforeAll, describe, expect, it } from '@jest/globals';
import { Formatter, GraceNoteGroup, Stave } from 'vexflow';
import type { StaveNote } from 'vexflow';

import { installVexflowReactNativeFallbacks } from '../../base/setupVexflowReactNative';
import type { GraceNoteAttachment, Score, VoiceItem } from '../../state';
import { applyFixedNoteSpacing } from '../render';
import { makeVFVoice } from '../scoreParsing';

/* The fixed-note-spacing contract: with a spacer voice covering the lattice,
 * engraved tick positions are a pure function of TIME — swapping the real
 * voice's content (which changes its durations and thus VexFlow's
 * duration-weighted spacing) must not move any tick context. This is what
 * keeps a step editor's grid columns still while notes toggle. The one input
 * besides time is what hangs LEFT of beat 1: like VexFlow's own formatter, the
 * lattice starts at the first tick's left-modifier width, so a beat-1 grace
 * group sits inside the note area instead of over the clef. */

const TEST_SCORE: Score = {
  id: 'fixed-spacing-score',
  defaults: { meter: { beats: 4, beatUnit: 4 } },
  staves: [],
};

/** Tick context x is relative to noteStartX + this padding (Note.getAbsoluteX). */
const STAVE_PADDING = Stave.defaultPadding - Stave.rightPadding;

const drag = (ownerId: string): GraceNoteAttachment => ({
  id: `${ownerId}-drag`,
  ownerId,
  type: 'grace',
  notes: [
    { pitch: { step: 'C', octave: 5 }, duration: { length: '16' } },
    { pitch: { step: 'C', octave: 5 }, duration: { length: '16' } },
  ],
});

const note = (id: string, length: '8' | '16' | 'q'): VoiceItem => ({
  id,
  type: 'note',
  pitch: { step: 'C', octave: 5 },
  duration: { length },
  voiceId: 'real',
});

const rest = (id: string, length: '8' | '16' | 'q'): VoiceItem => ({
  id,
  type: 'rest',
  duration: { length },
  voiceId: 'real',
});

/** 16 spacer sixteenths — the editor lattice at division 4. */
const spacerItems = (): VoiceItem[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `spacer:${index}`,
    type: 'rest' as const,
    kind: 'spacer' as const,
    duration: { length: '16' as const },
    voiceId: 'spacer',
  }));

/** Formats real + spacer voices to a stave with fixed spacing applied. */
const formatLattice = (realItems: VoiceItem[], score: Score = TEST_SCORE) => {
  const stave = new Stave(10, 40, 700);
  const real = makeVFVoice(score, score.defaults.meter, 'treble', {
    id: 'real',
    index: 0,
    items: realItems,
  });
  const spacerVoiceItems = spacerItems();
  const spacer = makeVFVoice(score, score.defaults.meter, 'treble', {
    id: 'spacer',
    index: 1,
    items: spacerVoiceItems,
  });
  const voices = [real.vfVoice, spacer.vfVoice];
  [...real.notes, ...spacer.notes].forEach((vfNote) => vfNote.setStave(stave));

  const formatter = new Formatter();
  formatter.joinVoices(voices);
  formatter.formatToStave(voices, stave);
  applyFixedNoteSpacing(formatter, voices, stave);

  return { stave, real, spacer, spacerVoiceItems };
};

/** Each spacer note's absolute x after `formatLattice`, keyed by item id. */
const formatWithLattice = (
  realItems: VoiceItem[],
  score: Score = TEST_SCORE
): Map<string, number> => {
  const { spacer, spacerVoiceItems } = formatLattice(realItems, score);
  const positions = new Map<string, number>();

  spacerVoiceItems.forEach((item, index) => {
    positions.set(item.id, spacer.notes[index]!.getAbsoluteX());
  });

  return positions;
};

describe('applyFixedNoteSpacing', () => {
  beforeAll(() => {
    installVexflowReactNativeFallbacks();
  });

  it('spaces the lattice uniformly in time', () => {
    const positions = [
      ...formatWithLattice([
        rest('r0', 'q'),
        rest('r1', 'q'),
        rest('r2', 'q'),
        rest('r3', 'q'),
      ]).values(),
    ];

    const steps = positions.slice(1).map((x, index) => x - positions[index]!);
    for (const step of steps) {
      expect(step).toBeCloseTo(steps[0]!, 6);
      expect(step).toBeGreaterThan(0);
    }
  });

  it('keeps every tick position identical when the real voice re-notates', () => {
    /* The regression this feature exists for: two 8ths vs 16th+16th+8th (the
     * result of toggling a note on the lattice) re-weight VexFlow's softmax
     * spacing and used to reflow the whole measure. */
    const sparse = formatWithLattice([
      note('a', '8'),
      note('b', '8'),
      rest('r1', 'q'),
      rest('r2', 'q'),
      rest('r3', 'q'),
    ]);
    const dense = formatWithLattice([
      note('a', '16'),
      note('x', '16'),
      note('b', '8'),
      rest('r1', 'q'),
      rest('r2', 'q'),
      rest('r3', 'q'),
    ]);

    for (const [id, x] of sparse) {
      expect(dense.get(id)).toBeCloseTo(x, 6);
    }
  });

  it('keeps the lattice in place when the real voice holds a tuplet', () => {
    /* A tuplet raises the formatter's tick resolution multiplier (3 for a
     * triplet) and its tick-context keys with it. Comparing those keys against
     * the voice's plain total ticks scaled every position by the multiplier
     * and the overflow clamp then crushed the last context flush against the
     * note end — a beat holding only a downbeat shrank to a sliver. */
    const plain = formatWithLattice([
      rest('r0', 'q'),
      rest('r1', 'q'),
      rest('r2', 'q'),
      rest('r3', 'q'),
    ]);
    const withTriplet = formatWithLattice(
      [
        rest('r0', 'q'),
        rest('r1', 'q'),
        note('t1', '8'),
        note('t2', '8'),
        note('t3', '8'),
        note('d', 'q'),
      ],
      {
        ...TEST_SCORE,
        tuplets: [
          {
            id: 'triplet',
            voiceId: 'real',
            itemIds: ['t1', 't2', 't3'],
            ratio: { num: 3, den: 2 },
          },
        ],
      }
    );

    for (const [id, x] of plain) {
      expect(withTriplet.get(id)).toBeCloseTo(x, 6);
    }
  });

  it('anchors the first tick at the note start when nothing hangs left of it', () => {
    const { stave, spacer } = formatLattice([
      rest('r0', 'q'),
      rest('r1', 'q'),
      rest('r2', 'q'),
      rest('r3', 'q'),
    ]);

    expect(spacer.notes[0]!.getAbsoluteX()).toBeCloseTo(
      stave.getNoteStartX() + STAVE_PADDING,
      6
    );
  });

  it('insets the lattice so a beat-1 grace group stays inside the note area', () => {
    /* GraceNoteGroup places its notes entirely LEFT of the owner's tick x
     * (the placement step draw() runs first). A lattice starting at x = 0
     * hung a beat-1 drag over the clef. */
    const { stave, real } = formatLattice(
      [note('a', 'q'), rest('r1', 'q'), rest('r2', 'q'), rest('r3', 'q')],
      { ...TEST_SCORE, attachments: [drag('a')] }
    );
    const owner = real.notes[0] as StaveNote;
    const group = owner.getModifiersByType(
      'GraceNoteGroup'
    )[0] as GraceNoteGroup;

    group.alignSubNotesWithNote(group.getGraceNotes(), owner);

    const noteAreaStartX = stave.getNoteStartX() + STAVE_PADDING;

    for (const graceNote of group.getGraceNotes()) {
      expect(graceNote.getAbsoluteX()).toBeGreaterThanOrEqual(noteAreaStartX);
    }
    expect(owner.getAbsoluteX()).toBeGreaterThan(noteAreaStartX);
  });
});
