import type { RendererRect, ScoreOptions } from '../types';

const MIN_SYSTEM_GAP = 82;
const SYSTEM_GAP_DIVISOR = 8;

export const VEXFLOW_STAVE_TOP_LINE_OFFSET = 40;
export const VEXFLOW_STAVE_BOTTOM_LINE_OFFSET = 80;

export function getAvailableDocumentWidth(
  viewport: RendererRect,
  options: ScoreOptions
): number {
  return Math.max(
    0,
    viewport.width - options.insets.left - options.insets.right
  );
}

export function getSystemGap(staffGap: number): number {
  return Math.max(MIN_SYSTEM_GAP, staffGap / SYSTEM_GAP_DIVISOR);
}
