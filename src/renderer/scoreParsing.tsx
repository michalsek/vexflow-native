import {
  Accidental as VFAccidental,
  Articulation as VFArticulation,
  Beam,
  Dot,
  Fraction as VFFraction,
  GhostNote,
  ModifierPosition,
  Parenthesis,
  StaveNote,
  Stem,
  Tuplet,
  Voice as VFVoice,
} from 'vexflow';
import type { StemmableNote } from 'vexflow';

import type {
  Articulation,
  Clef,
  KeySignature,
  DurationValue,
  Meter,
  NoteAttachment,
  Notehead,
  Pitch,
  Score,
  Staff,
  StaffGroup,
  StemDirection,
  Tempo,
  TupletGroup,
  Voice,
  VoiceItem,
  VoiceTimingMode,
} from '../state';

export type StaffGroupLookup = {
  groupId: string;
  staffGroup?: StaffGroup;
  staffIds: string[];
};

export interface ResolvedMeasureState {
  clef: Clef;
  meter: Meter;
  keySignature?: KeySignature;
  tempo?: Tempo;
}

export type VFVoiceNote = StemmableNote;

export interface MakeVFVoiceOptions {
  resolveClef?: (item: VoiceItem) => Clef;
  /**
   * Precomputed `score.attachments` index keyed by owner item id. Pass it when
   * calling `makeVFVoice` in a loop so the index is built once per pass;
   * omitted, the index is derived from `score.attachments` on each call.
   */
  attachmentsByOwner?: Map<string, NoteAttachment[]>;
}

/**
 * Maps library notehead names to VexFlow key glyph codes. VexFlow uppercases
 * the third `/`-separated key segment and resolves the duration-aware glyph
 * via `Tables.codeNoteHead` ('x' -> X0/X1/X2 family, etc.).
 */
export const NOTEHEAD_TO_VF_CODE: Record<Notehead, string> = {
  'x': 'x',
  'circle-x': 'cx',
  'diamond': 'h',
  'circle': 'ci',
  'square': 'sq',
  'triangle': 'tu',
  'triangle-down': 'td',
  'slash': 'sf',
};

/**
 * Maps library articulation names to VexFlow articulation codes
 * (`Tables.articulationCodes`).
 */
export const ARTICULATION_TO_VF_CODE: Record<Articulation, string> = {
  staccato: 'a.',
  staccatissimo: 'av',
  tenuto: 'a-',
  accent: 'a>',
  marcato: 'a^',
  fermata: 'a@',
};

/**
 * Maps the library stem direction to the numeric VexFlow value.
 */
export function toVFStemDirection(dir?: StemDirection): number | undefined {
  if (dir === 'up') {
    return Stem.UP;
  }

  if (dir === 'down') {
    return Stem.DOWN;
  }

  return undefined;
}

/**
 * Converts an internal pitch into the VexFlow key string format.
 */
export function pitchToVFKey(pitch: Pitch): string {
  const accidental =
    pitch.accidental === 'quarter-flat'
      ? 'db'
      : pitch.accidental === 'quarter-sharp'
      ? 'd#'
      : pitch.accidental ?? '';

  const key = `${pitch.step.toLowerCase()}${accidental}/${pitch.octave}`;

  if (pitch.notehead) {
    return `${key}/${NOTEHEAD_TO_VF_CODE[pitch.notehead]}`;
  }

  return key;
}

/**
 * Converts a duration into the VexFlow duration token, including rests.
 */
export function durationToVF(duration: DurationValue, isRest = false): string {
  const length =
    duration.length === 'long' || duration.length === 'breve'
      ? '1/2'
      : duration.length;

  // VexFlow duration tokens are `<duration><dots><type>` (e.g. 'hdr' is a
  // dotted half rest); the dot count drives the intrinsic tick math, so it
  // must be present for rests too or strict voices come up short.
  const dots = 'd'.repeat(duration.dots ?? 0);

  return `${length}${dots}${isRest ? 'r' : ''}`;
}

/**
 * Applies the requested number of augmentation dots to a note.
 */
export function applyDots(note: StaveNote, dots?: 0 | 1 | 2 | 3) {
  for (let i = 0; i < (dots ?? 0); i++) {
    Dot.buildAndAttach([note], { all: true });
  }
}

/**
 * Adds pitch accidentals to the matching keys in a VexFlow note.
 */
export function addPitchAccidentals(note: StaveNote, pitches: Pitch[]) {
  pitches.forEach((pitch, index) => {
    if (!pitch.accidental) {
      return;
    }

    const type =
      pitch.accidental === 'quarter-flat'
        ? 'db'
        : pitch.accidental === 'quarter-sharp'
        ? 'd#'
        : pitch.accidental;

    note.addModifier(new VFAccidental(type), index);
  });
}

