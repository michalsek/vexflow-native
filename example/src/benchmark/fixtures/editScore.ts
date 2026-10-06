import type { Pitch, Score, Step } from 'vexflow-native/state';

const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

type EditTarget = {
  measureIndex: number;
  itemIndex: number;
  pitch: Pitch;
};

/** First note of the middle measure of staff 0; null when it has none. */
export function getEditTarget(score: Score): EditTarget | null {
  const measures = score.staves[0]?.measures ?? [];
  const measureIndex = Math.floor(measures.length / 2);
  const items = measures[measureIndex]?.voices[0]?.items ?? [];
  const itemIndex = items.findIndex((item) => item.type === 'note');
  const item = items[itemIndex];

  return item?.type === 'note'
    ? { measureIndex, itemIndex, pitch: item.pitch }
    : null;
}

function stepUp(pitch: Pitch): Pitch {
  const index = STEPS.indexOf(pitch.step);

  return index === STEPS.length - 1
    ? { ...pitch, step: 'C', octave: pitch.octave + 1 }
    : { ...pitch, step: STEPS[index + 1]! };
}

/** Edit `i` of a run: even = target one diatonic step up, odd = back to base.
 * Every result is a new Score sharing all untouched staves/measures/items. */
export function applySingleNoteEdit(base: Score, i: number): Score {
  const target = getEditTarget(base);

  if (!target) {
    return base;
  }

  const pitch = i % 2 === 0 ? stepUp(target.pitch) : { ...target.pitch };
  const [staff, ...otherStaves] = base.staves;
  const measures = staff!.measures.map((measure, measureIndex) => {
    if (measureIndex !== target.measureIndex) {
      return measure;
    }

    const [voice, ...otherVoices] = measure.voices;
    const items = voice!.items.map((item, itemIndex) =>
      itemIndex === target.itemIndex && item.type === 'note'
        ? { ...item, pitch }
        : item
    );

    return { ...measure, voices: [{ ...voice!, items }, ...otherVoices] };
  });

  return { ...base, staves: [{ ...staff!, measures }, ...otherStaves] };
}
