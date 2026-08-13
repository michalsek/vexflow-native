import { beforeAll, describe, expect, it } from '@jest/globals';
import { Formatter, Stave } from 'vexflow';

import { installVexflowReactNativeFallbacks } from '../../base/setupVexflowReactNative';
import type { Score, VoiceItem } from '../../state';
import { applyFixedNoteSpacing } from '../render';
import { makeVFVoice } from '../scoreParsing';

/* The fixed-note-spacing contract: with a spacer voice covering the lattice,
 * engraved tick positions are a pure function of TIME — swapping the real
 * voice's content (which changes its durations and thus VexFlow's
 * duration-weighted spacing) must not move any tick context. This is what
 * keeps a step editor's grid columns still while notes toggle. */

const TEST_SCORE: Score = {
  id: 'fixed-spacing-score',
  defaults: { meter: { beats: 4, beatUnit: 4 } },
  staves: [],
};

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

/** Formats real + spacer voices to a stave with fixed spacing applied and
 * returns each spacer note's absolute x, keyed by item id. */
const formatWithLattice = (realItems: VoiceItem[]): Map<string, number> => {
  const stave = new Stave(10, 40, 700);
  const real = makeVFVoice(TEST_SCORE, TEST_SCORE.defaults.meter, 'treble', {
    id: 'real',
    index: 0,
    items: realItems,
  });
  const spacerVoiceItems = spacerItems();
  const spacer = makeVFVoice(TEST_SCORE, TEST_SCORE.defaults.meter, 'treble', {
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
});
