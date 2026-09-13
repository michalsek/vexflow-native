import type { Clef, DurationValue, Notehead, Pitch, Rest } from '../state';

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

const STEPS = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const;
const MIDDLE_STAFF_LINE = 2;

/** Staff lines a pitch moves up from its treble position (VexFlow tables). */
const CLEF_LINE_SHIFT: Record<Clef, number> = {
  'treble': 0,
  'bass': 6,
  'alto': 3,
  'tenor': 4,
  'soprano': 1,
  'mezzo-soprano': 2,
  'baritone-c': 5,
  'baritone-f': 5,
  'subbass': 7,
  'french': -1,
  'percussion': 0,
  'tab': 0,
};

/**
 * VexFlow key placing a rest on `staffLine` (0 = bottom line … 4 = top line,
 * undefined = middle line) under `clef`. VexFlow lines are pitch-based per
 * clef, so the key is the treble pitch of the line minus the clef's shift,
 * counting diatonic steps from c/4 (the ledger line below a treble staff).
 */
export function restKeyForStaffLine(
  clef: Clef,
  staffLine: Rest['staffLine']
): string {
  const line = (staffLine ?? MIDDLE_STAFF_LINE) + 1;
  const diatonicIndex = 2 * (line - CLEF_LINE_SHIFT[clef]);
  const step = STEPS[((diatonicIndex % 7) + 7) % 7]!;
  const octave = 4 + Math.floor(diatonicIndex / 7);

  return `${step}/${octave}`;
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
