import type { Stave } from 'vexflow';

import type { StaffLines } from '../state';

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

  const middleLine = (lineCount - 1) / 2;
  const reach = (lines - 1) / 2;

  return stave.setConfigForLines(
    Array.from({ length: lineCount }, (_, index) => ({
      visible: Math.abs(index - middleLine) <= reach,
    }))
  );
}
