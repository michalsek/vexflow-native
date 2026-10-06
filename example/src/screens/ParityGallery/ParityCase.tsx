import { useFonts } from 'react-native-skia';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScoreRenderer,
  type ScoreItemStyleOverrides,
  type ScoreItemsLayout,
  type ScorePlayheadState,
  type ScoreScrollGeometry,
} from 'vexflow-native/renderer';

import bravuraFont from '../../../assets/fonts/Bravura.otf';
import { waitFrames } from '../../benchmark/async';
import { PLAYBACK_HIGHLIGHT } from '../../benchmark/config';
import { loadFixture, type LoadedFixture } from '../../benchmark/fixtures';
import { buildPlaybackTimeline } from '../../benchmark/timeline';
import type { ExampleStackParamList } from '../../navigation/ExampleStackParamList';
import { getScoreRendererColorScheme } from '../ScoreRendererColorScheme';
import { STYLE_OVERRIDE_PRESETS } from '../styleOverridePresets';
import {
  PARITY_CASES,
  PARITY_SCHEMES,
  type ParityCaseSpec,
} from './parityCases';

type ParityCaseProps = NativeStackScreenProps<
  ExampleStackParamList,
  'ParityCase'
>;

const Status: React.FC<{ label: string }> = ({ label }) => (
  <Text testID="parity-status" style={styles.status}>
    {label}
  </Text>
);

const ParityCaseView: React.FC<{ spec: ParityCaseSpec; dark: boolean }> = ({
  spec,
  dark,
}) => {
  const fontManager = useFonts({ Bravura: [bravuraFont] });
  const [fixture, setFixture] = useState<LoadedFixture | 'error' | null>(null);
  const [ready, setReady] = useState(false);
  const scrollOffset = useSharedValue(0);
  const playhead = useSharedValue<ScorePlayheadState | null>(null);
  const overrides = useSharedValue<ScoreItemStyleOverrides>({});
  const colorScheme = useMemo(() => getScoreRendererColorScheme(dark), [dark]);
  const seen = useRef({
    ready: false,
    frozen: false,
    geometry: null as ScoreScrollGeometry | null,
    layout: null as ScoreItemsLayout | null,
  });

  useEffect(() => {
    let live = true;

    loadFixture(spec.fixture).then(
      (loaded) => live && setFixture(loaded),
      () => live && setFixture('error')
    );

    return () => {
      live = false;
    };
  }, [spec.fixture]);

  const handlers = useMemo(() => {
    const freeze = () => {
      const { ready: isReady, frozen, geometry, layout } = seen.current;

      if (
        !isReady ||
        !geometry ||
        !layout ||
        frozen ||
        typeof fixture !== 'object' ||
        !fixture
      ) {
        return;
      }

      const block = layout.measures.find(
        (m) => m.measureIndex === spec.scrollTo
      );
      const start = (geometry.axis === 'vertical' ? block?.y : block?.x) ?? 0;
      const step = spec.playback
        ? buildPlaybackTimeline(fixture.score, layout).find(
            ({ measureIndex, onset }) =>
              measureIndex === spec.playback!.measure &&
              onset === spec.playback!.onset
          )
        : undefined;

      seen.current.frozen = true;
      scrollOffset.value = Math.min(start, geometry.maxScroll);
      if (step) {
        playhead.value = { x: step.x, y: step.y, height: step.height };
        overrides.value = Object.fromEntries(
          step.itemIds.map((id) => [id, PLAYBACK_HIGHLIGHT])
        );
      } else if (spec.preset) {
        overrides.value = STYLE_OVERRIDE_PRESETS[spec.preset];
      }
      waitFrames(3).then(() => setReady(true));
    };

    return {
      onReady: () => {
        seen.current.ready = true;
        freeze();
      },
      onScrollGeometry: (geometry: ScoreScrollGeometry) => {
        seen.current.geometry = geometry;
        freeze();
      },
      onItemsLayout: (layout: ScoreItemsLayout) => {
        seen.current.layout = layout;
        freeze();
      },
    };
  }, [fixture, overrides, playhead, scrollOffset, spec]);

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.container, { backgroundColor: colorScheme.background }]}
    >
      {fontManager && fixture && fixture !== 'error' ? (
        <ScoreRenderer
          score={fixture.score}
          defaultFont="Bravura"
          fontManager={fontManager}
          colorScheme={colorScheme}
          rendererType={spec.layout}
          scrollEnabled={false}
          scrollOffset={scrollOffset}
          playhead={spec.playback ? playhead : undefined}
          itemStyleOverrides={
            spec.playback || spec.preset ? overrides : undefined
          }
          {...handlers}
        />
      ) : null}
      <Status
        label={
          fixture === 'error'
            ? `parity-error:${spec.id}`
            : ready
            ? `parity-ready:${spec.id}:${dark ? 'dark' : 'light'}`
            : `parity-loading:${spec.id}`
        }
      />
    </SafeAreaView>
  );
};

const ParityCase: React.FC<ParityCaseProps> = ({ route }) => {
  const { case: id, scheme = 'light' } = route.params;
  const spec = PARITY_CASES.find((c) => c.id === id);

  if (!spec || !PARITY_SCHEMES.some((s) => s === scheme)) {
    return <Status label={`parity-error:${id}`} />;
  }

  return (
    <ParityCaseView
      key={`${id}:${scheme}`}
      spec={spec}
      dark={scheme === 'dark'}
    />
  );
};

export default ParityCase;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  status: {
    bottom: 4,
    color: '#9ca3af',
    fontSize: 9,
    left: 4,
    position: 'absolute',
  },
});
