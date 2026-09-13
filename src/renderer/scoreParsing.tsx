import {
  Beam,
  Element,
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
  Direction,
  KeySignature,
  Meter,
  NoteAttachment,
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
import {
  applyDots,
  applyMeasureDirections,
  applyNoteModifiers,
  decorateStaveNote,
  restAttachments,
} from './noteModifiers';
import { durationToVF, pitchToVFKey, restKeyForStaffLine } from './vfKeys';
import type { DecorateItem } from './types';

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
   * Precomputed attachment index; pass it when calling in a loop to avoid
   * rebuilding it on every call.
   */
  attachmentsByOwner?: Map<string, NoteAttachment[]>;
  /** Owning staff; on a one-line staff auto stems point up. */
  staff?: Staff;
  /** Measure directions drawn on this voice's first drawn item. */
  directions?: Direction[];
  /** Consulted with `staff` and `measureIndex`; skipped when either is absent. */
  decorateItem?: DecorateItem;
  measureIndex?: number;
}

/** Receives the item's raw attachments (rests included, unfiltered). */
export type ItemDecorator = (
  item: VoiceItem,
  note: StaveNote,
  attachments: readonly NoteAttachment[]
) => void;

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

// SMuFL noteheadBlack — vexflow 5's entry point does not re-export `Glyphs`.
const NOTEHEAD_BLACK = '\uE0A4';

/**
 * Width a `spacer` rest reserves on its tick: an up-stem flagged note
 * (2 × notehead + padding), the widest ordinary tickable. A TickContext takes
 * the MAX of its members' widths, so reserving the worst case keeps a tick's
 * width constant whether or not a real note shares it — a voice of spacers
 * therefore holds engraved spacing still while notes toggle on and off its
 * lattice. `hidden` rests stay zero-width (pure timing placeholders).
 * Measured live because the value depends on the active music font.
 */
/** Measured width of the black notehead under the active music font. */
export function noteheadWidth(): number {
  return Element.measureWidth(NOTEHEAD_BLACK, 'NoteHead');
}

function spacerTickWidth(): number {
  return 2 * noteheadWidth() + StaveNote.minNoteheadPadding;
}

/**
 * Builds a VexFlow stave note from a score voice item and clef.
 */
export function voiceItemToStaveNote(
  item: VoiceItem,
  clef: Clef,
  attachments?: NoteAttachment[],
  decorate?: ItemDecorator
): VFVoiceNote {
  if (
    item.type === 'rest' &&
    (item.kind === 'hidden' || item.kind === 'spacer')
  ) {
    const note = new GhostNote(durationToVF(item.duration));

    if (item.kind === 'spacer') {
      note.setWidth(spacerTickWidth());
    }

    return note;
  }

  const note = buildStaveNote(item, clef);

  applyNoteModifiers(
    note,
    clef,
    item.type === 'rest' ? restAttachments(attachments) : attachments
  );
  decorate?.(item, note, attachments ?? []);

  return note;
}

function buildStaveNote(item: VoiceItem, clef: Clef): StaveNote {
  if (item.type === 'rest') {
    const note = new StaveNote({
      clef,
      keys: [restKeyForStaffLine(clef, item.staffLine)],
      duration: durationToVF(item.duration, true),
    });

    applyDots(note, item.duration.dots);

    return note;
  }

  const pitches = item.type === 'note' ? [item.pitch] : item.pitches;
  const note = new StaveNote({
    clef,
    keys: pitches.map(pitchToVFKey),
    duration: durationToVF(item.duration),
    stemDirection: toVFStemDirection(item.stemDirection),
  });

  decorateStaveNote(note, pitches, item.duration);

  return note;
}

/**
 * Beam groups for a meter: its explicit `beamGroups`, otherwise VexFlow's
 * conventional grouping for the time signature (quarters in x/4, dotted
 * quarters in 6/8, 9/8, 12/8, halves in x/2).
 */
export function beamGroupsToVF(meter?: Meter): VFFraction[] | undefined {
  if (!meter) {
    return undefined;
  }

  if (meter.beamGroups?.length) {
    return meter.beamGroups.map(
      (group) => new VFFraction(group.num, group.den)
    );
  }

  return Beam.getDefaultBeamGroups(`${meter.beats}/${meter.beatUnit}`);
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
  const { decorateItem, staff, measureIndex } = options;
  const notes = voice.items.map((item) => {
    const itemClef = options.resolveClef?.(item) ?? clef;
    const decorate: ItemDecorator | undefined =
      decorateItem && staff && measureIndex !== undefined
        ? (decoratedItem, note, attachments) =>
            decorateItem(decoratedItem, note, {
              clef: itemClef,
              staff,
              measureIndex,
              attachments,
            })
        : undefined;

    return voiceItemToStaveNote(
      item,
      itemClef,
      attachmentsByOwner.get(item.id),
      decorate
    );
  });
  applyMeasureDirections(notes, options.directions);

  const noteByItemId = new Map<string, VFVoiceNote>();
  voice.items.forEach((item, index) =>
    noteByItemId.set(item.id, notes[index]!)
  );

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
  const maintainStemDirections =
    options.staff?.lines === 1 || voice.items.some(hasExplicitStemDirection);
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
