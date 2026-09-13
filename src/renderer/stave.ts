import type { Stave } from 'vexflow';

import type { StaffLines } from '../state';

/**
 * Indices (0 = top) of the lines a `lines`-line staff draws on five-line
 * geometry: the middle line plus `lines - 1` around it.
 */
function visibleLineIndices(lineCount: number, lines?: StaffLines): number[] {
  const middleLine = (lineCount - 1) / 2;
  const reach = ((lines ?? lineCount) - 1) / 2;

  return Array.from({ length: lineCount }, (_, index) => index).filter(
    (index) => Math.abs(index - middleLine) <= reach
  );
}

/**
 * Hides the outer lines of a 5-line stave so `lines` stay visible around the
 * middle one. Must run after construction: the constructor resets the line
 * config.
 */
export function applyStaffLines(stave: Stave, lines?: StaffLines): Stave {
  const lineCount = stave.getNumLines();

  if (lines === undefined || lines === lineCount) {
    return stave;
  }

  const visible = new Set(visibleLineIndices(lineCount, lines));

  return stave.setConfigForLines(
    Array.from({ length: lineCount }, (_, index) => ({
      visible: visible.has(index),
    }))
  );
}

/** Stroke centre y of every drawn line of a rendered stave, top to bottom. */
export function visibleLineYs(stave: Stave, lines?: StaffLines): number[] {
  return visibleLineIndices(stave.getNumLines(), lines).map((index) =>
    stave.getYForLine(index)
  );
}
