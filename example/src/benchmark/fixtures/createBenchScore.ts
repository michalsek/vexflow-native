import type {
  Dynamic,
  Measure,
  NoteAttachment,
  NoteLength,
  Pitch,
  Score,
  Slur,
  Staff,
  Step,
  TupletGroup,
  VoiceItem,
} from 'vexflow-native/state';

const PARTS = ['melody', 'snare'] as const;

/**
 * Space-separated notes: `[t]<length>[.]<flags>[:<sticking>]`, `t` = 3:2
 * triplet member; flags `>` accent, `(` ghost, `f` flam, `d` drag, `r` rest.
 */
const SNARE_CELLS = [
  '16:R 16:L 16:R 16:L',
  '16>:R 16:L 16:R 16:R',
  '16:R 16:R 16:L 16:L',
  '8f 8',
  '8d 8',
  't8> t8( t8',
  'q>',
  'qr',
];
const MELODY_CELLS = ['q', '8 8', '8. 16', 'h', 'qr', 't8 t8 t8'];
const TOKEN = /^(t?)(h|q|8|16)(\.?)([>(fdr]*)(?::(\w))?$/;
const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
/** Diatonic indices counted from C0: G3..E5. */
const MELODY_LOW = 3 * 7 + 4;
const MELODY_HIGH = 5 * 7 + 2;
const DYNAMICS: Dynamic[] = ['p', 'mp', 'mf', 'f', 'ff', 'sfz'];
const SYLLABLES = ['la', 'da', 'ri', 'mo', 'ne', 'ta', 'su', 'vo'];

/* eslint-disable no-bitwise */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

type Build = {
  rng: () => number;
  melodyIndex: number;
  attachments: NoteAttachment[];
  tuplets: TupletGroup[];
  slurs: Slur[];
};

const pick = <T>(rng: () => number, values: readonly T[]): T =>
  values[Math.floor(rng() * values.length)]!;

function nextMelodyPitch(b: Build): Pitch {
  const step = Math.floor(b.rng() * 5) - 2;
  b.melodyIndex = Math.min(
    MELODY_HIGH,
    Math.max(MELODY_LOW, b.melodyIndex + step)
  );
  const pitch: Pitch = {
    step: STEPS[b.melodyIndex % 7]!,
    octave: Math.floor(b.melodyIndex / 7),
  };

  if (b.rng() < 0.15) {
    pitch.accidental = b.rng() < 0.5 ? '#' : 'b';
  }

  return pitch;
}

/** Appends one cell to `items`; returns the ids of its notes (not rests). */
function addCell(
  b: Build,
  measureId: string,
  items: VoiceItem[],
  cell: string,
  pitchOf: () => Pitch
): string[] {
  const voiceId = `${measureId}-v1`;
  const noteIds: string[] = [];
  const triplet: string[] = [];

  for (const token of cell.split(' ')) {
    const [, tuplet, length, dot, flags = '', sticking] = TOKEN.exec(token)!;
    const id = `${measureId}-i${items.length + 1}`;
    const duration = {
      length: length as NoteLength,
      ...(dot ? { dots: 1 as const } : {}),
    };
    const attach = (kind: string, value: object) =>
      b.attachments.push({
        id: `${id}-${kind}`,
        ownerId: id,
        ...value,
      } as NoteAttachment);

    if (flags.includes('r')) {
      items.push({ id, type: 'rest', duration, voiceId });
      continue;
    }

    const pitch = pitchOf();
    items.push({
      id,
      type: 'note',
      duration,
      voiceId,
      stemDirection: 'up',
      pitch: flags.includes('(') ? { ...pitch, parenthesized: true } : pitch,
    });
    noteIds.push(id);

    if (tuplet) {
      triplet.push(id);
    }
    if (flags.includes('>')) {
      attach('accent', { type: 'articulation', articulation: 'accent' });
    }
    if (sticking) {
      attach('sticking', {
        type: 'annotation',
        text: sticking,
        placement: 'below',
      });
    }
    if (flags.includes('f')) {
      attach('grace', {
        type: 'grace',
        slash: true,
        notes: [{ pitch, duration: { length: '8' } }],
      });
    }
    if (flags.includes('d')) {
      const grace = { pitch, duration: { length: '16' } };
      attach('grace', { type: 'grace', notes: [grace, grace] });
    }
  }

  if (triplet.length > 0) {
    b.tuplets.push({
      id: `${triplet[0]}-tuplet`,
      voiceId,
      itemIds: triplet,
      ratio: { num: 3, den: 2 },
      bracketed: true,
    });
  }

  return noteIds;
}

function addMelodyMeasure(
  b: Build,
  measureId: string,
  items: VoiceItem[],
  n: number
) {
  const phrase = Math.floor((n - 1) / 4);
  const phraseStart = (n - 1) % 4 === 0;
  const noteIds: string[] = [];

  for (let beats = 0; beats < 4; ) {
    const cell =
      phraseStart && beats === 0
        ? '8 8'
        : pick(
            b.rng,
            MELODY_CELLS.filter((c) => c !== 'h' || beats <= 2)
          );
    noteIds.push(
      ...addCell(b, measureId, items, cell, () => nextMelodyPitch(b))
    );
    beats += cell === 'h' ? 2 : 1;
  }

  noteIds.forEach((ownerId, index) => {
    const lyric = (verse: number) =>
      b.attachments.push({
        id: `${ownerId}-lyric${verse}`,
        ownerId,
        type: 'lyric',
        text: SYLLABLES[(index + 3 * (verse - 1)) % SYLLABLES.length]!,
        verse,
      });

    lyric(1);
    if (phrase % 2 === 1) {
      lyric(2);
    }
  });

  if (phraseStart) {
    const [from, to] = noteIds as [string, string];
    b.attachments.push({
      id: `${from}-dynamic`,
      ownerId: from,
      type: 'dynamic',
      dynamic: DYNAMICS[phrase % DYNAMICS.length]!,
    });
    b.slurs.push({ id: `${from}-slur`, fromNoteId: from, toNoteId: to });
  }
}

/** Deterministic 4/4 study of a melody over a snare staff; item ids are
 * `${part}-m${n}-i${k}`. */
export function createBenchScore({
  id,
  measures,
}: {
  id: string;
  measures: number;
}): Score {
  const b: Build = {
    rng: mulberry32(0x5eed),
    melodyIndex: 4 * 7 + 4,
    attachments: [],
    tuplets: [],
    slurs: [],
  };
  const staves: Staff[] = PARTS.map((part, order) => ({
    id: part,
    order,
    defaultClef: part === 'melody' ? 'treble' : 'percussion',
    measures: [],
  }));

  for (let n = 1; n <= measures; n += 1) {
    staves.forEach((staff, staffIndex) => {
      const measureId = `${staff.id}-m${n}`;
      const items: VoiceItem[] = [];

      if (staff.id === 'melody') {
        addMelodyMeasure(b, measureId, items, n);
      } else {
        for (let beat = 0; beat < 4; beat += 1) {
          addCell(b, measureId, items, pick(b.rng, SNARE_CELLS), () => ({
            step: 'C',
            octave: 5,
          }));
        }
      }

      const measure: Measure = {
        id: measureId,
        number: n,
        voices: [{ id: `${measureId}-v1`, index: 0, items }],
      };

      if (n === 1) {
        measure.leftModifiers = { showMeter: true };
        measure.state = staffIndex === 0 ? { tempo: { bpm: 96 } } : undefined;
      }
      if (staffIndex === 0 && (n - 1) % 8 === 0) {
        measure.directions = [
          {
            id: `${measureId}-text`,
            type: 'text',
            text: (n - 1) % 16 ? 'B' : 'A',
          },
        ];
      }

      staff.measures.push(measure);
    });
  }

  return {
    id,
    metadata: { title: 'Benchmark Study', composer: 'vexflow-native bench' },
    defaults: {
      meter: { beats: 4, beatUnit: 4 },
      keySignature: { tonic: 'C' },
    },
    staves,
    staffGroups: [
      {
        id: `${id}-section`,
        role: 'section',
        symbol: 'bracket',
        staffIds: [...PARTS],
      },
    ],
    attachments: b.attachments,
    tuplets: b.tuplets,
    slurs: b.slurs,
  };
}
