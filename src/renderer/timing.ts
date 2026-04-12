import type { Duration, Meter } from '../state';

const QUARTER_BEAT_LENGTHS: Record<Duration['length'], number> = {
  'w': 4,
  'h': 2,
  'q': 1,
  '8': 0.5,
  '16': 0.25,
  '32': 0.125,
  '64': 0.0625,
  '128': 0.03125,
};

export function getDurationInQuarterBeats(duration: Duration): number {
  const base = QUARTER_BEAT_LENGTHS[duration.length];
  const dots = duration.dots ?? 0;
  const dotted = dots > 0 ? base * (2 - 1 / Math.pow(2, dots)) : base;
  const tupletRatio = duration.tuplet
    ? duration.tuplet.den / duration.tuplet.num
    : 1;

  return dotted * tupletRatio;
}

export function getMeasureQuarterBeats(meter: Meter): number {
  return meter.beats * (4 / meter.beatUnit);
}
