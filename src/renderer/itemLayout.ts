import { Parenthesis } from 'vexflow';
import type { BoundingBox, GraceNoteGroup, Modifier } from 'vexflow';

import type { VFVoiceNote } from './scoreParsing';
import type { ScoreItemBounds } from './types';

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
