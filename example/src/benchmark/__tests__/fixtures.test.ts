import { ONE_LINE_STAFF_PITCH } from 'vexflow-native/percussion';
import type { Score, VoiceItem } from 'vexflow-native/state';

import { createBenchScore } from '../fixtures/createBenchScore';
import { applySingleNoteEdit, getEditTarget } from '../fixtures/editScore';

const LONG = {
  id: 'bench-long',
  measures: 208,
  parts: ['melody', 'snare'],
} as const;
const WHOLE: Record<string, number> = {
  h: 1 / 2,
  q: 1 / 4,
  8: 1 / 8,
  16: 1 / 16,
};

const itemsOf = (score: Score): VoiceItem[] =>
  score.staves.flatMap((staff) =>
    staff.measures.flatMap((measure) =>
      measure.voices.flatMap((voice) => voice.items)
    )
  );

describe('createBenchScore', () => {
  const score = createBenchScore({ ...LONG, parts: [...LONG.parts] });
  const items = itemsOf(score);
  const has = (
    predicate: (a: NonNullable<Score['attachments']>[number]) => boolean
  ) => score.attachments!.some(predicate);

  it('is deterministic', () => {
    expect(createBenchScore({ ...LONG, parts: [...LONG.parts] })).toEqual(
      score
    );
  });

  it('fills 208 measures of 4/4 on both staves, triplets scaled', () => {
    const triplet = new Set(score.tuplets!.flatMap((t) => t.itemIds));

    for (const staff of score.staves) {
      expect(staff.measures).toHaveLength(208);
      for (const measure of staff.measures) {
        const total = measure.voices[0]!.items.reduce(
          (sum, { id, duration }) =>
            sum +
            WHOLE[duration.length]! *
              (duration.dots ? 1.5 : 1) *
              (triplet.has(id) ? 2 / 3 : 1),
          0
        );
        expect(total).toBeCloseTo(1, 9);
      }
    }
  });

  it('has unique ids and only valid references', () => {
    const ids = new Set(items.map((item) => item.id));
    const references = [
      ...score.attachments!.map((a) => a.ownerId),
      ...score.tuplets!.flatMap((t) => t.itemIds),
      ...score.slurs!.flatMap((s) => [s.fromNoteId, s.toNoteId]),
    ];

    expect(ids.size).toBe(items.length);
    expect(references.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('covers the renderer feature set', () => {
    const features = {
      flam: has((a) => a.type === 'grace' && a.slash === true),
      drag: has((a) => a.type === 'grace' && a.notes.length === 2),
      accent: has((a) => a.type === 'articulation'),
      sticking: has((a) => a.type === 'annotation'),
      verse2: has((a) => a.type === 'lyric' && a.verse === 2),
      dynamic: has((a) => a.type === 'dynamic'),
      slur: score.slurs!.length > 0,
      rest: items.some((i) => i.type === 'rest'),
      ghost: items.some((i) => i.type === 'note' && !!i.pitch.parenthesized),
      accidental: items.some((i) => i.type === 'note' && !!i.pitch.accidental),
      text: !!score.staves[0]!.measures[8]!.directions,
      section: score.staffGroups?.[0]?.role === 'section',
    };

    expect(
      Object.keys(features).filter(
        (key) => !features[key as keyof typeof features]
      )
    ).toEqual([]);
  });

  it('puts a one-line snare on ONE_LINE_STAFF_PITCH', () => {
    const oneLine = createBenchScore({
      id: 'x',
      measures: 1,
      parts: ['snare'],
      snareLines: 1,
    });

    expect(oneLine.staves[0]).toMatchObject({
      lines: 1,
      defaultClef: 'percussion',
    });
    expect(itemsOf(oneLine).find((i) => i.type === 'note')).toMatchObject({
      pitch: {
        step: ONE_LINE_STAFF_PITCH.step,
        octave: ONE_LINE_STAFF_PITCH.octave,
      },
    });
  });
});

describe('applySingleNoteEdit', () => {
  const base = createBenchScore({
    id: 'b',
    measures: 12,
    parts: ['melody', 'snare'],
  });
  const snapshot = JSON.stringify(base);
  const target = getEditTarget(base)!;
  const itemAt = (score: Score) =>
    score.staves[0]!.measures[target.measureIndex]!.voices[0]!.items[
      target.itemIndex
    ];

  it('changes only the target note and shares everything else', () => {
    const edited = applySingleNoteEdit(base, 0);
    const editedItems = itemsOf(edited);
    const changed = itemsOf(base).filter(
      (item, index) =>
        JSON.stringify(item) !== JSON.stringify(editedItems[index])
    );

    expect(changed).toEqual([itemAt(base)]);
    expect(edited.staves[1]).toBe(base.staves[1]);
    expect(edited.staves[0]!.measures[0]).toBe(base.staves[0]!.measures[0]);
  });

  it('restores the base pitch on odd edits as a new reference', () => {
    const restored = applySingleNoteEdit(base, 1);

    expect(restored).toEqual(base);
    expect(itemAt(restored)).not.toBe(itemAt(base));
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
