import { ROW_TONE_COLORS } from './constants';
import type { RowTone } from './types';

// Returns base style values for a horizontal layout stack.
export function getRowStyle(gap: number, wrap: boolean) {
  return {
    gap,
    flexWrap: wrap ? ('wrap' as const) : ('nowrap' as const),
  };
}

// Returns themed background for the selected row tone.
export function getRowBackgroundColor(tone: RowTone, isDark: boolean): string {
  const palette = ROW_TONE_COLORS[tone];

  return isDark ? palette.dark : palette.light;
}
