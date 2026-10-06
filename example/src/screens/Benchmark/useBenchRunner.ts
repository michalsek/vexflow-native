import skiaPackage from 'react-native-skia/package.json';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Appearance,
  Dimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import reanimatedPackage from 'react-native-reanimated/package.json';
import {
  isVexflowNativeDebugEnabled,
  setVexflowNativeDebugEnabled,
} from 'vexflow-native';

import {
  abortReason,
  createJsFrameSampler,
  createRunToken,
  delay,
  waitFrames,
  type RunToken,
} from '../../benchmark/async';
import {
  emitBenchLine,
  setProfileSink,
  type BenchLine,
} from '../../benchmark/benchLog';
import {
  BENCH_SCENARIOS,
  BENCH_TIMING,
  type BenchConfig,
} from '../../benchmark/config';
import { loadFixture } from '../../benchmark/fixtures';
import type { ProfileEntry } from '../../benchmark/profileLines';
import {
  detectRefreshHz,
  round1,
  summarizeFrameIntervals,
  summarizeRuns,
  type BenchRunResult,
} from '../../benchmark/stats';
import { viewportOf, type BenchHost } from './BenchRendererHost';
import { SCENARIOS } from './scenarios';
import type { FrameLoopTargets, UiFrameLoop } from './useUiFrameLoop';

type BenchView = {
  running: boolean;
  status: string;
  env: string;
  summaries: { testID: string; text: string }[];
};

type NavigationEvents = {
  addListener: (event: 'blur' | 'beforeRemove', cb: () => void) => () => void;
};

function readEnvironment() {
  const rn =
    Platform.OS === 'web' ? undefined : Platform.constants.reactNativeVersion;
  const window = Dimensions.get('window');

  return {
    platform: Platform.OS,
    os: String(Platform.Version),
    build: __DEV__ ? 'debug' : 'release',
    hermes: 'HermesInternal' in globalThis,
    rn: rn ? `${rn.major}.${rn.minor}.${rn.patch}` : 'web',
    skia: skiaPackage.version,
    reanimated: reanimatedPackage.version,
    pixelRatio: PixelRatio.get(),
    window: `${Math.round(window.width)}x${Math.round(window.height)}`,
  };
}

/** Live (allocated) Hermes JS heap in MB; null off Hermes. */
function readJsHeapMB(): number | null {
  const bytes = (
    globalThis as {
      HermesInternal?: { getInstrumentedStats?: () => Record<string, unknown> };
    }
  ).HermesInternal?.getInstrumentedStats?.().js_allocatedBytes;

  return typeof bytes === 'number' ? round1(bytes / 1048576) : null;
}

function beginProfileCapture() {
  const entries: ProfileEntry[] = [];
  const wasEnabled = isVexflowNativeDebugEnabled();
  setVexflowNativeDebugEnabled(true);
  const detach = setProfileSink((entry) => entries.push(entry));

  return {
    mark: () => entries.length,
    since: (mark: number) => entries.slice(mark),
    end: () => {
      detach();
      setVexflowNativeDebugEnabled(wasEnabled);
    },
  };
}

