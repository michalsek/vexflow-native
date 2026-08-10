import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import * as VexFlow from 'vexflow';
import { Beam, Formatter, ModifierPosition, StaveNote, Stem } from 'vexflow';
import type { Modifier } from 'vexflow';

// The `Glyphs` enum is exported by the vexflow runtime but is missing from
// the package's type index, so reach it through a cast.
const Glyphs = (VexFlow as unknown as { Glyphs: Record<string, string> })
  .Glyphs;

import { installVexflowReactNativeFallbacks } from '../../base/setupVexflowReactNative';
import type {
  Chord,
  Note,
  NoteAttachment,
  Rest,
  Score,
  Voice,
  VoiceItem,
} from '../../state';
import {
  durationToVF,
  indexAttachmentsByOwner,
  makeVFVoice,
  pitchToVFKey,
  voiceItemToStaveNote,
} from '../scoreParsing';

const TEST_SCORE: Score = {
  id: 'score-parsing-test',
  defaults: {
    meter: {
      beats: 4,
      beatUnit: 4,
    },
  },
  staves: [],
};

function makeEighthNotes(
  voiceId: string,
  stemDirection?: 'up' | 'down'
): VoiceItem[] {
  return ['C', 'D', 'E', 'F'].map((step, index) => ({
    id: `${voiceId}-n${index + 1}`,
    type: 'note' as const,
    voiceId,
    pitch: {
      step: step as 'C' | 'D' | 'E' | 'F',
      octave: 4,
    },
    duration: {
      length: '8',
    },
    stemDirection,
  }));
}

function makeVoice(id: string, items: VoiceItem[]): Voice {
  return {
    id,
    index: 0,
    timingMode: 'soft',
    items,
  };
}

beforeAll(() => {
  // Parenthesis.setNote parses the note font via Font.fromCSSString, which
  // requires DOM APIs outside the RN fallback installed here.
  installVexflowReactNativeFallbacks();
});

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

