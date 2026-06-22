import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';

import {
  ScoreRenderer,
  type RendererType,
  type ScoreItemStyleOverrides,
} from 'vexflow-native/renderer';
import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Column, DropDown, Row, Screen } from '../components';
import { useColorScheme } from '../hooks/useColorScheme';
import {
  getScoreRendererColorScheme,
  SCORE_RENDERER_BACKGROUND,
} from './ScoreRendererColorScheme';
import { createSimpleRendererScore } from './SimpleRendererFixture';

type StyleMode = 'default' | 'color' | 'glow' | 'dash';

const DEFAULT_STYLE_MODE: StyleMode = 'color';

const RENDERER_OPTIONS: Array<{ label: string; value: RendererType }> = [
  { label: 'Document Even', value: 'documentEven' },
  { label: 'Document Auto', value: 'document' },
  { label: 'Infinite Score', value: 'infiniteScore' },
];

const STYLE_MODE_OPTIONS: Array<{ label: string; value: StyleMode }> = [
  { label: 'Color', value: 'color' },
  { label: 'Glow', value: 'glow' },
  { label: 'Dash', value: 'dash' },
  { label: 'Default', value: 'default' },
];

const STYLE_OVERRIDE_PRESETS: Record<StyleMode, ScoreItemStyleOverrides> = {
  default: {},
  color: {
    'top-s1-m1-v1-n2': {
      fillColor: '#16a34a',
      strokeColor: '#15803d',
    },
    'top-s1-m3-v1-c1': {
      fillColor: '#2563eb',
      strokeColor: '#1d4ed8',
    },
    'bottom-s1-m2-v1-c1': {
      fillColor: '#dc2626',
      strokeColor: '#991b1b',
    },
  },
  glow: {
    'top-s1-m1-v1-n4': {
      color: '#f59e0b',
      shadowColor: '#fbbf24',
      shadowBlur: 12,
    },
    'top-s1-m3-v1-c2': {
      color: '#a855f7',
      shadowColor: '#c084fc',
      shadowBlur: 14,
    },
    'bottom-s1-m1-v1-c1': {
      color: '#14b8a6',
      shadowColor: '#2dd4bf',
      shadowBlur: 12,
    },
  },
  dash: {
    'top-s1-m3-v1-c1': {
      strokeColor: '#2563eb',
      lineDash: [4, 2],
    },
    'top-s1-m4-v1-n2': {
      strokeColor: '#ef4444',
      lineDash: [5, 3],
    },
    'bottom-s1-m4-v1-n1': {
      strokeColor: '#16a34a',
      lineDash: [6, 3],
    },
  },
};

const ScoreRendererStyleOverrides: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [rendererType, setRendererType] =
    useState<RendererType>('documentEven');
  const [styleMode, setStyleMode] = useState<StyleMode>(DEFAULT_STYLE_MODE);
  const [score] = useState(() => createSimpleRendererScore());
  const itemStyleOverrides = useSharedValue<ScoreItemStyleOverrides>(
    STYLE_OVERRIDE_PRESETS[DEFAULT_STYLE_MODE]
  );
  const scoreColorScheme = useMemo(
    () => getScoreRendererColorScheme(isDark),
    [isDark]
  );
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });

  const handleStyleModeChange = (value: StyleMode) => {
    setStyleMode(value);
    itemStyleOverrides.value = STYLE_OVERRIDE_PRESETS[value];
  };

  if (!fontManager) {
    return null;
  }

  return (
    <Screen
      safeAreaEdges={['left', 'right', 'bottom']}
      style={styles.container}
      padding={0}
    >
      <Column gap={12} style={styles.content}>
        <Row align="center" gap={12} wrap style={styles.header}>
          <View style={styles.control}>
            <DropDown
              options={STYLE_MODE_OPTIONS}
              value={styleMode}
              onChange={handleStyleModeChange}
            />
          </View>
          <View style={styles.control}>
            <DropDown
              options={RENDERER_OPTIONS}
              value={rendererType}
              onChange={setRendererType}
            />
          </View>
        </Row>

        <View
          style={[
            styles.viewportCard,
            isDark ? styles.viewportCardDark : styles.viewportCardLight,
          ]}
        >
          <ScoreRenderer
            score={score}
            defaultFont="Bravura"
            fontManager={fontManager}
            colorScheme={scoreColorScheme}
            itemStyleOverrides={itemStyleOverrides}
            rendererType={rendererType}
          />
        </View>
      </Column>
    </Screen>
  );
};

export default ScoreRendererStyleOverrides;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  control: {
    flex: 1,
    maxWidth: 240,
    minWidth: 180,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  viewportCard: {
    flex: 1,
    overflow: 'hidden',
  },
  viewportCardDark: {
    backgroundColor: SCORE_RENDERER_BACKGROUND.dark,
  },
  viewportCardLight: {
    backgroundColor: SCORE_RENDERER_BACKGROUND.light,
  },
});
