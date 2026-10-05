import type { BenchScenario } from './config';
import type { PhaseTimes } from './profileLines';

const REFRESH_RATES = [60, 90, 120];

export const round1 = (value: number) => Math.round(value * 10) / 10;

/** Nearest-rank percentile of an ascending array; 0 when empty. */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  return sorted[Math.max(1, Math.ceil((p / 100) * sorted.length)) - 1]!;
}

function summarizeSamples(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);

  return {
    n: sorted.length,
    mean: round1(sorted.length ? sum / sorted.length : 0),
    median: round1(percentile(sorted, 50)),
    p95: round1(percentile(sorted, 95)),
    p99: round1(percentile(sorted, 99)),
    max: round1(sorted[sorted.length - 1] ?? 0),
  };
}

export function detectRefreshHz(intervals: readonly number[]): number {
  const median = summarizeSamples(intervals).median;
  const hz = median > 0 ? 1000 / median : 60;

  return REFRESH_RATES.reduce((best, rate) =>
    Math.abs(rate - hz) < Math.abs(best - hz) ? rate : best
  );
}

/** Σ max(0, round(interval / budget) − 1) */
const droppedFrames = (intervals: readonly number[], hz: number) =>
  intervals.reduce(
    (sum, interval) =>
      sum + Math.max(0, Math.round((interval * hz) / 1000) - 1),
    0
  );

export function summarizeFrameIntervals(
  intervals: readonly number[],
  hz: number
) {
  const { n, mean, median, p95, p99, max } = summarizeSamples(intervals);

  return {
    frames: n,
    meanMs: mean,
    p50Ms: median,
    p95Ms: p95,
    p99Ms: p99,
    maxMs: max,
    dropped60: droppedFrames(intervals, 60),
    droppedHz: droppedFrames(intervals, hz),
  };
}

export function summarizeEdits(
  samples: Record<'rec' | 'pic' | 'layout' | 'frame', number[]>
) {
  const rec = summarizeSamples(samples.rec);
  const layout = summarizeSamples(samples.layout);
  const frame = summarizeSamples(samples.frame);

  return {
    n: rec.n,
    recMedMs: rec.median,
    recP95Ms: rec.p95,
    picMedMs: summarizeSamples(samples.pic).median,
    layoutMedMs: layout.median,
    layoutP95Ms: layout.p95,
    frameMedMs: frame.median,
    frameP95Ms: frame.p95,
  };
}

type FrameStats = ReturnType<typeof summarizeFrameIntervals>;

export type BenchRunResult = PhaseTimes & {
  scenario: BenchScenario;
  run: number;
  status: 'ok' | 'invalid';
  reason?: string;
  /** `${width}x${height}` in pt. */
  vp: string;
  hz: number;
  t?: { readyMs: number; frameMs: number; otherMs: number };
  edit?: ReturnType<typeof summarizeEdits>;
  steps?: number;
  scrollRange?: number;
  ui: FrameStats;
  js: FrameStats;
  heap: { beforeMB: number; afterMB: number } | null;
};

type MetricReader = (run: BenchRunResult) => number | null | undefined;

const FRAME_METRICS: Record<string, MetricReader> = {
  uiP95Ms: (r) => r.ui.p95Ms,
  uiDropped60: (r) => r.ui.dropped60,
  uiDroppedHz: (r) => r.ui.droppedHz,
  jsP95Ms: (r) => r.js.p95Ms,
};

const SUMMARY_METRICS: Record<BenchScenario, Record<string, MetricReader>> = {
  initial: {
    readyMs: (r) => r.t?.readyMs,
    frameMs: (r) => r.t?.frameMs,
    recTotalMs: (r) => r.rec.totalMs,
    pictureMs: (r) => r.pic.ms,
  },
  scroll: FRAME_METRICS,
  playback: { ...FRAME_METRICS, overlayMeanMaxMs: (r) => r.ovl?.meanMaxMs },
  edit: {
    layoutMedMs: (r) => r.edit?.layoutMedMs,
    frameMedMs: (r) => r.edit?.frameMedMs,
    recMedMs: (r) => r.edit?.recMedMs,
  },
};

export function summarizeRuns(
  scenario: BenchScenario,
  runs: readonly BenchRunResult[]
) {
  const ok = runs.filter((run) => run.status === 'ok');
  const metrics: Record<string, { median: number; max: number }> = {};

  for (const [key, read] of Object.entries(SUMMARY_METRICS[scenario])) {
    const values = ok
      .map(read)
      .filter((value): value is number => typeof value === 'number');

    if (values.length > 0) {
      const { median, max } = summarizeSamples(values);
      metrics[key] = { median, max };
    }
  }

  return metrics;
}
