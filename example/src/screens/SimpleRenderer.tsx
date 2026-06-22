import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';

import { ScoreRenderer } from 'vexflow-native/renderer';
import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Column, DropDown, Row, Screen } from '../components';
import { useColorScheme } from '../hooks/useColorScheme';
import {
  getScoreRendererColorScheme,
  SCORE_RENDERER_BACKGROUND,
} from './ScoreRendererColorScheme';
import { createSimpleRendererScore } from './SimpleRendererFixture';

type RendererMode = 'documentEven' | 'document' | 'infiniteScore';

const RENDERER_OPTIONS = [
  { label: 'Document Even', value: 'documentEven' as const },
  { label: 'Document Auto', value: 'document' as const },
  { label: 'Infinite Score', value: 'infiniteScore' as const },
];

const SimpleRenderer: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [rendererType, setRendererType] =
    useState<RendererMode>('documentEven');
  const [score] = useState(() => createSimpleRendererScore());
  const scoreColorScheme = useMemo(
    () => getScoreRendererColorScheme(isDark),
    [isDark]
  );
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });

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
        <Row
          align="center"
          justify="space-between"
          gap={12}
          style={styles.header}
        >
          <View style={styles.modeControl}>
            <DropDown
              options={RENDERER_OPTIONS}
              value={rendererType}
              onChange={(value) => setRendererType(value as RendererMode)}
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
            rendererType={rendererType}
          />
        </View>
      </Column>
    </Screen>
  );
};

export default SimpleRenderer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  modeControl: {
    flex: 1,
    maxWidth: 240,
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
