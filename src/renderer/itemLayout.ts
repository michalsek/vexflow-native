import { Parenthesis } from 'vexflow';
import type { BoundingBox, GraceNoteGroup, Modifier } from 'vexflow';

import { noteheadWidth } from './scoreParsing';
import type { VFVoiceNote } from './scoreParsing';
import type { ScoreItemBounds, ScoreItemLayout } from './types';

function hasGraceNotes(
  modifier: Modifier
): modifier is Modifier & Pick<GraceNoteGroup, 'getGraceNotes'> {
  return 'getGraceNotes' in modifier;
}

/**
 * Parenthesis draws at its anchor offset without moving itself, so its box
 * is re-anchored where `Parenthesis.draw()` places it.
 */
function modifierBoundingBox(note: VFVoiceNote, modifier: Modifier) {
  const box = modifier.getBoundingBox();

  if (modifier.getCategory() !== Parenthesis.CATEGORY) {
    return box;
  }

  const start = note.getModifierStartXY(
    modifier.getPosition(),
    modifier.checkIndex(),
    { forceFlagRight: true }
  );

  return box.move(start.x, start.y);
}

/**
 * Union box of a drawn note's modifiers; must run after `draw()` because
 * modifiers take their position from it. undefined without modifiers or when
 * none could be measured.
 */
export function computeModifierBounds(
  note: VFVoiceNote
): ScoreItemBounds | undefined {
  let bounds: ScoreItemBounds | undefined;

  for (const modifier of note.getModifiers()) {
    if (hasGraceNotes(modifier)) {
      for (const graceNote of modifier.getGraceNotes()) {
        bounds = mergeBox(bounds, graceNote.getBoundingBox());
      }
    } else {
      bounds = mergeBox(bounds, modifierBoundingBox(note, modifier));
    }
  }

  return bounds;
}

function mergeBox(
  bounds: ScoreItemBounds | undefined,
  box: BoundingBox
): ScoreItemBounds | undefined {
  const left = box.getX();
  const top = box.getY();
  const right = left + box.getW();
  const bottom = top + box.getH();

  if (![left, top, right, bottom].every(Number.isFinite)) {
    return bounds;
  }

  if (!bounds) {
    return { left, right, top, bottom };
  }

  return {
    left: Math.min(bounds.left, left),
    right: Math.max(bounds.right, right),
    top: Math.min(bounds.top, top),
    bottom: Math.max(bounds.bottom, bottom),
  };
}

/** Detected structurally because `GhostNote`s lack these getters. */
type NoteHeadSpan = {
  getNoteHeadBeginX?: () => number;
  getNoteHeadEndX?: () => number;
};

/**
 * Center of a formatted note's visual notehead span. When the getters are
 * missing (GhostNotes) the fallback is the center of a NOTIONAL notehead at
 * the block's left edge, capped by the block width — so a `spacer` rest
 * anchors where a real note's head would sit on the same tick, and external
 * UI aligned to it does not hop when the note appears. Zero-width `hidden`
 * rests keep anchoring at their tick x.
 */
export function resolveItemHeadCenterX(
  note: VFVoiceNote,
  x: number,
  width: number
): number {
  const { getNoteHeadBeginX, getNoteHeadEndX } = note as NoteHeadSpan;

  if (
    typeof getNoteHeadBeginX === 'function' &&
    typeof getNoteHeadEndX === 'function'
  ) {
    const center =
      (getNoteHeadBeginX.call(note) + getNoteHeadEndX.call(note)) / 2;

    if (Number.isFinite(center) && center > x && center <= x + width) {
      return center;
    }
  }

  return x + Math.min(width, noteheadWidth()) / 2;
}

/**
 * Geometry of a drawn item; must run after `draw()` because modifiers only
 * take their position there.
 */
export function itemLayoutOf(
  note: VFVoiceNote,
  measureIndex: number
): ScoreItemLayout {
  const x = note.getAbsoluteX();
  const width = note.getWidth();
  const modifierBounds = computeModifierBounds(note);

  return {
    x,
    width,
    headCenterX: resolveItemHeadCenterX(note, x, width),
    measureIndex,
    ...(modifierBounds ? { modifierBounds } : {}),
  };
}
