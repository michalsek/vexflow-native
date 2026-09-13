import type { DurationValue, Notehead, Pitch } from '../state';

/**
 * Maps library notehead names to VexFlow key glyph codes.
 */
const NOTEHEAD_TO_VF_CODE: Record<Notehead, string> = {
  'x': 'x',
  'circle-x': 'cx',
  'diamond': 'h',
  'circle': 'ci',
  'square': 'sq',
  'triangle': 'tu',
  'triangle-down': 'td',
  'slash': 'sf',
};

/**
 * Converts an internal pitch into the VexFlow key string format.
 */
export function pitchToVFKey(pitch: Pitch): string {
  const accidental =
    pitch.accidental === 'quarter-flat'
      ? 'db'
      : pitch.accidental === 'quarter-sharp'
      ? 'd#'
      : pitch.accidental ?? '';

  const key = `${pitch.step.toLowerCase()}${accidental}/${pitch.octave}`;

  if (pitch.notehead) {
    return `${key}/${NOTEHEAD_TO_VF_CODE[pitch.notehead]}`;
  }

  return key;
}

/**
 * Converts a duration into the VexFlow duration token, including rests.
 */
export function durationToVF(duration: DurationValue, isRest = false): string {
  const length =
    duration.length === 'long' || duration.length === 'breve'
      ? '1/2'
      : duration.length;

  // Dots drive VexFlow's tick math, so rests need them in the token too or
  // strict voices come up short.
  const dots = 'd'.repeat(duration.dots ?? 0);

  return `${length}${dots}${isRest ? 'r' : ''}`;
}
