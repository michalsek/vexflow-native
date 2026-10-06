import { Canvas, Fill, Picture, type SkPicture } from 'react-native-skia';
import { useCanvasRef, useFonts } from 'react-native-skia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import bravuraFont from '../../../assets/fonts/Bravura.otf';
import { createRunToken, type RunToken } from '../../benchmark/async';
import { Column, Screen, Text } from '../../components';
import { emptyPicture, runDiagnostics, swap, type Row } from './checks';

const TITLES: Record<string, string> = {
  'C1+C2': 'Font provider and SkFont on the UI runtime',
  'C3': 'Text measurement, UI vs JS',
  'X1': 'JS FontManager captured by a worklet',
  'C4': 'UI-recorded SkPicture drawn by the canvas',
  'C5': 'SkPicture disposed on the UI runtime',
  'W1': 'Text measurement, worker runtime vs JS',
};

function Diagnostics() {
  const provider = useFonts({ Bravura: [bravuraFont] });
  const empty = emptyPicture();
  const shown = useSharedValue<SkPicture>(empty);
  const canvasRef = useCanvasRef();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('idle');
  const token = useRef<RunToken | null>(null);
  const busy = status === 'running';

  const run = useCallback(async () => {
    if (token.current || !provider) {
      return;
    }
    const current = (token.current = createRunToken());

    setRows([]);
    setStatus('running');
    const final = await runDiagnostics({
      provider,
      slots: { shown, empty },
      token: current,
      snapshot: () => canvasRef.current!.makeImageSnapshotAsync(),
      onRow: setRows,
    });
    if (token.current === current) {
      token.current = null;
    }
    setStatus(final);
  }, [canvasRef, empty, provider, shown]);

  useEffect(() => {
    run();
  }, [run]);

  useEffect(
    () => () => {
      token.current?.abort('unmount');
      scheduleOnUI(swap, { shown, empty });
    },
    [empty, shown]
  );

  const count = (s: Row['status']) => rows.filter((r) => r.status === s).length;

  return (
    <Screen
      scrollable
      safeAreaEdges={['left', 'right', 'bottom']}
      contentContainerStyle={styles.screen}
    >
      <Text testID="diag-status">{status}</Text>
      <Text testID="diag-summary">
        {`works ${count('works')} · broken ${count('broken')} · info ${count(
          'info'
        )}`}
      </Text>
      <Canvas ref={canvasRef} testID="diag-canvas" style={styles.canvas}>
        <Fill color="white" />
        <Picture picture={shown} />
      </Canvas>
      {rows.map(({ id, status: s, detail }) => (
        <Column key={id} gap={2}>
          <Text style={styles.title}>{TITLES[id] ?? id}</Text>
          <Text testID={`diag-check-${id}`} style={styles.row}>
            {`${id} ${s}: ${detail}`}
          </Text>
        </Column>
      ))}
      <Pressable
        testID="diag-rerun"
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={run}
      >
        <Text style={styles.rerun}>Rerun</Text>
      </Pressable>
    </Screen>
  );
}

export default function WorkletDiagnostics() {
  return Platform.OS === 'web' ? <Text>Native only</Text> : <Diagnostics />;
}

const styles = StyleSheet.create({
  screen: { gap: 8 },
  canvas: { width: 160, height: 48 },
  title: { fontWeight: '600' },
  row: { fontSize: 12, lineHeight: 16 },
  rerun: { fontWeight: '600', paddingVertical: 8 },
});
