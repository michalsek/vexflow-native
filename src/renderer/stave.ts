import type { Stave } from 'vexflow';

import { DEFAULT_STAFF_LINES } from '../state';

const STAVE_LINE_COUNT = 5;
const STAVE_MIDDLE_LINE = 2;

/**
 * Hides the outer lines of a 5-line stave so `lines` stay visible around the
 * middle one. Must run after construction: the constructor resets the line
 * config. Unsupported counts leave all five lines visible.
 */
export function applyStaffLines(
  stave: Stave,
  lines: number = DEFAULT_STAFF_LINES
): Stave {
  if (lines !== 1 && lines !== 3) {
    return stave;
  }

  const reach = (lines - 1) / 2;

  return stave.setConfigForLines(
    Array.from({ length: STAVE_LINE_COUNT }, (_, index) => ({
      visible: Math.abs(index - STAVE_MIDDLE_LINE) <= reach,
    }))
  );
}
