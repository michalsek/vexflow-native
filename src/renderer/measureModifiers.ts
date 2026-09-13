import { BarlineType, type Stave, StaveModifierPosition } from 'vexflow';

import type { Barline, KeyMode, KeySignature, Measure, Step } from '../state';
import type { ResolvedMeasureState } from './scoreParsing';

export interface ResolvedMeasureModifiers {
  showClef: boolean;
  showMeter: boolean;
  showKeySignature: boolean;
  startBarline: Barline;
  endBarline: Barline;
}

/** Fifths of the natural tonic; `#` adds 7, `b` subtracts 7. */
const STEP_FIFTHS: Record<Step, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: -1,
  G: 1,
  A: 3,
  B: 5,
};

/** Fifths offset from the parallel major with the same tonic. */
const MODE_FIFTHS: Record<KeyMode, number> = {
  major: 0,
  mixolydian: -1,
  dorian: -2,
  minor: -3,
  phrygian: -4,
  lydian: 1,
  locrian: -5,
};

/** VexFlow major key specs indexed by fifths + 7. */
const MAJOR_KEY_SPECS = [
  'Cb',
  'Gb',
  'Db',
  'Ab',
  'Eb',
  'Bb',
  'F',
  'C',
  'G',
  'D',
  'A',
  'E',
  'B',
  'F#',
  'C#',
] as const;

const START_BARLINE_TYPES: Partial<Record<Barline, BarlineType>> = {
  'repeat-begin': BarlineType.REPEAT_BEGIN,
};

const END_BARLINE_TYPES: Record<Barline, BarlineType> = {
  'single': BarlineType.SINGLE,
  'double': BarlineType.DOUBLE,
  'end': BarlineType.END,
  'final': BarlineType.END,
  'repeat-begin': BarlineType.SINGLE,
  'repeat-end': BarlineType.REPEAT_END,
};

/**
 * Resolves the tri-state measure modifiers: `true` shows, `false` hides,
 * `undefined` falls back to the default (clef on the first measure only,
 * meter and key signature hidden, single barlines).
 */
export function resolveMeasureModifiers(
  measure: Pick<Measure, 'leftModifiers' | 'rightModifiers'>,
  measureIndex: number
): ResolvedMeasureModifiers {
  const { leftModifiers, rightModifiers } = measure;

  return {
    showClef: leftModifiers?.showClef ?? measureIndex === 0,
    showMeter: leftModifiers?.showMeter ?? false,
    showKeySignature: leftModifiers?.showKeySignature ?? false,
    startBarline: leftModifiers?.startBarline ?? 'single',
    endBarline: rightModifiers?.endBarline ?? 'single',
  };
}

export function applyMeasureModifiers(
  stave: Stave,
  modifiers: ResolvedMeasureModifiers,
  resolvedState: ResolvedMeasureState
): Stave {
  const { clef, keySignature, meter } = resolvedState;

  if (modifiers.showClef) {
    stave.addClef(clef);
  }

  if (modifiers.showKeySignature && keySignature && clef !== 'percussion') {
    stave.addKeySignature(keySignatureToVFSpec(keySignature));
  }

  if (modifiers.showMeter) {
    stave.addTimeSignature(`${meter.beats}/${meter.beatUnit}`);
  }

  stave.setBegBarType(
    START_BARLINE_TYPES[modifiers.startBarline] ?? BarlineType.SINGLE
  );
  stave.setEndBarType(END_BARLINE_TYPES[modifiers.endBarline]);

  // Stave.format pads a lone REPEAT_BEGIN by 0, so its dots would overlap the first note.
  if (
    modifiers.startBarline === 'repeat-begin' &&
    stave.getModifiers(StaveModifierPosition.BEGIN).length === 1
  ) {
    const { xMax, paddingRight } = stave.getModifiers()[0]!.getLayoutMetrics()!;

    stave.setNoteStartX(stave.getX() + xMax + paddingRight);
  }

  return stave;
}

/** Major-key VexFlow spec for the key's accidentals, respelt enharmonically beyond 7 sharps/flats. */
export function keySignatureToVFSpec(keySignature: KeySignature): string {
  const { tonic, accidental, mode = 'major' } = keySignature;
  const accidentalFifths = accidental === '#' ? 7 : accidental === 'b' ? -7 : 0;
  const fifths = STEP_FIFTHS[tonic] + accidentalFifths + MODE_FIFTHS[mode];
  const wrapped = fifths > 7 ? fifths - 12 : fifths < -7 ? fifths + 12 : fifths;

  return MAJOR_KEY_SPECS[wrapped + 7]!;
}
