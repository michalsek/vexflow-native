import { SPACER_TONE_COLORS } from './constants';
import type { SpacerAxis, SpacerTone } from './types';

// Returns width and height for spacer orientation.
export function getSpacerDimensions(size: number, axis: SpacerAxis) {
  if (axis === 'horizontal') {
    return { width: size, height: 1 };
  }

  return { width: 1, height: size };
}

// Returns themed background for the selected spacer tone.
export function getSpacerBackgroundColor(
  tone: SpacerTone,
  isDark: boolean
): string {
  const palette = SPACER_TONE_COLORS[tone];

  return isDark ? palette.dark : palette.light;
}
