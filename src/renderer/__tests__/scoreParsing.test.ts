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
import {
  Articulation as VFArticulation,
  Beam,
  Formatter,
  Fraction as VFFraction,
  GraceNote as VFGraceNote,
  GraceNoteGroup,
  ModifierPosition,
  Stave,
  StaveNote,
  Stem,
} from 'vexflow';
import type { Modifier } from 'vexflow';

// The `Glyphs` enum is exported by the vexflow runtime but is missing from
// the package's type index, so reach it through a cast.
const Glyphs = (VexFlow as unknown as { Glyphs: Record<string, string> })
  .Glyphs;

import { installVexflowReactNativeFallbacks } from '../../base/setupVexflowReactNative';
import type {
  Chord,
  GraceNote,
  GraceNoteAttachment,
  Note,
  NoteAttachment,
  Rest,
  Score,
  Voice,
  VoiceItem,
} from '../../state';
import { resolveItemHeadCenterX } from '../render';
import {
  ARTICULATION_TO_VF_CODE,
  beamGroupsToVF,
  durationToVF,
  indexAttachmentsByOwner,
  makeVFVoice,
  noteheadWidth,
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

function makeEighthNoteRun(voiceId: string, count: number): VoiceItem[] {
  const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

  return Array.from({ length: count }, (_, index) => ({
    id: `${voiceId}-n${index + 1}`,
    type: 'note' as const,
    voiceId,
    pitch: {
      step: steps[index % steps.length] ?? 'C',
      octave: 4,
    },
    duration: {
      length: '8' as const,
    },
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

describe('voiceItemToStaveNote accents', () => {
  function getArticulations(note: StaveNote) {
    return getModifiersByCategory(note, 'Articulation') as VFArticulation[];
  }

  it('draws one accent above a single accented note', () => {
    const item: Note = {
      id: 'accent-note',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5, accent: true },
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;
    const accents = getArticulations(note);

    expect(accents).toHaveLength(1);
    expect(accents[0]?.type).toBe(ARTICULATION_TO_VF_CODE.accent);
    expect(accents[0]?.getPosition()).toBe(ModifierPosition.ABOVE);
  });

  it('draws exactly one accent for a chord with two accented pitches', () => {
    const item: Chord = {
      id: 'accent-chord',
      type: 'chord',
      voiceId: 'voice',
      pitches: [
        { step: 'G', octave: 5, notehead: 'x', accent: true },
        { step: 'C', octave: 5, accent: true },
      ],
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;
    const accents = getArticulations(note);

    expect(accents).toHaveLength(1);
    expect(accents[0]?.type).toBe(ARTICULATION_TO_VF_CODE.accent);
  });

  it('draws one accent for a chord with a single accented pitch', () => {
    const item: Chord = {
      id: 'accent-chord-partial',
      type: 'chord',
      voiceId: 'voice',
      pitches: [
        { step: 'G', octave: 5, notehead: 'x' },
        { step: 'C', octave: 5, accent: true },
        { step: 'F', octave: 4 },
      ],
      duration: { length: '8' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;

    expect(getArticulations(note)).toHaveLength(1);
  });

  it('adds no accent without accent flags', () => {
    const item: Chord = {
      id: 'plain-chord',
      type: 'chord',
      voiceId: 'voice',
      pitches: [
        { step: 'G', octave: 5, notehead: 'x' },
        { step: 'C', octave: 5, ghost: true },
      ],
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'percussion') as StaveNote;

    expect(getArticulations(note)).toHaveLength(0);
  });

  it('skips the pitch accent when the owner already has an accent attachment', () => {
    const item: Note = {
      id: 'accent-both',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5, accent: true },
      duration: { length: 'q' },
    };
    const attachments: NoteAttachment[] = [
      {
        id: 'artic-accent',
        ownerId: 'accent-both',
        type: 'articulation',
        articulation: 'accent',
        placement: 'below',
      },
    ];

    const note = voiceItemToStaveNote(
      item,
      'percussion',
      attachments
    ) as StaveNote;
    const accents = getArticulations(note);

    expect(accents).toHaveLength(1);
    expect(accents[0]?.type).toBe(ARTICULATION_TO_VF_CODE.accent);
    expect(accents[0]?.getPosition()).toBe(ModifierPosition.BELOW);
  });

  it('keeps other articulation attachments alongside the pitch accent', () => {
    const item: Note = {
      id: 'accent-staccato',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5, accent: true },
      duration: { length: 'q' },
    };
    const attachments: NoteAttachment[] = [
      {
        id: 'artic-staccato',
        ownerId: 'accent-staccato',
        type: 'articulation',
        articulation: 'staccato',
      },
    ];

    const note = voiceItemToStaveNote(
      item,
      'percussion',
      attachments
    ) as StaveNote;
    const articulations = getArticulations(note);

    expect(
      articulations.map((articulation) => articulation.type).sort()
    ).toEqual(
      [ARTICULATION_TO_VF_CODE.accent, ARTICULATION_TO_VF_CODE.staccato].sort()
    );
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

  it('renders open and stopped as the VexFlow harmonic and plus codes above', () => {
    expect(ARTICULATION_TO_VF_CODE.open).toBe('ah');
    expect(ARTICULATION_TO_VF_CODE.stopped).toBe('a+');

    const voice = makeQuarterNotesVoice('voice-artic-open');
    const score: Score = {
      ...TEST_SCORE,
      attachments: [
        {
          id: 'artic-open-1',
          ownerId: 'voice-artic-open-n1',
          type: 'articulation',
          articulation: 'open',
        },
        {
          id: 'artic-stopped-1',
          ownerId: 'voice-artic-open-n2',
          type: 'articulation',
          articulation: 'stopped',
        },
      ],
    };

    const { notes } = makeVFVoice(score, score.defaults.meter, 'treble', voice);

    for (const index of [0, 1]) {
      const articulations = getModifiersByCategory(
        notes[index] as StaveNote,
        'Articulation'
      );
      expect(articulations).toHaveLength(1);
      expect(articulations[0]?.getPosition()).toBe(ModifierPosition.ABOVE);
    }
    expect(
      getModifiersByCategory(notes[2] as StaveNote, 'Articulation')
    ).toHaveLength(0);
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

describe('grace note attachments', () => {
  function graceAttachment(
    ownerId: string,
    count: 1 | 2,
    slash = true
  ): GraceNoteAttachment {
    const notes: GraceNote[] = [
      { pitch: { step: 'C', octave: 5 }, duration: { length: '16' } },
      { pitch: { step: 'D', octave: 5 }, duration: { length: '16' } },
    ];

    return {
      id: `${ownerId}-grace`,
      ownerId,
      type: 'grace',
      slash,
      notes: notes.slice(0, count),
    };
  }

  function getGraceNoteGroups(note: StaveNote): GraceNoteGroup[] {
    return getModifiersByCategory(note, 'GraceNoteGroup') as GraceNoteGroup[];
  }

  function graceNoteInternals(graceNote: unknown) {
    return graceNote as { slash: boolean; getStemDirection: () => number };
  }

  function groupBeams(group: GraceNoteGroup): Beam[] {
    return (group as unknown as { beams: Beam[] }).beams;
  }

  it('attaches a single slashed grace note as a GraceNoteGroup on the left', () => {
    const item: Note = {
      id: 'flam-owner',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'percussion', [
      graceAttachment(item.id, 1),
    ]) as StaveNote;
    const groups = getGraceNoteGroups(note);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.getPosition()).toBe(ModifierPosition.LEFT);

    const graceNotes = groups[0]!.getGraceNotes();
    expect(graceNotes).toHaveLength(1);
    expect(graceNotes[0]).toBeInstanceOf(VFGraceNote);
    expect(graceNoteInternals(graceNotes[0]).slash).toBe(true);
    expect(graceNotes[0]?.getDuration()).toBe('16');
    expect(groupBeams(groups[0]!)).toHaveLength(0);
  });

  it('beams a two-note grace group and slashes only its first note', () => {
    const item: Note = {
      id: 'drag-owner',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: 'q' },
    };

    const slashesOf = (slash: boolean) => {
      const note = voiceItemToStaveNote(item, 'percussion', [
        graceAttachment(item.id, 2, slash),
      ]) as StaveNote;
      const groups = getGraceNoteGroups(note);

      expect(groups).toHaveLength(1);

      const graceNotes = groups[0]!.getGraceNotes();
      expect(graceNotes).toHaveLength(2);
      expect(graceNotes.map((graceNote) => graceNote.getKeys()[0])).toEqual([
        'c/5',
        'd/5',
      ]);
      expect(groupBeams(groups[0]!)).toHaveLength(1);

      return graceNotes.map((graceNote) => graceNoteInternals(graceNote).slash);
    };

    expect(slashesOf(true)).toEqual([true, false]);
    expect(slashesOf(false)).toEqual([false, false]);
  });

  it('places grace notes with the owner clef', () => {
    const item: Note = {
      id: 'bass-flam-owner',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: 'q' },
    };

    const note = voiceItemToStaveNote(item, 'bass', [
      graceAttachment(item.id, 1),
    ]) as StaveNote;
    const graceNote = getGraceNoteGroups(note)[0]!.getGraceNotes()[0]!;

    expect((graceNote as StaveNote).getKeyProps()[0]?.line).toBe(
      note.getKeyProps()[0]?.line
    );
  });

  it('attaches grace notes to chord owners', () => {
    const item: Chord = {
      id: 'flam-chord',
      type: 'chord',
      voiceId: 'voice',
      pitches: [
        { step: 'C', octave: 5 },
        { step: 'G', octave: 5, notehead: 'x' },
      ],
      duration: { length: '8' },
    };

    const note = voiceItemToStaveNote(item, 'percussion', [
      graceAttachment(item.id, 1),
    ]) as StaveNote;
    const groups = getGraceNoteGroups(note);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.getGraceNotes()).toHaveLength(1);
  });

  it('stems grace notes up unless the owner stems down', () => {
    const stemsUp: Note = {
      id: 'grace-stem-up',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: 'q' },
      stemDirection: 'up',
    };
    const stemsDown: Note = {
      ...stemsUp,
      id: 'grace-stem-down',
      stemDirection: 'down',
    };
    const autoStem: Note = {
      ...stemsUp,
      id: 'grace-stem-auto',
      stemDirection: undefined,
    };

    const stemsOf = (item: Note) =>
      getGraceNoteGroups(
        voiceItemToStaveNote(item, 'treble', [
          graceAttachment(item.id, 2),
        ]) as StaveNote
      )[0]!
        .getGraceNotes()
        .map((graceNote) => graceNoteInternals(graceNote).getStemDirection());

    expect(stemsOf(stemsUp)).toEqual([Stem.UP, Stem.UP]);
    expect(stemsOf(stemsDown)).toEqual([Stem.DOWN, Stem.DOWN]);
    expect(stemsOf(autoStem)).toEqual([Stem.UP, Stem.UP]);
  });

  it('carries grace noteheads and accidentals through pitch mapping', () => {
    const item: Note = {
      id: 'grace-notehead-owner',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: 'q' },
    };
    const attachment: GraceNoteAttachment = {
      id: 'grace-notehead',
      ownerId: item.id,
      type: 'grace',
      notes: [
        {
          pitch: { step: 'G', octave: 5, notehead: 'x', accidental: '#' },
          duration: { length: '8' },
        },
      ],
    };

    const note = voiceItemToStaveNote(item, 'percussion', [
      attachment,
    ]) as StaveNote;
    const graceNote = getGraceNoteGroups(note)[0]!.getGraceNotes()[0]!;

    expect(graceNote.getKeys()[0]).toBe('g#/5/x');
    expect((graceNote as StaveNote).getKeyProps()[0]?.code).toBe(
      Glyphs.noteheadXBlack
    );
    expect(graceNote.getModifiersByType('Accidental')).toHaveLength(1);
  });

  it('skips grace attachments on rests and empty groups', () => {
    const rest: Rest = {
      id: 'grace-rest',
      type: 'rest',
      voiceId: 'voice',
      duration: { length: 'q' },
    };
    const owner: Note = {
      id: 'grace-empty-owner',
      type: 'note',
      voiceId: 'voice',
      pitch: { step: 'C', octave: 5 },
      duration: { length: 'q' },
    };

    const restNote = voiceItemToStaveNote(rest, 'treble', [
      graceAttachment(rest.id, 1),
    ]) as StaveNote;
    const emptyOwner = voiceItemToStaveNote(owner, 'treble', [
      { ...graceAttachment(owner.id, 1), notes: [] },
    ]) as StaveNote;

    expect(getGraceNoteGroups(restNote)).toHaveLength(0);
    expect(getGraceNoteGroups(emptyOwner)).toHaveLength(0);
  });

  it('formats a voice whose notes carry grace groups', () => {
    const voiceId = 'voice-grace-format';
    const voice = makeVoice(voiceId, makeEighthNotes(voiceId));
    const score: Score = {
      ...TEST_SCORE,
      attachments: [graceAttachment(`${voiceId}-n1`, 2)],
    };

    const { vfVoice, notes } = makeVFVoice(
      score,
      score.defaults.meter,
      'treble',
      voice
    );
    const stave = new Stave(0, 0, 400);
    notes.forEach((note) => note.setStave(stave));
    const formatter = new Formatter();

    expect(() => {
      formatter.joinVoices([vfVoice]).formatToStave([vfVoice], stave);
    }).not.toThrow();
    expect(
      getGraceNoteGroups(notes[0] as StaveNote)[0]!.getWidth()
    ).toBeGreaterThan(0);
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
    // Regression: a dotted rest must carry its dot into the VexFlow tick
    // math, or the strict voice is under-full and the formatter throws.
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

  it("beams by the meter's conventional groups when it declares none", () => {
    const generateBeamsSpy = jest.spyOn(Beam, 'generateBeams');
    const voice = makeVoice(
      'voice-without-stems',
      makeEighthNotes('voice-without-stems')
    );

    makeVFVoice(TEST_SCORE, TEST_SCORE.defaults.meter, 'treble', voice);

    expect(generateBeamsSpy).toHaveBeenLastCalledWith(expect.any(Array), {
      groups: [new VFFraction(1, 4)],
    });
  });

  it('groups compound meters in dotted-quarter beams', () => {
    const voice = makeVoice(
      'voice-six-eight',
      makeEighthNoteRun('voice-six-eight', 6)
    );

    const { beams } = makeVFVoice(
      TEST_SCORE,
      { beats: 6, beatUnit: 8 },
      'treble',
      voice
    );

    expect(beams.map((beam) => beam.getNotes().length)).toEqual([3, 3]);
  });

  it("prefers the meter's explicit beam groups over the defaults", () => {
    const voice = makeVoice(
      'voice-explicit-groups',
      makeEighthNoteRun('voice-explicit-groups', 6)
    );

    const { beams } = makeVFVoice(
      TEST_SCORE,
      { beats: 6, beatUnit: 8, beamGroups: [{ num: 2, den: 8 }] },
      'treble',
      voice
    );

    expect(beams.map((beam) => beam.getNotes().length)).toEqual([2, 2, 2]);
  });

  it('returns no beam groups without a meter', () => {
    expect(beamGroupsToVF(undefined)).toBeUndefined();
  });
});

/* Pins the VexFlow 5 notehead-span getters that back headCenterX, using real
 * StaveNote/GhostNote instances. Jest has no text canvas, so glyph widths are
 * 0 and the span degenerates to a point — this suite pins the API identities
 * and the degenerate-span fallback; the span-derived center path is covered
 * by the mocked geometry in render.test.ts. */
describe('notehead span geometry (VexFlow 5, real formatting)', () => {
  const formatItems = (items: VoiceItem[]) => {
    const voice: Voice = {
      id: 'head-span-voice',
      index: 0,
      timingMode: 'strict',
      items,
    };
    const { vfVoice, notes } = makeVFVoice(
      TEST_SCORE,
      TEST_SCORE.defaults.meter,
      'treble',
      voice
    );
    const stave = new Stave(10, 40, 400);
    notes.forEach((note) => note.setStave(stave));
    new Formatter().joinVoices([vfVoice]).formatToStave([vfVoice], stave);
    return notes;
  };

  const quarterNote = (id: string): VoiceItem => ({
    id,
    type: 'note',
    voiceId: 'head-span-voice',
    pitch: { step: 'C', octave: 5 },
    duration: { length: 'q' },
  });

  it('exposes the span getters on notes AND visible rests with the documented identities', () => {
    const notes = formatItems([
      quarterNote('hs-n1'),
      {
        id: 'hs-r1',
        type: 'rest',
        voiceId: 'head-span-voice',
        duration: { length: 'q' },
      },
      quarterNote('hs-n2'),
      quarterNote('hs-n3'),
    ]);

    for (const note of notes) {
      const staveNote = note as StaveNote;
      const x = staveNote.getAbsoluteX();

      // Both getters exist on every StaveNote, rests included.
      expect(typeof staveNote.getNoteHeadBeginX).toBe('function');
      expect(typeof staveNote.getNoteHeadEndX).toBe('function');

      const begin = staveNote.getNoteHeadBeginX();
      const end = staveNote.getNoteHeadEndX();

      // The VexFlow 5 identities: begin = absoluteX + xShift,
      // end = begin + glyph width.
      expect(begin).toBe(x + staveNote.getXShift());
      expect(end).toBe(begin + staveNote.getGlyphWidth());
      expect(Number.isFinite(begin)).toBe(true);
      expect(Number.isFinite(end)).toBe(true);
    }
  });

  it('falls back to the notional notehead center when the measured span degenerates (jest has no font metrics)', () => {
    const notes = formatItems([
      quarterNote('hs-n1'),
      quarterNote('hs-n2'),
      quarterNote('hs-n3'),
      quarterNote('hs-n4'),
    ]);

    for (const note of notes) {
      const staveNote = note as StaveNote;
      const x = staveNote.getAbsoluteX();
      const width = staveNote.getWidth();

      // With glyph width 0 the span collapses onto the tick x, which the
      // resolver must treat as nonsensical.
      expect(staveNote.getNoteHeadEndX()).toBe(staveNote.getNoteHeadBeginX());
      // The fallback centers a NOTIONAL notehead at the block's left edge —
      // under jest the measured notehead width is 0, so it collapses to x.
      expect(resolveItemHeadCenterX(staveNote, x, width)).toBe(
        x + Math.min(width, noteheadWidth()) / 2
      );
    }
  });

  it('falls back to the block center for GhostNote hidden rests', () => {
    const notes = formatItems([
      quarterNote('hs-n1'),
      {
        id: 'hs-hidden',
        type: 'rest',
        kind: 'hidden',
        voiceId: 'head-span-voice',
        duration: { length: 'q' },
      },
      quarterNote('hs-n2'),
      quarterNote('hs-n3'),
    ]);
    const ghost = notes[1]!;

    // GhostNote carries no notehead-span getters.
    expect(
      (ghost as { getNoteHeadBeginX?: () => number }).getNoteHeadBeginX
    ).toBeUndefined();

    const x = ghost.getAbsoluteX();
    const width = ghost.getWidth();
    expect(resolveItemHeadCenterX(ghost, x, width)).toBe(x + width / 2);
  });
});
