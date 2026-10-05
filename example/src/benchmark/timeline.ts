import type { ScoreItemsLayout } from 'vexflow-native/renderer';
import type { NoteLength, Score } from 'vexflow-native/state';

export type PlaybackStep = {
  itemIds: string[];
  measureIndex: number;
  /** Onset within the measure, in whole notes. */
  onset: number;
  x: number;
  y: number;
  height: number;
};

const WHOLE_NOTES: Record<NoteLength, number> = {
  'long': 4,
  'breve': 2,
  'w': 1,
  'h': 1 / 2,
  'q': 1 / 4,
  '8': 1 / 8,
  '16': 1 / 16,
  '32': 1 / 32,
  '64': 1 / 64,
  '128': 1 / 128,
};
const FOLLOW_MARGIN = 16;

/** One step per (measure, onset) across all staves and voices; x is the
 * leftmost note head of the step. Items without layout are skipped. */
export function buildPlaybackTimeline(
  score: Score,
  layout: ScoreItemsLayout
): PlaybackStep[] {
  const scale = new Map<string, number>();
  const blocks = new Map(layout.measures.map((m) => [m.measureIndex, m]));
  const steps = new Map<string, PlaybackStep>();

  for (const { itemIds, ratio } of score.tuplets ?? []) {
    itemIds.forEach((id) =>
      scale.set(id, ((scale.get(id) ?? 1) * ratio.den) / ratio.num)
    );
  }

  score.staves.forEach((staff) =>
    staff.measures.forEach((measure, measureIndex) =>
      measure.voices.forEach((voice) => {
        let onset = 0;

        for (const { id, duration } of voice.items) {
          const at = Math.round(onset * 1e6) / 1e6;
          const item = layout.items[id];
          const block = blocks.get(measureIndex);
          const key = `${measureIndex}:${at}`;
          const step = steps.get(key);

          onset +=
            WHOLE_NOTES[duration.length] *
            (2 - 0.5 ** (duration.dots ?? 0)) *
            (scale.get(id) ?? 1);

          if (!item || !block) {
            continue;
          }
          if (step) {
            step.itemIds.push(id);
            step.x = Math.min(step.x, item.headCenterX);
          } else {
            steps.set(key, {
              itemIds: [id],
              measureIndex,
              onset: at,
              x: item.headCenterX,
              y: block.y,
              height: block.height,
            });
          }
        }
      })
    )
  );

  return [...steps.values()].sort(
    (a, b) => a.measureIndex - b.measureIndex || a.onset - b.onset
  );
}

/** Playhead x at `position` steps: interpolated towards the next step on
 * the same system, held otherwise. */
export function playheadX(steps: readonly PlaybackStep[], position: number) {
  'worklet';

  const index = Math.min(steps.length - 1, Math.floor(position));
  const step = steps[index]!;
  const next = steps[index + 1];

  return next && next.y === step.y
    ? step.x + (next.x - step.x) * (position - index)
    : step.x;
}

/** Offset that sweeps 0 → maxScroll → 0 at `velocity` pt/s. */
export function pingPongOffset(
  elapsedMs: number,
  velocity: number,
  maxScroll: number
): number {
  'worklet';

  if (maxScroll <= 0) {
    return 0;
  }

  const distance = ((elapsedMs / 1000) * velocity) % (2 * maxScroll);

  return distance <= maxScroll ? distance : 2 * maxScroll - distance;
}

/** Keeps `offset` while [start, start + extent] is visible, else pages to it. */
export function followOffset(
  offset: number,
  start: number,
  extent: number,
  viewportExtent: number,
  maxScroll: number
): number {
  'worklet';

  if (start >= offset && start + extent <= offset + viewportExtent) {
    return offset;
  }

  return Math.min(Math.max(start - FOLLOW_MARGIN, 0), maxScroll);
}