/**
 * Wraps ghost pitches in parentheses by attaching a left and right
 * `Parenthesis` modifier at each ghost pitch's key index (mirrors
 * `Parenthesis.buildAndAttach`, but per index instead of per note).
 */
export function applyGhostParentheses(
  note: StaveNote,
  pitches: readonly Pitch[]
) {
  pitches.forEach((pitch, index) => {
    if (!pitch.ghost) {
      return;
    }

    note.addModifier(new Parenthesis(ModifierPosition.LEFT), index);
    note.addModifier(new Parenthesis(ModifierPosition.RIGHT), index);
  });
}

/**
 * Attaches articulation attachments to a note; placed above by default,
 * below when the attachment requests it.
 */
export function applyArticulations(
  note: StaveNote,
  attachments: NoteAttachment[] | undefined
) {
  if (!attachments) {
    return;
  }

  for (const attachment of attachments) {
    if (attachment.type !== 'articulation') {
      continue;
    }

    const articulation = new VFArticulation(
      ARTICULATION_TO_VF_CODE[attachment.articulation]
    );

    if (attachment.placement === 'below') {
      articulation.setPosition(ModifierPosition.BELOW);
    }

    note.addModifier(articulation, 0);
  }
}

/**
 * Indexes score-level note attachments by their owner item id.
 */
export function indexAttachmentsByOwner(
  score: Score
): Map<string, NoteAttachment[]> {
  const attachmentsByOwner = new Map<string, NoteAttachment[]>();

  for (const attachment of score.attachments ?? []) {
    const ownedAttachments = attachmentsByOwner.get(attachment.ownerId);

    if (ownedAttachments) {
      ownedAttachments.push(attachment);
    } else {
      attachmentsByOwner.set(attachment.ownerId, [attachment]);
    }
  }

  return attachmentsByOwner;
}

/**
 * Builds a VexFlow stave note from a score voice item and clef.
 */
export function voiceItemToStaveNote(
  item: VoiceItem,
  clef: Clef,
  attachments?: NoteAttachment[]
): VFVoiceNote {
  if (item.type === 'rest') {
    if (item.kind === 'hidden' || item.kind === 'spacer') {
      return new GhostNote(durationToVF(item.duration));
    }

    const note = new StaveNote({
      clef,
      keys: ['b/4'],
      duration: durationToVF(item.duration, true),
    });
    applyDots(note, item.duration.dots);
    return note;
  }

  if (item.type === 'note') {
    const note = new StaveNote({
      clef,
      keys: [pitchToVFKey(item.pitch)],
      duration: durationToVF(item.duration),
      stemDirection: toVFStemDirection(item.stemDirection),
    });
    addPitchAccidentals(note, [item.pitch]);
    applyGhostParentheses(note, [item.pitch]);
    applyArticulations(note, attachments);
    applyDots(note, item.duration.dots);
    return note;
  }

  const note = new StaveNote({
    clef,
    keys: item.pitches.map(pitchToVFKey),
    duration: durationToVF(item.duration),
    stemDirection: toVFStemDirection(item.stemDirection),
  });
  addPitchAccidentals(note, item.pitches);
  applyGhostParentheses(note, item.pitches);
  applyArticulations(note, attachments);
  applyDots(note, item.duration.dots);
  return note;
}

/**
 * Translates beam group fractions into the VexFlow representation.
 */
export function beamGroupsToVF(meter?: Meter): VFFraction[] | undefined {
  if (!meter?.beamGroups?.length) {
    return undefined;
  }

  return meter.beamGroups.map((group) => new VFFraction(group.num, group.den));
}

function hasExplicitStemDirection(item: VoiceItem): boolean {
  return (
    item.type !== 'rest' &&
    (item.stemDirection === 'up' || item.stemDirection === 'down')
  );
}

/**
 * Finds the tuplet groups that belong to a given voice.
 */
export function findTupletsForVoice(score: Score, voice: Voice): TupletGroup[] {
  return (score.tuplets ?? []).filter((tuplet) => tuplet.voiceId === voice.id);
}

/**
 * Maps the internal timing mode to the matching VexFlow voice mode.
 */
export function modeToVF(mode: VoiceTimingMode): number {
  switch (mode) {
    case 'soft':
      return VFVoice.Mode.SOFT;
    case 'free':
      return VFVoice.Mode.FULL;
    case 'strict':
    default:
      return VFVoice.Mode.STRICT;
  }
}

/**
 * Resolves each measure state by carrying forward prior staff state.
 */
