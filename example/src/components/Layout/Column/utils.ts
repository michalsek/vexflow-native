import { COLUMN_TONE_COLORS } from './constants';
import type { ColumnTone } from './types';

// Returns base style values for a vertical layout stack.
export function getColumnStyle(gap: number) {
  return {
    gap,
  };
}

// Returns themed background for the selected column tone.
export function getColumnBackgroundColor(
  tone: ColumnTone,
  isDark: boolean
): string {
  const palette = COLUMN_TONE_COLORS[tone];

  return isDark ? palette.dark : palette.light;
}
