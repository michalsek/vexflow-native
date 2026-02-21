import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { VexflowCanvas, type VexflowCanvasDrawArgs } from 'vexflow-native';

import type { VisualCase } from './tests/types';
import { ACCIDENTAL_VISUAL_CASES } from './tests/accidentalVisualCases';
import { ANNOTATION_VISUAL_CASES } from './tests/annotationVisualCases';
import {
  Box,
  Column,
  DropDown,
  Heading,
  Row,
  Screen,
  Text,
} from './components';

const ALL_TESTS_VALUE = '__all_tests__';
const SUITE_ACCIDENTAL_VALUE = '__suite_accidental__';
const SUITE_ANNOTATION_VALUE = '__suite_annotation__';

import bravuraFont from '../assets/fonts/Bravura.otf';

type VisualCaseCardProps = {
  item: VisualCase;
  cardWidth: number;
};

const VisualCaseCard: React.FC<VisualCaseCardProps> = ({ item, cardWidth }) => {
  const handleDraw = useCallback(
    (args: VexflowCanvasDrawArgs) => {
      item.beforeDraw?.(args);
      item.draw(args);
    },
    [item]
  );

  return (
    <View style={[styles.caseCard, { width: cardWidth }]}>
      <Text style={styles.caseTitle}>{item.title}</Text>
      {item.description ? (
        <Text variant="muted" style={styles.caseDescription}>
          {item.description}
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.canvasScrollContent}
        style={styles.canvasScrollView}
      >
        <View style={styles.canvasContainer}>
          <VexflowCanvas
            onDraw={handleDraw}
            font={bravuraFont}
            width={item.canvasWidth}
            height={item.canvasHeight}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const App: React.FC = () => {
  const { width } = useWindowDimensions();

  const cardWidth = Math.max(280, Math.floor(width) - 40);

  const accidentalCases = useMemo(() => [...ACCIDENTAL_VISUAL_CASES], []);
  const annotationCases = useMemo(() => [...ANNOTATION_VISUAL_CASES], []);

  const visualCases = useMemo(
    () => [...accidentalCases, ...annotationCases],
    [accidentalCases, annotationCases]
  );

  const [selectedFilter, setSelectedFilter] = useState<string>(ALL_TESTS_VALUE);

  const filteredVisualCases = useMemo(() => {
    if (selectedFilter === ALL_TESTS_VALUE) return visualCases;
    if (selectedFilter === SUITE_ACCIDENTAL_VALUE) return accidentalCases;
    if (selectedFilter === SUITE_ANNOTATION_VALUE) return annotationCases;
    return visualCases.filter(
      (item) => `__case_${item.id}__` === selectedFilter
    );
  }, [accidentalCases, annotationCases, selectedFilter, visualCases]);

  const dropDownOptions = useMemo(
    () => [
      { value: ALL_TESTS_VALUE, label: 'All Tests' },
      { value: SUITE_ACCIDENTAL_VALUE, label: 'Accidentals Suite' },
      { value: SUITE_ANNOTATION_VALUE, label: 'Annotations Suite' },
      ...visualCases.map((item) => ({
        value: `__case_${item.id}__`,
        label: item.title,
      })),
    ],
    [visualCases]
  );

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <Column gap={8}>
        <Heading level={2}>Test Suite</Heading>
      </Column>
      <Row align="center" gap={10} style={styles.controlsRow}>
        <Box style={styles.dropDownContainer}>
          <DropDown
            value={selectedFilter}
            onChange={setSelectedFilter}
            options={dropDownOptions}
          />
        </Box>
      </Row>
      {filteredVisualCases.map((item) => (
        <VisualCaseCard key={item.id} item={item} cardWidth={cardWidth} />
      ))}
    </Screen>
  );
};

export default App;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
    alignItems: 'stretch',
  },
  controlsRow: {
    width: '100%',
  },
  dropDownContainer: {
    flex: 1,
  },
  caseCard: {
    gap: 4,
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  caseDescription: {
    fontSize: 12,
  },
  subtitleLight: {
    color: '#4b5563',
  },
  subtitleDark: {
    color: '#d1d5db',
  },
  canvasScrollContent: {
    alignItems: 'flex-start',
  },
  canvasScrollView: {
    width: '100%',
  },
  canvasContainer: {
    overflow: 'hidden',
    borderRadius: 8,
  },
});
