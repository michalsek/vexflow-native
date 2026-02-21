import { HEADING_FONT_SIZES } from './constants';
import type { HeadingLevel } from './types';

// Resolves heading typography for chosen level.
export function getHeadingStyle(level: HeadingLevel) {
  return {
    fontSize: HEADING_FONT_SIZES[level],
    lineHeight: HEADING_FONT_SIZES[level] + 6,
  };
}