export function useBenchRunner({
  host,
  loop,
  navigation,
  targets,
}: {
  host: BenchHost;
  loop: UiFrameLoop;
  navigation: NavigationEvents;
  targets: FrameLoopTargets;
}) {
  const [view, setView] = useState<BenchView>({
    running: false,
    status: 'idle',
    env: 'env: -',
    summaries: [],
  });
  const busy = useRef(false);
  const stoppable = useRef(false);
  const schemeChanged = useRef(false);
  const tokenRef = useRef<RunToken | null>(null);
  const abort = useCallback(
    (reason: string) => tokenRef.current?.abort(reason),
    []
  );

  useEffect(() => {
    const unsubscribe = [
      navigation.addListener('beforeRemove', () => abort('unmount')),
      navigation.addListener('blur', () => abort('blur')),
    ];
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        abort('background');
      }
    });

    const appearance = Appearance.addChangeListener(() => {
      schemeChanged.current = true;
    });

    return () => {
      unsubscribe.forEach((off) => off());
      appState.remove();
      appearance.remove();
      abort('unmount');
    };
  }, [abort, navigation]);

  const start = useCallback(
    async (config: BenchConfig) => {
      if (busy.current) {
        return;
      }

      busy.current = true;
      const token = createRunToken();
      tokenRef.current = token;
      const tag = { sid: Date.now().toString(36), label: config.label };
      const emit = (line: BenchLine) => emitBenchLine({ ...line, ...tag });
      const js = createJsFrameSampler();
      let profile: ReturnType<typeof beginProfileCapture> | undefined;
      const setStatus = (status: string) =>
        setView((current) => ({ ...current, status }));

      setView({
        running: true,
        status: 'preparing',
        env: 'env: -',
        summaries: [],
      });

      stoppable.current = false;

      try {
        const capture = beginProfileCapture();
        const env = readEnvironment();
        profile = capture;
        emit({ type: 'session', ...env });
        const calibration = await token.race(
          loop.run({ mode: 'observe', durationMs: BENCH_TIMING.calibrateMs })
        );
        stoppable.current = true;
        const sessionHz = detectRefreshHz(calibration.intervals);
        const scenarios =
          config.scenario === 'all' ? BENCH_SCENARIOS : [config.scenario];

        for (const scenario of scenarios) {
          const fixture = await token.race(loadFixture(config.fixture));
          const results: BenchRunResult[] = [];

          for (let i = 0; i < config.warmup + config.runs; i += 1) {
            const run = i - config.warmup + 1;

            targets.scrollOffset.value = 0;
            targets.playhead.value = null;
            targets.itemStyleOverrides.value = {};
            setStatus(
              run > 0
                ? `running ${scenario} ${run}/${config.runs}`
                : `running ${scenario} warmup ${i + 1}/${config.warmup}`
            );
            await token.race(delay(BENCH_TIMING.cooldownMs));

            schemeChanged.current = false;
            const heapBefore = readJsHeapMB();
            const { uiIntervals, jsIntervals, invalid, ...outcome } =
              await SCENARIOS[scenario]({
                scenario,
                run,
                config,
                fixture,
                sessionHz,
                host,
                token,
                loop,
                scrollOffset: targets.scrollOffset,
                js,
                profile: capture,
                emit,
              });
            const heapAfter = readJsHeapMB();
            const vp = viewportOf(host.geometry);
            const reason =
              vp !== host.readyViewport
                ? 'viewport-changed'
                : schemeChanged.current
                ? 'scheme-changed'
                : invalid;

            host.unmount();
            await token.race(waitFrames(1));

            if (run <= 0) {
              continue;
            }

            const result: BenchRunResult = {
              scenario,
              run,
              status: reason ? 'invalid' : 'ok',
              reason,
              vp,
              ...outcome,
              ui: summarizeFrameIntervals(uiIntervals, outcome.hz),
              js: summarizeFrameIntervals(jsIntervals, outcome.hz),
              heap:
                heapBefore === null || heapAfter === null
                  ? null
                  : { beforeMB: heapBefore, afterMB: heapAfter },
            };

            emit({
              type: 'run',
              fixture: config.fixture,
              layout: config.layout,
              runs: config.runs,
              ...result,
            });
            results.push(result);
            setView((current) => ({
              ...current,
              env: `env: ${env.platform} ${env.os} ${env.build} skia ${env.skia} hz ${result.hz} viewport ${vp}`,
            }));
          }

          const metrics = summarizeRuns(scenario, results);
          emit({
            type: 'summary',
            scenario,
            fixture: config.fixture,
            layout: config.layout,
            buildMs: fixture.buildMs,
            okRuns: results.filter((r) => r.status === 'ok').length,
            runs: config.runs,
            metrics,
          });
          setView((current) => ({
            ...current,
            summaries: [
              ...current.summaries,
              ...Object.entries(metrics).map(([metric, { median, max }]) => {
                const unit = metric.endsWith('Ms') ? ' ms' : '';

                return {
                  testID: `bench-summary-${scenario}-${metric}`,
                  text: `${scenario} ${metric} ${median}${unit} (max ${max}${unit})`,
                };
              }),
            ],
          }));
        }

        emit({ type: 'done' });
        setStatus('done');
      } catch (error) {
        const aborted = abortReason(error);
        const reason = (
          aborted ?? (error instanceof Error ? error.message : String(error))
        ).slice(0, 200);

        emit({ type: aborted ? 'aborted' : 'error', reason });
        setStatus(`${aborted ? 'aborted' : 'error'} (${reason})`);
      } finally {
        loop.stop();
        js.stop();
        profile?.end();
        host.unmount();
        busy.current = false;
        tokenRef.current = null;
        setView((current) => ({ ...current, running: false }));
      }
    },
    [host, loop, targets]
  );

  const isBusy = useCallback(() => busy.current, []);
  const reject = useCallback(
    (reason: string) =>
      setView((current) => ({
        ...current,
        status: `error (${reason})`,
        summaries: [],
      })),
    []
  );
  const stop = useCallback(() => {
    if (stoppable.current) {
      abort('stop');
    }
  }, [abort]);

  return { view, start, stop, isBusy, reject };
}
