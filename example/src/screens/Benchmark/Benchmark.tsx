import { useFonts } from 'react-native-skia';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import type {
  ScoreItemStyleOverrides,
  ScorePlayheadState,
} from 'vexflow-native/renderer';

import bravuraFont from '../../../assets/fonts/Bravura.otf';
import { delay } from '../../benchmark/async';
import { emitBenchLine } from '../../benchmark/benchLog';
import {
  BENCH_DEFAULTS,
  BENCH_TIMING,
  parseBenchParams,
  type BenchConfig,
} from '../../benchmark/config';
import { Column, Screen, Text } from '../../components';
import type { ExampleStackParamList } from '../../navigation/ExampleStackParamList';
import BenchRendererHost, { createBenchHost } from './BenchRendererHost';
import { useBenchRunner } from './useBenchRunner';
import { useUiFrameLoop } from './useUiFrameLoop';

type BenchmarkProps = NativeStackScreenProps<
  ExampleStackParamList,
  'Benchmark'
>;

type Banner = { testID: string; text: string };

function transitionEnd(navigation: BenchmarkProps['navigation']) {
  return new Promise<void>((resolve) => {
    const off = navigation.addListener('transitionEnd', () => {
      off();
      resolve();
    });

    delay(BENCH_TIMING.transitionFallbackMs).then(() => {
      off();
      resolve();
    });
  });
}

const Benchmark: React.FC<BenchmarkProps> = ({ navigation, route }) => {
  const fontManager = useFonts({ Bravura: [bravuraFont] });
  const scrollOffset = useSharedValue(0);
  const playhead = useSharedValue<ScorePlayheadState | null>(null);
  const itemStyleOverrides = useSharedValue<ScoreItemStyleOverrides>({});
  const targets = useMemo(
    () => ({ scrollOffset, playhead, itemStyleOverrides }),
    [itemStyleOverrides, playhead, scrollOffset]
  );
  const [host] = useState(createBenchHost);
  const loop = useUiFrameLoop(targets);
  const { view, start, stop, isBusy, reject } = useBenchRunner({
    host,
    loop,
    navigation,
    targets,
  });
  const parsed = useMemo(() => parseBenchParams(route.params), [route.params]);
  const [config, setConfig] = useState<BenchConfig>(BENCH_DEFAULTS);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [autostart, setAutostart] = useState<BenchConfig | null>(null);

  useEffect(() => {
    const label = route.params?.label?.slice(0, 64);

    if (isBusy()) {
      setBanner({ testID: 'bench-busy', text: 'Busy: link ignored' });
      emitBenchLine({ type: 'rejected', reason: 'busy', label });
    } else if (!parsed.ok) {
      setBanner({
        testID: 'bench-param-error',
        text: parsed.errors.join('; '),
      });
      reject('bad-params');
      emitBenchLine({
        type: 'error',
        reason: 'bad-params',
        errors: parsed.errors,
        label,
      });
    } else {
      setBanner(
        parsed.warnings.length
          ? { testID: 'bench-param-warning', text: parsed.warnings.join('; ') }
          : null
      );
      setConfig(parsed.config);
      setAutostart(parsed.autostart ? parsed.config : null);
    }
  }, [isBusy, parsed, reject, route.params]);

  useEffect(() => {
    if (!autostart || !fontManager) {
      return;
    }

    let cancelled = false;

    transitionEnd(navigation)
      .then(() => delay(BENCH_TIMING.autostartIdleMs))
      .then(() => {
        if (!cancelled) {
          setAutostart(null);
          start(autostart);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [autostart, fontManager, navigation, start]);

  return (
    <Screen
      padding={0}
      safeAreaEdges={['left', 'right', 'bottom']}
      contentContainerStyle={styles.fill}
    >
      <Column gap={4} style={styles.header}>
        {__DEV__ ? (
          <Text testID="bench-dev-warning" style={styles.warning}>
            Debug build: timings are not representative
          </Text>
        ) : null}
        <Pressable
          testID={view.running ? 'bench-stop' : 'bench-run'}
          accessibilityRole="button"
          accessibilityState={{ disabled: !fontManager }}
          disabled={!fontManager}
          onPress={view.running ? stop : () => start(config)}
          style={styles.button}
        >
          <Text>{view.running ? 'Stop' : 'Run'}</Text>
        </Pressable>
      </Column>
      {view.running ? (
        fontManager ? (
          <BenchRendererHost
            host={host}
            fontManager={fontManager}
            {...targets}
          />
        ) : (
          <View style={styles.placeholder} />
        )
      ) : null}
      <ScrollView style={styles.fill} contentContainerStyle={styles.results}>
        {banner ? (
          <Text testID={banner.testID} style={[styles.line, styles.warning]}>
            {banner.text}
          </Text>
        ) : null}
        <Text testID="bench-status" style={styles.line}>
          {`bench-status: ${view.status}`}
        </Text>
        <Text testID="bench-env" style={styles.line}>
          {view.env}
        </Text>
        {view.summaries.map(({ testID, text }) => (
          <Text key={testID} testID={testID} style={styles.line}>
            {text}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
};

export default Benchmark;

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderColor: '#9ca3af',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  fill: {
    flex: 1,
  },
  header: {
    padding: 8,
  },
  line: {
    fontSize: 12,
    lineHeight: 16,
  },
  placeholder: {
    height: BENCH_TIMING.viewportHeight,
  },
  results: {
    gap: 4,
    padding: 8,
  },
  warning: {
    color: '#b45309',
  },
});
