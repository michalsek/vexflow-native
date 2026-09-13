import type { Pitch } from '../state';

/** The pitch drawn on the single visible line of a `lines: 1` staff. */
export const ONE_LINE_STAFF_PITCH: Readonly<Pitch> = Object.freeze({
  step: 'B',
  octave: 4,
} as const);
