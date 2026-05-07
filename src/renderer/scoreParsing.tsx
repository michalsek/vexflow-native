import {
  Accidental as VFAccidental,
  Beam,
  Dot,
  Fraction as VFFraction,
  GhostNote,
  StaveNote,
  Stem,
  Tuplet,
  Voice as VFVoice,
} from 'vexflow';
import type { StemmableNote } from 'vexflow';

import type {
  Clef,
  KeySignature,
  DurationValue,
  Meter,
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
}

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

  return `${pitch.step.toLowerCase()}${accidental}/${pitch.octave}`;
}

/**
 * Converts a duration into the VexFlow duration token, including rests.
 */
export function durationToVF(duration: DurationValue, isRest = false): string {
  const length =
    duration.length === 'long' || duration.length === 'breve'
      ? '1/2'
      : duration.length;

  if (isRest) {
    return `${length}r`;
  }

  if (duration.dots) {
    return `${length}${'d'.repeat(duration.dots)}`;
  }

  return length;
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
 * Builds a VexFlow stave note from a score voice item and clef.
 */
export function voiceItemToStaveNote(item: VoiceItem, clef: Clef): VFVoiceNote {
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
  const notes = voice.items.map((item) =>
    voiceItemToStaveNote(item, options.resolveClef?.(item) ?? clef)
  );

  const noteByItemId = new Map<string, VFVoiceNote>();
  voice.items.forEach((item, index) =>
    noteByItemId.set(item.id, notes[index]!)
  );

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
