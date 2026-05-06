import type { RendererRect, ScoreOptions } from '../types';

const STAVE_LINE_BLOCK_HEIGHT = 41;
const STAVE_STEM_CLEARANCE = 11;
const MIN_SYSTEM_GAP = 82;
const SYSTEM_GAP_DIVISOR = 8;

export function getAvailableDocumentWidth(
  viewport: RendererRect,
  options: ScoreOptions
): number {
  return Math.max(
    0,
    viewport.width - options.insets.left - options.insets.right
  );
}

export function getStaffStackHeight(
  staffCount: number,
  staffGap: number
): number {
  const singleStaffHeight = STAVE_LINE_BLOCK_HEIGHT + STAVE_STEM_CLEARANCE;

  if (staffCount <= 1) {
    return singleStaffHeight;
  }

  return singleStaffHeight + (staffCount - 1) * staffGap;
}

export function getSystemGap(staffGap: number): number {
  return Math.max(MIN_SYSTEM_GAP, staffGap / SYSTEM_GAP_DIVISOR);
}
