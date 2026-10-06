import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import React, { memo, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ScoreRenderer,
  type ScoreItemsLayout,
  type ScoreScrollGeometry,
} from 'vexflow-native/renderer';
import type { Score } from 'vexflow-native/state';

import { deferred, type Deferred } from '../../benchmark/async';
import { BENCH_TIMING, type BenchConfig } from '../../benchmark/config';
import {
  getScoreRendererColorScheme,
  SCORE_RENDERER_BACKGROUND,
} from '../ScoreRendererColorScheme';
import type { FrameLoopTargets } from './useUiFrameLoop';

type MountSpec = {
  key: number;
  score: Score;
  layout: BenchConfig['layout'];
  withPlayback: boolean;
};

type HostEvent = 'ready' | 'layout';
type SetSpec = (update: (spec: MountSpec | null) => MountSpec | null) => void;

export type BenchHost = ReturnType<typeof createBenchHost>;

const COLOR_SCHEME = getScoreRendererColorScheme(false);

export const viewportOf = (geometry: ScoreScrollGeometry | null) =>
  geometry
    ? `${Math.round(geometry.viewportSize.width)}x${Math.round(
        geometry.viewportSize.height
      )}`
    : '0x0';

export function createBenchHost() {
  let waiters: Record<HostEvent, Deferred<number>[]> = {
    ready: [],
    layout: [],
  };
  let setSpec: SetSpec = () => {};
  let key = 0;
  const fire = (event: HostEvent) => {
    const now = performance.now();
    waiters[event].splice(0).forEach((waiter) => waiter.resolve(now));
  };

  const host = {
    geometry: null as ScoreScrollGeometry | null,
    readyViewport: null as string | null,
    itemsLayout: null as ScoreItemsLayout | null,
    mount: (spec: Omit<MountSpec, 'key'>) => {
      host.geometry = null;
      host.readyViewport = null;
      host.itemsLayout = null;
      key += 1;
      setSpec(() => ({ ...spec, key }));
    },
    unmount: () => {
      waiters = { ready: [], layout: [] };
      setSpec(() => null);
    },
    setScore: (score: Score) => setSpec((spec) => spec && { ...spec, score }),
    /** Resolves with performance.now() at the next event of that kind. */
    next: (event: HostEvent) => {
      const waiter = deferred<number>();
      waiters[event].push(waiter);

      return waiter.promise;
    },
    bind: (next: SetSpec) => {
      setSpec = next;
    },
    onReady: () => {
      host.readyViewport = viewportOf(host.geometry);
      fire('ready');
    },
    onItemsLayout: (layout: ScoreItemsLayout) => {
      host.itemsLayout = layout;
      fire('layout');
    },
    onScrollGeometry: (geometry: ScoreScrollGeometry) => {
      host.geometry = geometry;
    },
  };

  return host;
}

type BenchRendererHostProps = FrameLoopTargets & {
  host: BenchHost;
  fontManager: SkTypefaceFontProvider;
};

const BenchRendererHost: React.FC<BenchRendererHostProps> = ({
  host,
  fontManager,
  scrollOffset,
  playhead,
  itemStyleOverrides,
}) => {
  const [spec, setSpec] = useState<MountSpec | null>(null);

  useLayoutEffect(() => host.bind(setSpec), [host]);

  return (
    <View style={styles.host}>
      {spec ? (
        <ScoreRenderer
          key={spec.key}
          score={spec.score}
          defaultFont="Bravura"
          fontManager={fontManager}
          colorScheme={COLOR_SCHEME}
          rendererType={spec.layout}
          scrollEnabled={false}
          scrollOffset={scrollOffset}
          playhead={spec.withPlayback ? playhead : undefined}
          itemStyleOverrides={
            spec.withPlayback ? itemStyleOverrides : undefined
          }
          onReady={host.onReady}
          onItemsLayout={host.onItemsLayout}
          onScrollGeometry={host.onScrollGeometry}
        />
      ) : null}
    </View>
  );
};

export default memo(BenchRendererHost);

const styles = StyleSheet.create({
  host: {
    backgroundColor: SCORE_RENDERER_BACKGROUND.light,
    height: BENCH_TIMING.viewportHeight,
    overflow: 'hidden',
  },
});
