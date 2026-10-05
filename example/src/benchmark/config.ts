import type { ScoreItemStyleOverride } from 'vexflow-native/renderer';

export const BENCH_SCENARIOS = [
  'initial',
  'scroll',
  'playback',
  'edit',
] as const;
const FIXTURES = ['long', 'short', 'musicxml'] as const;
const LAYOUTS = ['document', 'documentEven', 'infiniteScore'] as const;

export type BenchScenario = (typeof BENCH_SCENARIOS)[number];
export type BenchFixtureId = (typeof FIXTURES)[number];

export type BenchConfig = {
  scenario: BenchScenario | 'all';
  fixture: BenchFixtureId;
  layout: (typeof LAYOUTS)[number];
  runs: number;
  warmup: number;
  /** Echoed in every log line; `[\w.-]{1,64}`. */
  label?: string;
};

export const BENCH_DEFAULTS: BenchConfig = {
  scenario: 'initial',
  fixture: 'long',
  layout: 'document',
  runs: 3,
  warmup: 1,
};

export const BENCH_TIMING = {
  viewportHeight: 480,
  cooldownMs: 750,
  calibrateMs: 500,
  readyTimeoutMs: 60000,
  layoutTimeoutMs: 20000,
  scrollDurationMs: 6000,
  /** pt/s */
  scrollVelocity: 1200,
  playbackDurationMs: 6000,
  playbackStepsPerSec: 8,
  editsPerRun: 10,
  editGapMs: 300,
  overlayFlushWaitMs: 150,
  transitionFallbackMs: 600,
  autostartIdleMs: 1000,
} as const;

export const PLAYBACK_HIGHLIGHT: ScoreItemStyleOverride = {
  fillColor: '#3b82f6',
  strokeColor: '#3b82f6',
  shadowColor: '#93c5fd',
  shadowBlur: 10,
};

const ENUMS: Record<string, readonly string[]> = {
  scenario: [...BENCH_SCENARIOS, 'all'],
  fixture: FIXTURES,
  layout: LAYOUTS,
};
const RANGES: Record<string, readonly [number, number]> = {
  runs: [1, 20],
  warmup: [0, 3],
};
const LABEL_PATTERN = /^[\w.-]{1,64}$/;

export function parseBenchParams(
  params: Record<string, string | undefined> | undefined
) {
  const config: BenchConfig = { ...BENCH_DEFAULTS };
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) {
      continue;
    }

    const got = `got ${JSON.stringify(value.slice(0, 32))}`;
    const allowed = Object.hasOwn(ENUMS, key) ? ENUMS[key]! : null;
    const range = Object.hasOwn(RANGES, key) ? RANGES[key]! : null;
    const n = /^\d+$/.test(value) ? Number(value) : NaN;

    if (allowed) {
      if (allowed.includes(value)) {
        Object.assign(config, { [key]: value });
      } else {
        errors.push(`${key}: expected ${allowed.join('|')}, ${got}`);
      }
    } else if (range) {
      if (n >= range[0] && n <= range[1]) {
        Object.assign(config, { [key]: n });
      } else {
        errors.push(`${key}: expected an integer ${range.join('..')}, ${got}`);
      }
    } else if (key === 'label') {
      if (LABEL_PATTERN.test(value)) {
        config.label = value;
      } else {
        errors.push(`label: expected ${LABEL_PATTERN.source}`);
      }
    } else {
      warnings.push(`unknown param "${key}"`);
    }
  }

  return errors.length > 0
    ? ({ ok: false, errors, warnings } as const)
    : ({
        ok: true,
        config,
        autostart: params?.scenario !== undefined,
        warnings,
      } as const);
}
