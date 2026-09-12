import type { Pitch } from './types';

/** Default `Staff.lines`. */
export const DEFAULT_STAFF_LINES = 5;

/** The pitch drawn on the single visible line of a `lines: 1` staff. */
export const ONE_LINE_STAFF_PITCH: Pitch = { step: 'B', octave: 4 };