function getModifiersByCategory(note: StaveNote, category: string): Modifier[] {
  return note.getModifiersByType(category) as Modifier[];
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('pitchToVFKey', () => {
  it('keeps plain pitches unchanged', () => {
    expect(pitchToVFKey({ step: 'C', octave: 4 })).toBe('c/4');
    expect(pitchToVFKey({ step: 'F', octave: 3, accidental: '#' })).toBe(
      'f#/3'
    );
  });

  it('appends the notehead glyph code as the third key segment', () => {
    expect(pitchToVFKey({ step: 'G', octave: 5, notehead: 'x' })).toBe('g/5/x');
    expect(pitchToVFKey({ step: 'A', octave: 5, notehead: 'circle-x' })).toBe(
      'a/5/cx'
    );
    expect(
      pitchToVFKey({ step: 'C', octave: 5, accidental: '#', notehead: 'x' })
    ).toBe('c#/5/x');
  });
});

describe('voiceItemToStaveNote noteheads', () => {
  it('resolves the x notehead to the black x glyph for quarter notes', () => {
    const item: Note = {
      id: 'notehead-x',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'G', octave: 5, notehead: 'x' },
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;

    expect(note.getKeyProps()[0]?.code).toBe(Glyphs.noteheadXBlack);
  });

  it('resolves duration-aware glyphs for circle-x half notes', () => {
    const item: Note = {
      id: 'notehead-cx-half',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'G', octave: 5, notehead: 'circle-x' },
      duration: { length: 'h' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;

    expect(note.getKeyProps()[0]?.code).toBe(Glyphs.noteheadCircleXHalf);
  });
});

describe('voiceItemToStaveNote ghosts', () => {
  it('wraps the ghost pitch of a chord in parentheses at its key index', () => {
    const item: Chord = {
      id: 'ghost-chord',
      type: 'chord',
      voiceId: 'voice',
      pitches: [
        { step: 'G', octave: 5, notehead: 'x' },
        { step: 'C', octave: 5, ghost: true },
      ],
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;
    const parentheses = getModifiersByCategory(note, 'Parenthesis');

    expect(parentheses).toHaveLength(2);
    expect(parentheses.map((modifier) => modifier.getIndex())).toEqual([1, 1]);
    expect(
      parentheses.map((modifier) => modifier.getPosition()).sort()
    ).toEqual([ModifierPosition.LEFT, ModifierPosition.RIGHT]);
  });

  it('wraps a single ghost note in parentheses at key index 0', () => {
    const item: Note = {
      id: 'ghost-note',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5, ghost: true },
      duration: { length: '8' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;
    const parentheses = getModifiersByCategory(note, 'Parenthesis');

    expect(parentheses).toHaveLength(2);
    expect(parentheses.map((modifier) => modifier.getIndex())).toEqual([0, 0]);
  });

  it('adds no parentheses without ghost pitches', () => {
    const item: Note = {
      id: 'plain-note',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'treble') as StaveNote;

    expect(getModifiersByCategory(note, 'Parenthesis')).toHaveLength(0);
  });
});

describe('indexAttachmentsByOwner', () => {
  it('groups score attachments by their owner item id', () => {
    const attachments: NoteAttachment[] = [
      {
        id: 'att-1',
        ownerId: 'note-1',
        type: 'articulation',
        articulation: 'accent',
      },
      {
        id: 'att-2',
        ownerId: 'note-1',
        type: 'articulation',
        articulation: 'staccato',
      },
      { id: 'att-3', ownerId: 'note-2', type: 'lyric', text: 'la' },
    ];
    const score: Score = { ...TEST_SCORE, attachments };

    const attachmentsByOwner = indexAttachmentsByOwner(score);

    expect(attachmentsByOwner.get('note-1')).toEqual([
      attachments[0],
      attachments[1],
    ]);
    expect(attachmentsByOwner.get('note-2')).toEqual([attachments[2]]);
    expect(indexAttachmentsByOwner(TEST_SCORE).size).toBe(0);
  });
});

describe('articulation attachments', () => {
  function makeQuarterNotesVoice(voiceId: string): Voice {
    return makeVoice(
      voiceId,
      ['C', 'D', 'E', 'F'].map((step, index) => ({
        id: `${voiceId}-n${index + 1}`,
        type: 'note' as const,
        voiceId,
        pitch: { step: step as 'C' | 'D' | 'E' | 'F', octave: 4 },
        duration: { length: 'q' as const },
      }))
    );
  }

  it('attaches articulations from score.attachments above by default', () => {
    const voice = makeQuarterNotesVoice('voice-artic');
    const score: Score = {
      ...TEST_SCORE,
      attachments: [
        {
          id: 'artic-1',
          ownerId: 'voice-artic-n2',
          type: 'articulation',
          articulation: 'accent',
        },
      ],
    };

    const { notes } = makeVFVoice(score, score.defaults.meter, 'treble', voice);

    const target = notes[1] as StaveNote;
    const articulations = getModifiersByCategory(target, 'Articulation');
    expect(articulations).toHaveLength(1);
    expect(articulations[0]?.getPosition()).toBe(ModifierPosition.ABOVE);
    expect(
      getModifiersByCategory(notes[0] as StaveNote, 'Articulation')
    ).toHaveLength(0);
  });

  it('places articulations below when the attachment requests it', () => {
    const voice = makeQuarterNotesVoice('voice-artic-below');
    const attachmentsByOwner = new Map<string, NoteAttachment[]>([
      [
        'voice-artic-below-n3',
        [
          {
            id: 'artic-below-1',
            ownerId: 'voice-artic-below-n3',
            type: 'articulation',
            articulation: 'staccato',
            placement: 'below',
          },
        ],
      ],
    ]);

    const { notes } = makeVFVoice(
      TEST_SCORE,
      TEST_SCORE.defaults.meter,
      'treble',
      voice,
      { attachmentsByOwner }
    );

    const articulations = getModifiersByCategory(
      notes[2] as StaveNote,
      'Articulation'
    );
    expect(articulations).toHaveLength(1);
    expect(articulations[0]?.getPosition()).toBe(ModifierPosition.BELOW);
  });

  it('skips articulation attachments on rests', () => {
    const restId = 'voice-artic-rest-r1';
    const rest: Rest = {
      id: restId,
      type: 'rest',
      voiceId: 'voice-artic-rest',
      duration: { length: 'w' },
    };
    const voice = makeVoice('voice-artic-rest', [rest]);
    const score: Score = {
      ...TEST_SCORE,
      attachments: [
        {
          id: 'artic-rest-1',
          ownerId: restId,
          type: 'articulation',
          articulation: 'accent',
        },
      ],
    };

    const { notes } = makeVFVoice(score, score.defaults.meter, 'treble', voice);

    expect(
      getModifiersByCategory(notes[0] as StaveNote, 'Articulation')
    ).toHaveLength(0);
  });
});

describe('dotted durations', () => {
  // VexFlow intrinsic tick resolution: quarter note = 4096 ticks.
  const QUARTER_TICKS = 4096;

  it('encodes dots in the VexFlow duration token for notes and rests', () => {
    expect(durationToVF({ length: '8', dots: 1 })).toBe('8d');
    expect(durationToVF({ length: 'q', dots: 2 })).toBe('qdd');
    expect(durationToVF({ length: 'h', dots: 1 }, true)).toBe('hdr');
    expect(durationToVF({ length: 'q' }, true)).toBe('qr');
  });

  it('gives a dotted note its full tick value', () => {
    const item: Note = {
      id: 'dotted-note',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: '8', dots: 1 },
    };

    const note = voiceItemToStaveNote(item, 'treble');

    expect(note.getTicks().value()).toBe(QUARTER_TICKS * 0.75);
  });

  it('gives a dotted rest its full tick value', () => {
    const item: Rest = {
      id: 'dotted-rest',
      type: 'rest',
      voiceId: 'voice',
      duration: { length: 'h', dots: 1 },
    };

    const note = voiceItemToStaveNote(item, 'treble');

    expect(note.getTicks().value()).toBe(QUARTER_TICKS * 3);
  });

  it('attaches the dot glyph modifier to dotted rests', () => {
    const item: Rest = {
      id: 'dotted-rest-glyph',
      type: 'rest',
      voiceId: 'voice',
      duration: { length: 'h', dots: 1 },
    };

    const note = voiceItemToStaveNote(item, 'treble') as StaveNote;

    expect(getModifiersByCategory(note, 'Dot')).toHaveLength(1);
  });

  it('completes a strict 4/4 voice of a quarter note plus a dotted-half rest', () => {
    // Regression: adding the first note to an empty measure produces
    // [note q, rest h.] — the dotted rest must carry its dot into the
    // VexFlow tick math or the strict voice is under-full and the
    // formatter throws IncompleteVoice.
    const voiceId = 'voice-first-note';
    const items: VoiceItem[] = [
      {
        id: `${voiceId}-n1`,
        type: 'note',
        voiceId,
        pitch: { step: 'C', octave: 5 },
        duration: { length: 'q' },
      },
      {
        id: `${voiceId}-r1`,
        type: 'rest',
        voiceId,
        duration: { length: 'h', dots: 1 },
      },
    ];
    const voice: Voice = { id: voiceId, index: 0, timingMode: 'strict', items };

    const { vfVoice } = makeVFVoice(
      TEST_SCORE,
      TEST_SCORE.defaults.meter,
      'treble',
      voice
    );

    expect(vfVoice.isComplete()).toBe(true);
    expect(() =>
      new Formatter().preCalculateMinTotalWidth([vfVoice])
    ).not.toThrow();
  });

  it('completes a strict 4/4 voice mixing dotted notes and dotted rests', () => {
    const voiceId = 'voice-dotted-mix';
    const items: VoiceItem[] = [
      {
        id: `${voiceId}-n1`,
        type: 'note',
        voiceId,
        pitch: { step: 'C', octave: 5 },
        duration: { length: '8', dots: 1 },
      },
      {
        id: `${voiceId}-r1`,
        type: 'rest',
        voiceId,
        duration: { length: '16' },
      },
      {
        id: `${voiceId}-r2`,
        type: 'rest',
        voiceId,
        duration: { length: 'h', dots: 1 },
      },
    ];
    const voice: Voice = { id: voiceId, index: 0, timingMode: 'strict', items };

    const { vfVoice } = makeVFVoice(
      TEST_SCORE,
      TEST_SCORE.defaults.meter,
      'treble',
      voice
    );

    expect(vfVoice.isComplete()).toBe(true);
    expect(() =>
      new Formatter().preCalculateMinTotalWidth([vfVoice])
    ).not.toThrow();
  });
});

describe('makeVFVoice', () => {
  it('preserves explicit MusicXML stem directions during beam generation', () => {
    const voice = makeVoice(
      'voice-with-stems',
      makeEighthNotes('voice-with-stems', 'down')
    );

    const { notes } = makeVFVoice(
      TEST_SCORE,
      TEST_SCORE.defaults.meter,
      'treble',
      voice
    );

    expect(notes.map((note) => note.getStemDirection())).toEqual([
      Stem.DOWN,
      Stem.DOWN,
      Stem.DOWN,
      Stem.DOWN,
    ]);
  });

  it('builds tuplet voices without overflowing strict tick validation', () => {
    const voiceId = 'voice-with-tuplet';
    const tupletNotes: VoiceItem[] = ['C', 'D', 'E'].map((step, index) => ({
      id: `${voiceId}-t${index + 1}`,
      type: 'note' as const,
      voiceId,
      pitch: {
        step: step as 'C' | 'D' | 'E',
        octave: 4,
      },
      duration: {
        length: '8' as const,
      },
    }));
    const rests: VoiceItem[] = [1, 2, 3].map((index) => ({
      id: `${voiceId}-r${index}`,
      type: 'rest' as const,
      voiceId,
      duration: {
        length: 'q' as const,
      },
    }));
    const voice: Voice = {
      id: voiceId,
      index: 0,
      items: [...tupletNotes, ...rests],
    };
    const score: Score = {
      ...TEST_SCORE,
      tuplets: [
        {
          id: 'tuplet-1',
          voiceId,
          itemIds: tupletNotes.map((item) => item.id),
          ratio: { num: 3, den: 2 },
        },
      ],
    };

    const result = makeVFVoice(score, score.defaults.meter, 'treble', voice);

    expect(result.tuplets).toHaveLength(1);
    expect(result.vfVoice.isComplete()).toBe(true);
  });

  it('still rejects strict voices with too many ticks', () => {
    const voiceId = 'voice-overfull';
    const items: VoiceItem[] = [1, 2, 3, 4, 5].map((index) => ({
      id: `${voiceId}-n${index}`,
      type: 'note' as const,
      voiceId,
      pitch: {
        step: 'C' as const,
        octave: 4,
      },
      duration: {
        length: 'q' as const,
      },
    }));
    const voice: Voice = {
      id: voiceId,
      index: 0,
      items,
    };

    expect(() =>
      makeVFVoice(TEST_SCORE, TEST_SCORE.defaults.meter, 'treble', voice)
    ).toThrow(/Too many ticks/);
  });

  it('keeps default beam generation options for voices without explicit stems', () => {
    const generateBeamsSpy = jest.spyOn(Beam, 'generateBeams');
    const voice = makeVoice(
      'voice-without-stems',
      makeEighthNotes('voice-without-stems')
    );

    makeVFVoice(TEST_SCORE, TEST_SCORE.defaults.meter, 'treble', voice);

    expect(generateBeamsSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      undefined
    );
  });
});
