import {
  Accidental as VFAccidental,
  Annotation as VFAnnotation,
  AnnotationVerticalJustify,
  Articulation as VFArticulation,
  Dot,
  GraceNote as VFGraceNote,
  GraceNoteGroup,
  ModifierPosition,
  Parenthesis,
  StaveNote,
  Stem,
} from 'vexflow';
import type { StemmableNote } from 'vexflow';

import type {
  Articulation,
  Clef,
  Direction,
  DurationValue,
  Dynamic,
  GraceNoteAttachment,
  LyricAttachment,
  NoteAttachment,
  Pitch,
} from '../state';
import { durationToVF, pitchToVFKey } from './vfKeys';

/**
 * Maps library articulation names to VexFlow articulation codes.
 */
export const ARTICULATION_TO_VF_CODE: Record<Articulation, string> = {
  staccato: 'a.',
  staccatissimo: 'av',
  tenuto: 'a-',
  accent: 'a>',
  marcato: 'a^',
  fermata: 'a@',
  open: 'ah',
  stopped: 'a+',
};

/** SMuFL dynamics glyphs, drawn with the music font. */
const DYNAMIC_GLYPHS: Record<Dynamic, string> = {
  ppp: '',
  pp: '',
  p: '',
  mp: '',
  mf: '',
  f: '',
  ff: '',
  fff: '',
  fp: '',
  sf: '',
  sfp: '',
  sfz: '',
  rf: '',
  rfz: '',
  fz: '',
  n: '',
};

const DYNAMIC_FONT_SIZE = 30;

const ANNOTATION_FONT = {
  family: 'Arial, Helvetica, sans-serif',
  size: 10,
  weight: 'bold',
};

const LYRIC_FONT = {
  family: ANNOTATION_FONT.family,
  size: 10,
  weight: 'normal',
};

const DIRECTION_FONT = {
  family: ANNOTATION_FONT.family,
  size: 11,
  weight: 'bold',
};

/** `GhostNote`s have no glyphs, so their element box is the origin. */
export function hasNoteHeads(note: StemmableNote): note is StaveNote {
  return 'getNoteHeadBeginX' in note;
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
function addPitchAccidentals(note: StaveNote, pitches: readonly Pitch[]) {
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
 * Wraps each parenthesized pitch of a note in parentheses.
 */
function applyPitchParentheses(note: StaveNote, pitches: readonly Pitch[]) {
  pitches.forEach((pitch, index) => {
    if (!pitch.parenthesized) {
      return;
    }

    note.addModifier(new Parenthesis(ModifierPosition.LEFT), index);
    note.addModifier(new Parenthesis(ModifierPosition.RIGHT), index);
  });
}

export function decorateStaveNote(
  note: StaveNote,
  pitches: readonly Pitch[],
  duration: DurationValue
) {
  addPitchAccidentals(note, pitches);
  applyPitchParentheses(note, pitches);
  applyDots(note, duration.dots);
}

/** Every attachment a rest can carry: grace notes need a pitched owner. */
export function restAttachments(
  attachments: NoteAttachment[] | undefined
): NoteAttachment[] | undefined {
  return attachments?.filter((attachment) => attachment.type !== 'grace');
}

function verticalJustification(placement: 'above' | 'below') {
  return placement === 'above'
    ? AnnotationVerticalJustify.TOP
    : AnnotationVerticalJustify.BOTTOM;
}

function byVerse(left: LyricAttachment, right: LyricAttachment) {
  return (left.verse ?? -Infinity) - (right.verse ?? -Infinity);
}

/**
 * Attaches the owner's marks to a VexFlow note in a fixed order regardless of
 * the attachments' order: articulations, annotations, dynamics, lyrics (by
 * verse), grace notes. Same-side marks stack outward in that order.
 */
export function applyNoteModifiers(
  note: StaveNote,
  clef: Clef,
  attachments: NoteAttachment[] | undefined
) {
  if (!attachments) {
    return;
  }

  for (const attachment of attachments) {
    if (attachment.type === 'articulation') {
      const articulation = new VFArticulation(
        ARTICULATION_TO_VF_CODE[attachment.articulation]
      );

      if (attachment.placement === 'below') {
        articulation.setPosition(ModifierPosition.BELOW);
      }

      note.addModifier(articulation, 0);
    }
  }

  for (const attachment of attachments) {
    if (attachment.type === 'annotation') {
      const annotation = new VFAnnotation(attachment.text);

      annotation.setFont(ANNOTATION_FONT);
      annotation.setVerticalJustification(
        verticalJustification(attachment.placement ?? 'below')
      );
      note.addModifier(annotation, 0);
    }
  }

  for (const attachment of attachments) {
    if (attachment.type === 'dynamic') {
      const dynamic = new VFAnnotation(DYNAMIC_GLYPHS[attachment.dynamic]);

      dynamic.setFontSize(DYNAMIC_FONT_SIZE);
      dynamic.setVerticalJustification(
        verticalJustification(attachment.placement ?? 'below')
      );
      note.addModifier(dynamic, 0);
    }
  }

  attachments
    .filter(
      (attachment): attachment is LyricAttachment => attachment.type === 'lyric'
    )
    .sort(byVerse)
    .forEach((attachment) => {
      const lyric = new VFAnnotation(attachment.text);

      lyric.setFont(LYRIC_FONT);
      lyric.setVerticalJustification(AnnotationVerticalJustify.BOTTOM);
      note.addModifier(lyric, 0);
    });

  for (const attachment of attachments) {
    if (attachment.type === 'grace') {
      applyGraceNoteGroup(note, clef, attachment);
    }
  }
}

/**
 * Grace notes stem up unless the owner was built stem-down (auto stems that
 * flip later in `Beam.generateBeams` are not followed); two or more are
 * beamed together, with the acciaccatura slash on the first stem only.
 */
function applyGraceNoteGroup(
  note: StaveNote,
  clef: Clef,
  attachment: GraceNoteAttachment
) {
  if (attachment.notes.length === 0) {
    return;
  }

  const stemDirection =
    note.getStemDirection() === Stem.DOWN ? Stem.DOWN : Stem.UP;
  const graceNotes = attachment.notes.map((graceNote, index) => {
    const vfGraceNote = new VFGraceNote({
      clef,
      keys: [pitchToVFKey(graceNote.pitch)],
      duration: durationToVF(graceNote.duration),
      slash: index === 0 && attachment.slash === true,
      stemDirection,
    });
    decorateStaveNote(vfGraceNote, [graceNote.pitch], graceNote.duration);
    return vfGraceNote;
  });
  const group = new GraceNoteGroup(graceNotes);

  if (graceNotes.length > 1) {
    group.beamNotes();
  }

  note.addModifier(group, 0);
}

/**
 * Draws each text direction of a measure on the voice's first drawn item,
 * after that item's own marks; a voice of spacers draws none. Tempo
 * directions are not drawn.
 */
export function applyMeasureDirections(
  notes: readonly StemmableNote[],
  directions: readonly Direction[] | undefined
) {
  if (!directions?.length) {
    return;
  }

  const anchor = notes.find(hasNoteHeads);

  if (!anchor) {
    return;
  }

  for (const direction of directions) {
    if (direction.type !== 'text') {
      continue;
    }

    const annotation = new VFAnnotation(direction.text);

    annotation.setFont(DIRECTION_FONT);
    annotation.setVerticalJustification(
      verticalJustification(direction.placement ?? 'above')
    );
    anchor.addModifier(annotation, 0);
  }
}
