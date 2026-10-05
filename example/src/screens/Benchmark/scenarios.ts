import {
  delay,
  waitFrames,
  type JsFrameSampler,
  type RunToken,
} from '../../benchmark/async';
import type { BenchLine } from '../../benchmark/benchLog';
import {
  BENCH_TIMING as T,
  type BenchConfig,
  type BenchScenario,
} from '../../benchmark/config';
import type { LoadedFixture } from '../../benchmark/fixtures';
import {
  applySingleNoteEdit,
  getEditTarget,
} from '../../benchmark/fixtures/editScore';
import {
  collectPhaseTimes,
  type ProfileEntry,
} from '../../benchmark/profileLines';
import {
  detectRefreshHz,
  round1,
  summarizeEdits,
  type BenchRunResult,
} from '../../benchmark/stats';
import { buildPlaybackTimeline } from '../../benchmark/timeline';
import type { BenchHost } from './BenchRendererHost';
import type { FrameLoopTargets, UiFrameLoop } from './useUiFrameLoop';

type ScenarioContext = {
  scenario: BenchScenario;
  /** ≤ 0 for warmups. */
  run: number;
  config: BenchConfig;
  fixture: LoadedFixture;
  sessionHz: number;
  host: BenchHost;
  token: RunToken;
  loop: UiFrameLoop;
  scrollOffset: FrameLoopTargets['scrollOffset'];
  js: JsFrameSampler;
  profile: {
    mark: () => number;
    since: (mark: number) => ProfileEntry[];
  };
  emit: (line: BenchLine) => void;
};

type ScenarioOutcome = Omit<
  BenchRunResult,
  'scenario' | 'run' | 'status' | 'reason' | 'vp' | 'ui' | 'js' | 'heap'
> & {
  uiIntervals: number[];
  jsIntervals: number[];
  invalid?: string;
};

const phasesSince = (ctx: ScenarioContext, mark: number) =>
  collectPhaseTimes(ctx.profile.since(mark), ctx.fixture.score.id);

async function mount(ctx: ScenarioContext, withPlayback = false) {
  const ready = ctx.host.next('ready');
  const t0 = performance.now();

  ctx.host.mount({
    score: ctx.fixture.score,
    layout: ctx.config.layout,
    withPlayback,
  });

  const tReady = await ctx.token.race(ready, {
    ms: T.readyTimeoutMs,
    label: 'ready',
  });

  return { t0, tReady };
}

async function settle(ctx: ScenarioContext): Promise<number> {
  await ctx.token.race(waitFrames(2));
  const { intervals } = await ctx.token.race(
    ctx.loop.run({ mode: 'observe', durationMs: T.calibrateMs })
  );

  return detectRefreshHz(intervals);
}

const skipped = (ctx: ScenarioContext, invalid: string): ScenarioOutcome => ({
  ...phasesSince(ctx, ctx.profile.mark()),
  hz: ctx.sessionHz,
  uiIntervals: [],
  jsIntervals: [],
  invalid,
});

/** Samples UI and JS frames around `body`; the first JS frame lands before
 * it so a synchronous block inside shows up as one long interval. */
async function observeWhile<R>(ctx: ScenarioContext, body: () => Promise<R>) {
  const ui = ctx.loop.run({ mode: 'observe', durationMs: Infinity });
  ctx.js.start();
  await ctx.token.race(waitFrames(1));
  const result = await body();
  ctx.loop.stop();
  const { intervals } = await ctx.token.race(ui);

  return { result, uiIntervals: intervals, jsIntervals: ctx.js.stop() };
}

async function measureWindow(
  ctx: ScenarioContext,
  request: Parameters<UiFrameLoop['run']>[0]
) {
  const window = (phase: string) => {
    if (ctx.run > 0) {
      ctx.emit({ type: 'window', phase, scenario: ctx.scenario, run: ctx.run });
    }
  };

  window('start');
  const pending = ctx.loop.run(request);
  ctx.js.start();
  const result = await ctx.token.race(pending);
  const jsIntervals = ctx.js.stop();
  window('end');

  return { ...result, uiIntervals: result.intervals, jsIntervals };
}

async function initial(ctx: ScenarioContext): Promise<ScenarioOutcome> {
  const mark = ctx.profile.mark();
  const { result, ...frames } = await observeWhile(ctx, async () => {
    const { t0, tReady } = await mount(ctx);

    return { t0, tReady, tFrame: await ctx.token.race(waitFrames(2)) };
  });
  const phases = phasesSince(ctx, mark);
  const readyMs = result.tReady - result.t0;

  return {
    ...phases,
    ...frames,
    hz: ctx.sessionHz,
    t: {
      readyMs: round1(readyMs),
      frameMs: round1(result.tFrame - result.t0),
      otherMs: round1(readyMs - phases.rec.totalMs - phases.pic.ms),
    },
  };
}

