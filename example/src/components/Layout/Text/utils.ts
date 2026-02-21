import { BODY_TEXT_COLORS } from './constants';
import type { BodyTextVariant } from './types';

// Returns text color for selected variant and theme.
export function getBodyTextColor(
  variant: BodyTextVariant,
  isDark: boolean
): string {
  const palette = BODY_TEXT_COLORS[variant];

  return isDark ? palette.dark : palette.light;
}