export function buildResolvedMeasureStates(
  score: Score,
  staff: Staff
): ResolvedMeasureState[] {
  let previousState: ResolvedMeasureState | undefined;

  return staff.measures.map((measure) => {
    const resolvedState: ResolvedMeasureState = {
      clef: measure.state?.clef ?? previousState?.clef ?? staff.defaultClef,
      meter:
        measure.state?.meter ?? previousState?.meter ?? score.defaults.meter,
      keySignature:
        measure.state?.keySignature ??
        previousState?.keySignature ??
        score.defaults.keySignature,
      tempo:
        measure.state?.tempo ?? previousState?.tempo ?? score.defaults.tempo,
    };

    previousState = resolvedState;
    return resolvedState;
  });
}

/**
 * Builds the VexFlow voice, notes, beams, and tuplets for one score voice.
 */
export function makeVFVoice(
  score: Score,
  meter: Meter,
  clef: Clef,
  voice: Voice,
  options: MakeVFVoiceOptions = {}
): {
  vfVoice: VFVoice;
  notes: VFVoiceNote[];
  beams: Beam[];
  tuplets: Tuplet[];
} {
  const attachmentsByOwner =
    options.attachmentsByOwner ?? indexAttachmentsByOwner(score);
  const notes = voice.items.map((item) =>
    voiceItemToStaveNote(
      item,
      options.resolveClef?.(item) ?? clef,
      attachmentsByOwner.get(item.id)
    )
  );

  const noteByItemId = new Map<string, VFVoiceNote>();
  voice.items.forEach((item, index) =>
    noteByItemId.set(item.id, notes[index]!)
  );

  // Tuplets must be constructed before the notes are added to the voice:
  // `new Tuplet(...)` applies the tick multiplier to its notes, and
  // `Voice.addTickables` validates tick counts at add time (STRICT mode
  // throws 'Too many ticks.' for unscaled tuplet notes otherwise).
  const tuplets = findTupletsForVoice(score, voice)
    .map((group) => {
      const tupletNotes = group.itemIds
        .map((id) => noteByItemId.get(id))
        .filter((note): note is StaveNote => Boolean(note));

      if (tupletNotes.length < 2) {
        return null;
      }

      return new Tuplet(tupletNotes, {
        numNotes: group.ratio.num,
        notesOccupied: group.ratio.den,
        bracketed: group.bracketed,
        location:
          group.placement === 'below'
            ? Tuplet.LOCATION_BOTTOM
            : Tuplet.LOCATION_TOP,
      });
    })
    .filter((tuplet): tuplet is Tuplet => Boolean(tuplet));

  const vfVoice = new VFVoice({
    numBeats: meter.beats,
    beatValue: meter.beatUnit,
  });

  if (voice.timingMode) {
    vfVoice.setMode(modeToVF(voice.timingMode));
  }

  try {
    vfVoice.addTickables(notes);
  } catch (error) {
    throw new Error(
      `Error adding tickables to voice ${voice.id}: ${(error as Error).message}`
    );
  }

  const groups = beamGroupsToVF(meter);
  const maintainStemDirections = voice.items.some(hasExplicitStemDirection);
  const beamOptions =
    groups || maintainStemDirections
      ? {
          ...(groups ? { groups } : {}),
          ...(maintainStemDirections ? { maintainStemDirections } : {}),
        }
      : undefined;
  const beams = Beam.generateBeams(notes, beamOptions);

  return { vfVoice, notes, beams, tuplets };
}

/**
 * Resolves explicit staff groups and standalone staves into render groups.
 */
export function buildMeasurementGroups(score: Score): StaffGroupLookup[] {
  const explicitGroups = (score.staffGroups ?? []).map((group) => ({
    groupId: group.id,
    staffGroup: group,
    staffIds: [...(group.staffIds ?? [])].sort((staffIdA, staffIdB) => {
      const staffA = score.staves.find((staff) => staff.id === staffIdA);
      const staffB = score.staves.find((staff) => staff.id === staffIdB);
      return (staffA?.order ?? 0) - (staffB?.order ?? 0);
    }),
  }));

  const groupedStaffIds = new Set(
    explicitGroups.flatMap((group) => group.staffIds)
  );

  const singles = score.staves
    .filter((staff) => !groupedStaffIds.has(staff.id))
    .sort((staffA, staffB) => staffA.order - staffB.order)
    .map((staff) => ({
      groupId: `staff:${staff.id}`,
      staffIds: [staff.id],
    }));

  return [...explicitGroups, ...singles];
}

/**
 * Resolves a staff group lookup into the existing ordered score staves.
 */
export function resolveGroupStaves(
  score: Score,
  group: StaffGroupLookup
): Staff[] {
  return group.staffIds
    .map((id) => score.staves.find((staff) => staff.id === id))
    .filter((staff): staff is Staff => Boolean(staff));
}