async function scroll(ctx: ScenarioContext): Promise<ScenarioOutcome> {
  await mount(ctx);
  const hz = await settle(ctx);
  const maxScroll = ctx.host.geometry?.maxScroll ?? 0;

  if (maxScroll <= 0) {
    return skipped(ctx, 'no-scroll-range');
  }

  const mark = ctx.profile.mark();
  const frames = await measureWindow(ctx, {
    mode: 'scroll',
    durationMs: T.scrollDurationMs,
    velocity: T.scrollVelocity,
    maxScroll,
  });
  const phases = phasesSince(ctx, mark);

  return {
    ...phases,
    hz,
    scrollRange: round1(maxScroll),
    uiIntervals: frames.uiIntervals,
    jsIntervals: frames.jsIntervals,
    invalid: phases.rec.n > 0 ? 'unexpected-recordings' : undefined,
  };
}

async function playback(ctx: ScenarioContext): Promise<ScenarioOutcome> {
  await mount(ctx, true);
  const steps = buildPlaybackTimeline(ctx.fixture.score, ctx.host.itemsLayout!);

  if (steps.length === 0) {
    return skipped(ctx, 'no-steps');
  }

  const hz = await settle(ctx);
  const geometry = ctx.host.geometry!;
  const vertical = geometry.axis === 'vertical';
  const mark = ctx.profile.mark();
  const frames = await measureWindow(ctx, {
    mode: 'playback',
    durationMs: T.playbackDurationMs,
    stepsPerSec: T.playbackStepsPerSec,
    steps,
    vertical,
    viewportExtent: vertical
      ? geometry.viewportSize.height
      : geometry.viewportSize.width,
    maxScroll: geometry.maxScroll,
  });
  await ctx.token.race(delay(T.overlayFlushWaitMs));
  await ctx.token.race(waitFrames(2));
  const phases = phasesSince(ctx, mark);

  return {
    ...phases,
    hz,
    steps: frames.steps,
    uiIntervals: frames.uiIntervals,
    jsIntervals: frames.jsIntervals,
    invalid: phases.rec.n > 0 ? 'unexpected-recordings' : undefined,
  };
}

async function edit(ctx: ScenarioContext): Promise<ScenarioOutcome> {
  const base = ctx.fixture.score;
  const target = getEditTarget(base);
  await mount(ctx);

  if (!target) {
    return skipped(ctx, 'no-edit-target');
  }

  const block = ctx.host.itemsLayout?.measures.find(
    (measure) => measure.measureIndex === target.measureIndex
  );
  const geometry = ctx.host.geometry;
  ctx.scrollOffset.value = Math.min(
    (geometry?.axis === 'horizontal' ? block?.x : block?.y) ?? 0,
    geometry?.maxScroll ?? 0
  );
  const hz = await settle(ctx);
  const firstMark = ctx.profile.mark();
  const samples = {
    rec: [] as number[],
    pic: [] as number[],
    layout: [] as number[],
    frame: [] as number[],
  };
  const frames = await observeWhile(ctx, async () => {
    for (let i = 0; i < T.editsPerRun; i += 1) {
      const next = applySingleNoteEdit(base, i);
      const mark = ctx.profile.mark();
      const layout = ctx.host.next('layout');
      const t0 = performance.now();

      ctx.host.setScore(next);
      const tLayout = await ctx.token.race(layout, {
        ms: T.layoutTimeoutMs,
        label: 'layout',
      });
      const tFrame = await ctx.token.race(waitFrames(2));
      const phases = phasesSince(ctx, mark);

      samples.rec.push(phases.rec.totalMs);
      samples.pic.push(phases.pic.ms);
      samples.layout.push(tLayout - t0);
      samples.frame.push(tFrame - t0);
      await ctx.token.race(delay(T.editGapMs));
    }
  });

  return {
    ...phasesSince(ctx, firstMark),
    hz,
    edit: summarizeEdits(samples),
    uiIntervals: frames.uiIntervals,
    jsIntervals: frames.jsIntervals,
  };
}

export const SCENARIOS: Record<
  BenchScenario,
  (ctx: ScenarioContext) => Promise<ScenarioOutcome>
> = { initial, scroll, playback, edit };
