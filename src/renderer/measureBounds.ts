import type {
  BoundingBox,
  GraceNoteGroup,
  Modifier,
  RenderContext,
} from 'vexflow';

import { hasNoteHeads } from './noteModifiers';
import type { VFVoiceNote } from './scoreParsing';

export interface StaffVerticalBounds {
  top: number;
  bottom: number;
}

/**
 * Render context that absorbs every method call without drawing anything, so
 * notes and modifiers can run their `draw()` placement math during
 * measurement.
 */
function createNoopRenderContext(): RenderContext {
  const memo: Record<PropertyKey, unknown> = {};
  const proxy: object = new Proxy(memo, {
    get: (target, property) => {
      if (!(property in target)) {
        target[property] = () => proxy;
      }

      return target[property];
    },
  });

  return proxy as RenderContext;
}

const NOOP_RENDER_CONTEXT = createNoopRenderContext();

function hasGraceNotes(
  modifier: Modifier
): modifier is Modifier & Pick<GraceNoteGroup, 'getGraceNotes'> {
  return 'getGraceNotes' in modifier;
}

/**
 * Mutates the note (draws it against a no-op context and anchors unplaced
 * modifiers); safe only because measurement voices are discarded and
 * rendering builds fresh ones.
 */
export function mergeNoteBounds(
  bounds: StaffVerticalBounds | undefined,
  note: VFVoiceNote
) {
  if (!bounds) {
    return;
  }

  const modifiers = note.getModifiers();
  const origins = modifiers.map((modifier) => [
    modifier.getX(),
    modifier.getY(),
  ]);

  try {
    note.setContext(NOOP_RENDER_CONTEXT).draw();
  } catch {
    // Modifiers the draw did not reach are anchored below instead.
  }

  modifiers.forEach((modifier, index) => {
    try {
      const [x, y] = origins[index]!;

      if (modifier.getX() === x && modifier.getY() === y) {
        const start = note.getModifierStartXY(
          modifier.getPosition(),
          modifier.checkIndex()
        );

        modifier.setX(start.x).setY(start.y);
      }

      if (hasGraceNotes(modifier)) {
        modifier.getGraceNotes().forEach((graceNote) => {
          mergeBoundingBox(bounds, graceNote.getBoundingBox());
        });
      }
    } catch {
      // Ghost and spacer notes cannot anchor modifiers.
    }
  });

  if (hasNoteHeads(note)) {
    mergeBoundingBox(bounds, note.getBoundingBox());
  }
}

function mergeBoundingBox(bounds: StaffVerticalBounds, box: BoundingBox) {
  mergeY(bounds, box.getY());
  mergeY(bounds, box.getY() + box.getH());
}

export function mergeY(bounds: StaffVerticalBounds | undefined, y: number) {
  if (!bounds || !Number.isFinite(y)) {
    return;
  }

  bounds.top = Math.min(bounds.top, y);
  bounds.bottom = Math.max(bounds.bottom, y);
}
