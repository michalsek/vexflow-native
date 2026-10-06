import { Canvas, Fill, Picture, type SkPicture } from 'react-native-skia';
import { useCanvasRef, useFonts } from 'react-native-skia';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import bravuraFont from '../../../assets/fonts/Bravura.otf';
import { createRunToken, type RunToken } from '../../benchmark/async';
import { Screen, Text } from '../../components';
import { emptyPicture, runDiagnostics, swap, type Row } from './checks';

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
    <Screen scrollable contentContainerStyle={styles.screen}>
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
        <Text key={id} testID={`diag-check-${id}`} style={styles.row}>
          {`${id} ${s}: ${detail}`}
        </Text>
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
  screen: { gap: 4 },
  canvas: { width: 160, height: 48 },
  row: { fontSize: 11, lineHeight: 15 },
  rerun: { fontWeight: '600', paddingVertical: 8 },
});
