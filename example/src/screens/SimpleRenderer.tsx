import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  StyleSheet,
  type LayoutChangeEvent,
  View,
} from 'react-native';
import { useFonts } from '@shopify/react-native-skia';

import { ScoreRenderer } from 'vexflow-native/renderer';
import type {
  Accidental,
  Chord,
  Duration,
  Measure,
  Note,
  Pitch,
  Score,
  Voice,
  VoiceItem,
} from 'vexflow-native/state';

import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Column, DropDown, Row, Screen, Text } from '../components';

type RendererMode = 'documentEven' | 'infiniteScore';
type ScrollOffset = { x: number; y: number };
type RendererSize = { width: number; height: number };
type ScrollbarAxis = 'horizontal' | 'vertical';

const RENDERER_OPTIONS = [
  { label: 'Document Even', value: 'documentEven' as const },
  { label: 'Document Auto', value: 'document' as const },
  { label: 'Infinite Score', value: 'infiniteScore' as const },
];
const EMPTY_SIZE: RendererSize = { width: 0, height: 0 };
const EMPTY_OFFSET: ScrollOffset = { x: 0, y: 0 };

// This file is exempt from the max lines rule
const SimpleRenderer: React.FC = () => {
  const [rendererType, setRendererType] =
    useState<RendererMode>('documentEven');
  const [scrollOffset, setScrollOffset] = useState<ScrollOffset>(EMPTY_OFFSET);
  const [viewportSize, setViewportSize] = useState<RendererSize>(EMPTY_SIZE);
  const [contentSize, setContentSize] = useState<RendererSize>(EMPTY_SIZE);
  const [score] = useState<Score>(() => getInitialScore());
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });

  const maxScroll = useMemo(
    () => ({
      x: Math.max(0, contentSize.width - viewportSize.width),
      y: Math.max(0, contentSize.height - viewportSize.height),
    }),
    [contentSize, viewportSize]
  );
  const maxScrollX = maxScroll.x;
  const maxScrollY = maxScroll.y;

  useEffect(() => {
    setScrollOffset((previousOffset) => {
      const nextOffset = {
        x: clampOffset(previousOffset.x, maxScrollX),
        y: clampOffset(previousOffset.y, maxScrollY),
      };

      return nextOffset.x === previousOffset.x &&
        nextOffset.y === previousOffset.y
        ? previousOffset
        : nextOffset;
    });
  }, [maxScrollX, maxScrollY, rendererType]);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const nextSize = {
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    };

    setViewportSize((previousSize) =>
      previousSize.width === nextSize.width &&
      previousSize.height === nextSize.height
        ? previousSize
        : nextSize
    );
  }, []);

  const handleContentSizeChange = useCallback((nextSize: RendererSize) => {
    setContentSize((previousSize) =>
      previousSize.width === nextSize.width &&
      previousSize.height === nextSize.height
        ? previousSize
        : nextSize
    );
  }, []);

  const setHorizontalOffset = useCallback(
    (nextOffset: number) => {
      setScrollOffset((previousOffset) => {
        const clampedOffset = clampOffset(nextOffset, maxScrollX);

        return clampedOffset === previousOffset.x
          ? previousOffset
          : {
              ...previousOffset,
              x: clampedOffset,
            };
      });
    },
    [maxScrollX]
  );

  const setVerticalOffset = useCallback(
    (nextOffset: number) => {
      setScrollOffset((previousOffset) => {
        const clampedOffset = clampOffset(nextOffset, maxScrollY);

        return clampedOffset === previousOffset.y
          ? previousOffset
          : {
              ...previousOffset,
              y: clampedOffset,
            };
      });
    },
    [maxScrollY]
  );

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
          <Column align="flex-end" gap={2} style={styles.metrics}>
            <Text variant="muted" style={styles.metricText}>
              Viewport {Math.round(viewportSize.width)} x{' '}
              {Math.round(viewportSize.height)}
            </Text>
            <Text variant="muted" style={styles.metricText}>
              Content {Math.round(contentSize.width)} x{' '}
              {Math.round(contentSize.height)}
            </Text>
            <Text variant="muted" style={styles.metricText}>
              Offset {Math.round(scrollOffset.x)} x {Math.round(scrollOffset.y)}
            </Text>
          </Column>
        </Row>

        <View style={styles.viewportCard}>
          <View style={styles.viewport} onLayout={handleViewportLayout}>
            <ScoreRenderer
              score={score}
              defaultFont="Bravura"
              fontManager={fontManager}
              rendererType={rendererType}
              scrollOffset={scrollOffset}
              onContentSizeChange={handleContentSizeChange}
            />

            {maxScrollX > 0 ? (
              <DebugScrollbar
                axis="horizontal"
                viewportExtent={viewportSize.width}
                contentExtent={contentSize.width}
                offset={scrollOffset.x}
                onChange={setHorizontalOffset}
                style={styles.horizontalScrollbar}
              />
            ) : null}

            {maxScrollY > 0 ? (
              <DebugScrollbar
                axis="vertical"
                viewportExtent={viewportSize.height}
                contentExtent={contentSize.height}
                offset={scrollOffset.y}
                onChange={setVerticalOffset}
                style={styles.verticalScrollbar}
              />
            ) : null}
          </View>
        </View>
      </Column>
    </Screen>
  );
};

export default SimpleRenderer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
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
  metrics: {
    minWidth: 120,
  },
  metricText: {
    fontSize: 12,
  },
  viewportCard: {
    flex: 1,
    overflow: 'hidden',
  },
  viewport: {
    flex: 1,
    minHeight: 320,
    position: 'relative',
  },
  horizontalScrollbar: {
    left: 12,
    right: 12,
    bottom: 12,
    height: 6,
  },
  verticalScrollbar: {
    top: 4,
    bottom: 20,
    right: 2,
    width: 6,
  },
  scrollbarTrack: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
  },
  scrollbarThumb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
  },
  horizontalScrollbarThumb: {
    top: 0,
    bottom: 0,
  },
  verticalScrollbarThumb: {
    left: 0,
    right: 0,
  },
});

type DebugScrollbarProps = {
  axis: ScrollbarAxis;
  viewportExtent: number;
  contentExtent: number;
  offset: number;
  onChange: (offset: number) => void;
  style?: object;
};

const DebugScrollbar: React.FC<DebugScrollbarProps> = ({
  axis,
  viewportExtent,
  contentExtent,
  offset,
  onChange,
  style,
}) => {
  const [trackExtent, setTrackExtent] = useState(0);
  const dragStartThumbOffset = useRef(0);
  const thumbOffsetRef = useRef(0);
  const maxThumbOffsetRef = useRef(0);
  const maxScrollRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const maxScroll = Math.max(0, contentExtent - viewportExtent);
  const thumbExtent =
    trackExtent > 0
      ? Math.max(
          28,
          Math.min(
            trackExtent,
            (viewportExtent / Math.max(contentExtent, viewportExtent)) *
              trackExtent
          )
        )
      : 0;
  const maxThumbOffset = Math.max(0, trackExtent - thumbExtent);
  const thumbOffset =
    maxScroll > 0 && maxThumbOffset > 0
      ? (offset / maxScroll) * maxThumbOffset
      : 0;

  useEffect(() => {
    thumbOffsetRef.current = thumbOffset;
    maxThumbOffsetRef.current = maxThumbOffset;
    maxScrollRef.current = maxScroll;
    onChangeRef.current = onChange;
  }, [maxScroll, maxThumbOffset, onChange, thumbOffset]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartThumbOffset.current = thumbOffsetRef.current;
        },
        onPanResponderMove: (_event, gestureState) => {
          const delta =
            axis === 'horizontal' ? gestureState.dx : gestureState.dy;
          const nextThumbOffset = clampOffset(
            dragStartThumbOffset.current + delta,
            maxThumbOffsetRef.current
          );
          const nextOffset =
            maxThumbOffsetRef.current > 0
              ? (nextThumbOffset / maxThumbOffsetRef.current) *
                maxScrollRef.current
              : 0;

          onChangeRef.current(nextOffset);
        },
      }),
    [axis]
  );

  const handleTrackLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextTrackExtent =
        axis === 'horizontal'
          ? event.nativeEvent.layout.width
          : event.nativeEvent.layout.height;

      setTrackExtent((previousTrackExtent) =>
        previousTrackExtent === nextTrackExtent
          ? previousTrackExtent
          : nextTrackExtent
      );
    },
    [axis]
  );

  return (
    <View
      onLayout={handleTrackLayout}
      style={[styles.scrollbarTrack, style]}
      pointerEvents="box-none"
    >
      <View
        {...panResponder.panHandlers}
        style={[
          styles.scrollbarThumb,
          axis === 'horizontal'
            ? {
                ...styles.horizontalScrollbarThumb,
                left: thumbOffset,
                width: thumbExtent,
              }
            : {
                ...styles.verticalScrollbarThumb,
                top: thumbOffset,
                height: thumbExtent,
              },
        ]}
      />
    </View>
  );
};

function clampOffset(offset: number, maxOffset: number): number {
  return Math.min(Math.max(offset, 0), maxOffset);
}

function getInitialScore(): Score {
  return {
    id: 'simple-renderer-showcase',
    metadata: {
      title: 'Renderer Showcase Study',
      composer: 'vexflow-native examples',
    },
    defaultMeter: {
      beats: 4,
      beatUnit: 4,
    },
    defaultKeySignature: {
      tonic: 'C',
      mode: 'major',
    },
    staves: [
      {
        id: 'showcase-top-staff',
        order: 0,
        clef: 'treble',
        systemGroupId: 'showcase-piano',
        systemGroupRole: 'top',
        measures: createTopMeasures(),
      },
      {
        id: 'showcase-bottom-staff',
        order: 1,
        clef: 'bass',
        systemGroupId: 'showcase-piano',
        systemGroupRole: 'bottom',
        measures: createBottomMeasures(),
      },
    ],
  };
}

const COMMON_TIME: Measure['meter'] = {
  beats: 4,
  beatUnit: 4,
};

const COMPOUND_BEAM_METER: Measure['meter'] = {
  beats: 6,
  beatUnit: 8,
  beaming: [3, 3],
};

function createTopMeasures(): Measure[] {
  return [
    createMeasure(
      'top',
      1,
      1,
      [
        createVoice('top', 1, 1, 0, (voiceId) => [
          note(voiceId, 'top-s1-m1-v1-n1', 'C', 4, 'q'),
          note(voiceId, 'top-s1-m1-v1-n2', 'E', 4, 'q', { accidental: 'b' }),
          note(voiceId, 'top-s1-m1-v1-n3', 'E', 4, 'q', { accidental: 'n' }),
          note(voiceId, 'top-s1-m1-v1-n4', 'F', 4, 'q', { accidental: '#' }),
        ]),
      ],
      { directions: ['Accidentals'] }
    ),
    createMeasure('top', 1, 2, [
      createVoice('top', 1, 2, 0, (voiceId) => [
        note(voiceId, 'top-s1-m2-v1-n1', 'G', 4, 'q'),
        note(voiceId, 'top-s1-m2-v1-n2', 'A', 4, 'q', { accidental: 'b' }),
        note(voiceId, 'top-s1-m2-v1-n3', 'A', 4, 'q', { accidental: 'n' }),
        note(voiceId, 'top-s1-m2-v1-n4', 'B', 4, 'q', { accidental: 'b' }),
      ]),
    ]),
    createMeasure('top', 1, 3, [
      createVoice('top', 1, 3, 0, (voiceId) => [
        chord(
          voiceId,
          'top-s1-m3-v1-c1',
          [p('C', 4), p('E', 4, 'b'), p('G', 4)],
          'h'
        ),
        chord(
          voiceId,
          'top-s1-m3-v1-c2',
          [p('D', 4), p('F', 4, '#'), p('A', 4)],
          'h'
        ),
      ]),
    ]),
    createMeasure('top', 1, 4, [
      createVoice('top', 1, 4, 0, (voiceId) => [
        note(voiceId, 'top-s1-m4-v1-n1', 'B', 4, 'q', { accidental: 'n' }),
        note(voiceId, 'top-s1-m4-v1-n2', 'C', 5, 'q', { accidental: '#' }),
        note(voiceId, 'top-s1-m4-v1-n3', 'D', 5, 'q'),
        note(voiceId, 'top-s1-m4-v1-n4', 'E', 5, 'q', { accidental: 'b' }),
      ]),
    ]),
    createMeasure('top', 1, 5, [
      createVoice('top', 1, 5, 0, (voiceId) => [
        chord(
          voiceId,
          'top-s1-m5-v1-c1',
          [p('A', 3), p('C', 4, '#'), p('E', 4)],
          'h'
        ),
        note(voiceId, 'top-s1-m5-v1-n2', 'B', 4, 'q', { accidental: 'b' }),
        note(voiceId, 'top-s1-m5-v1-n3', 'A', 4, 'q', { accidental: 'n' }),
      ]),
    ]),
    createMeasure(
      'top',
      2,
      6,
      [
        createVoice('top', 2, 6, 0, (voiceId) => [
          note(voiceId, 'top-s2-m6-v1-n1', 'G', 4, 'h', { dots: 1 }),
          note(voiceId, 'top-s2-m6-v1-n2', 'C', 5, 'q'),
        ]),
      ],
      { directions: ['Dotted rhythms'] }
    ),
    createMeasure('top', 2, 7, [
      createVoice('top', 2, 7, 0, (voiceId) => [
        note(voiceId, 'top-s2-m7-v1-n1', 'A', 4, 'q', { dots: 1 }),
        note(voiceId, 'top-s2-m7-v1-n2', 'B', 4, '8'),
        note(voiceId, 'top-s2-m7-v1-n3', 'C', 5, 'q', { dots: 1 }),
        note(voiceId, 'top-s2-m7-v1-n4', 'D', 5, '8'),
        note(voiceId, 'top-s2-m7-v1-n5', 'E', 5, 'q'),
      ]),
    ]),
    createMeasure('top', 2, 8, [
      createVoice('top', 2, 8, 0, (voiceId) => [
        note(voiceId, 'top-s2-m8-v1-n1', 'E', 5, 'h', { dots: 1 }),
        note(voiceId, 'top-s2-m8-v1-n2', 'D', 5, 'q'),
      ]),
    ]),
    createMeasure('top', 2, 9, [
      createVoice('top', 2, 9, 0, (voiceId) => [
        note(voiceId, 'top-s2-m9-v1-n1', 'C', 5, 'q'),
        note(voiceId, 'top-s2-m9-v1-n2', 'B', 4, 'h', { dots: 1 }),
        note(voiceId, 'top-s2-m9-v1-n3', 'A', 4, 'q'),
      ]),
    ]),
    createMeasure('top', 2, 10, [
      createVoice('top', 2, 10, 0, (voiceId) => [
        note(voiceId, 'top-s2-m10-v1-n1', 'G', 4, 'q', { dots: 1 }),
        note(voiceId, 'top-s2-m10-v1-n2', 'A', 4, '8'),
        note(voiceId, 'top-s2-m10-v1-n3', 'B', 4, 'h'),
        note(voiceId, 'top-s2-m10-v1-n4', 'C', 5, 'q'),
      ]),
    ]),
    createMeasure(
      'top',
      3,
      11,
      [
        createVoice('top', 3, 11, 0, (voiceId) => [
          note(voiceId, 'top-s3-m11-v1-n1', 'C', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n2', 'D', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n3', 'E', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n4', 'F', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n5', 'G', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n6', 'A', 5, '8'),
        ]),
      ],
      { directions: ['Beams'], meter: COMPOUND_BEAM_METER }
    ),
    createMeasure('top', 3, 12, [
      createVoice('top', 3, 12, 0, (voiceId) => [
        note(voiceId, 'top-s3-m12-v1-n1', 'G', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n2', 'F', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n3', 'E', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n4', 'D', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n5', 'C', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n6', 'B', 4, '8'),
      ]),
    ]),
    createMeasure('top', 3, 13, [
      createVoice('top', 3, 13, 0, (voiceId) => [
        note(voiceId, 'top-s3-m13-v1-n1', 'A', 4, '8'),
        note(voiceId, 'top-s3-m13-v1-n2', 'B', 4, '8'),
        note(voiceId, 'top-s3-m13-v1-n3', 'C', 5, '8'),
        note(voiceId, 'top-s3-m13-v1-n4', 'D', 5, '8'),
        note(voiceId, 'top-s3-m13-v1-n5', 'E', 5, '8'),
        note(voiceId, 'top-s3-m13-v1-n6', 'F', 5, '8'),
      ]),
    ]),
    createMeasure('top', 3, 14, [
      createVoice('top', 3, 14, 0, (voiceId) => [
        note(voiceId, 'top-s3-m14-v1-n1', 'E', 5, '8'),
        note(voiceId, 'top-s3-m14-v1-n2', 'D', 5, '8'),
        note(voiceId, 'top-s3-m14-v1-n3', 'C', 5, '8'),
        note(voiceId, 'top-s3-m14-v1-n4', 'B', 4, '8'),
        note(voiceId, 'top-s3-m14-v1-n5', 'A', 4, '8'),
        note(voiceId, 'top-s3-m14-v1-n6', 'G', 4, '8'),
      ]),
    ]),
    createMeasure('top', 3, 15, [
      createVoice('top', 3, 15, 0, (voiceId) => [
        note(voiceId, 'top-s3-m15-v1-n1', 'C', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n2', 'E', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n3', 'G', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n4', 'A', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n5', 'G', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n6', 'E', 5, '8'),
      ]),
    ]),
    createMeasure(
      'top',
      4,
      16,
      [
        createVoice('top', 4, 16, 0, (voiceId) => [
          note(voiceId, 'top-s4-m16-v1-n1', 'C', 5, 'q', { lyric: 'Words' }),
          note(voiceId, 'top-s4-m16-v1-n2', 'D', 5, 'q', { lyric: 'drift' }),
          note(voiceId, 'top-s4-m16-v1-n3', 'E', 5, 'q', { lyric: 'through' }),
          note(voiceId, 'top-s4-m16-v1-n4', 'F', 5, 'q', { lyric: 'this' }),
        ]),
      ],
      { directions: ['Lyrics'], meter: COMMON_TIME }
    ),
    createMeasure('top', 4, 17, [
      createVoice('top', 4, 17, 0, (voiceId) => [
        note(voiceId, 'top-s4-m17-v1-n1', 'G', 5, 'q', { lyric: 'score' }),
        note(voiceId, 'top-s4-m17-v1-n2', 'A', 5, 'q', { lyric: 'with' }),
        note(voiceId, 'top-s4-m17-v1-n3', 'G', 5, 'q', { lyric: 'warm' }),
        note(voiceId, 'top-s4-m17-v1-n4', 'F', 5, 'q', { lyric: 'light' }),
      ]),
    ]),
    createMeasure('top', 4, 18, [
      createVoice('top', 4, 18, 0, (voiceId) => [
        note(voiceId, 'top-s4-m18-v1-n1', 'E', 5, 'q', { lyric: 'each' }),
        note(voiceId, 'top-s4-m18-v1-n2', 'D', 5, 'q', { lyric: 'bar' }),
        note(voiceId, 'top-s4-m18-v1-n3', 'C', 5, 'q', { lyric: 'now' }),
        note(voiceId, 'top-s4-m18-v1-n4', 'D', 5, 'q', { lyric: 'sings' }),
      ]),
    ]),
    createMeasure('top', 4, 19, [
      createVoice('top', 4, 19, 0, (voiceId) => [
        note(voiceId, 'top-s4-m19-v1-n1', 'E', 5, 'q', { lyric: 'one' }),
        note(voiceId, 'top-s4-m19-v1-n2', 'F', 5, 'q', { lyric: 'plain' }),
        note(voiceId, 'top-s4-m19-v1-n3', 'G', 5, 'q', { lyric: 'tune' }),
        note(voiceId, 'top-s4-m19-v1-n4', 'A', 5, 'q', { lyric: 'for' }),
      ]),
    ]),
    createMeasure('top', 4, 20, [
      createVoice('top', 4, 20, 0, (voiceId) => [
        note(voiceId, 'top-s4-m20-v1-n1', 'G', 5, 'q', { lyric: 'the' }),
        note(voiceId, 'top-s4-m20-v1-n2', 'F', 5, 'q', { lyric: 'page' }),
        note(voiceId, 'top-s4-m20-v1-n3', 'E', 5, 'q', { lyric: 'to' }),
        note(voiceId, 'top-s4-m20-v1-n4', 'D', 5, 'q', { lyric: 'hold' }),
      ]),
    ]),
    createMeasure(
      'top',
      5,
      21,
      [
        createVoice('top', 5, 21, 0, (voiceId) => [
          note(voiceId, 'top-s5-m21-v1-n1', 'E', 5, 'q', {
            stemDirection: 'up',
          }),
          note(voiceId, 'top-s5-m21-v1-n2', 'F', 5, 'q', {
            stemDirection: 'up',
          }),
          note(voiceId, 'top-s5-m21-v1-n3', 'G', 5, 'q', {
            stemDirection: 'up',
          }),
          note(voiceId, 'top-s5-m21-v1-n4', 'A', 5, 'q', {
            stemDirection: 'up',
          }),
        ]),
        createVoice('top', 5, 21, 1, (voiceId) => [
          note(voiceId, 'top-s5-m21-v2-n1', 'C', 4, 'h', {
            stemDirection: 'down',
          }),
          note(voiceId, 'top-s5-m21-v2-n2', 'D', 4, 'h', {
            stemDirection: 'down',
          }),
        ]),
      ],
      { directions: ['Two voices'] }
    ),
    createMeasure('top', 5, 22, [
      createVoice('top', 5, 22, 0, (voiceId) => [
        note(voiceId, 'top-s5-m22-v1-n1', 'G', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m22-v1-n2', 'F', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m22-v1-n3', 'E', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m22-v1-n4', 'D', 5, 'q', { stemDirection: 'up' }),
      ]),
      createVoice('top', 5, 22, 1, (voiceId) => [
        note(voiceId, 'top-s5-m22-v2-n1', 'B', 3, 'w', {
          stemDirection: 'down',
        }),
      ]),
    ]),
    createMeasure('top', 5, 23, [
      createVoice('top', 5, 23, 0, (voiceId) => [
        chord(
          voiceId,
          'top-s5-m23-v1-c1',
          [p('C', 5), p('E', 5), p('G', 5)],
          'h',
          { stemDirection: 'up' }
        ),
        note(voiceId, 'top-s5-m23-v1-n2', 'A', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m23-v1-n3', 'G', 5, 'q', { stemDirection: 'up' }),
      ]),
      createVoice('top', 5, 23, 1, (voiceId) => [
        note(voiceId, 'top-s5-m23-v2-n1', 'E', 4, 'w', {
          stemDirection: 'down',
        }),
      ]),
    ]),
    createMeasure('top', 5, 24, [
      createVoice('top', 5, 24, 0, (voiceId) => [
        note(voiceId, 'top-s5-m24-v1-n1', 'F', 5, 'q'),
        note(voiceId, 'top-s5-m24-v1-n2', 'E', 5, 'q'),
        note(voiceId, 'top-s5-m24-v1-n3', 'D', 5, 'q'),
        note(voiceId, 'top-s5-m24-v1-n4', 'C', 5, 'q'),
      ]),
    ]),
    createMeasure(
      'top',
      5,
      25,
      [
        createVoice('top', 5, 25, 0, (voiceId) => [
          chord(
            voiceId,
            'top-s5-m25-v1-c1',
            [p('C', 5), p('E', 5), p('G', 5)],
            'w'
          ),
        ]),
      ],
      { endBarline: 'final' }
    ),
  ];
}

function createBottomMeasures(): Measure[] {
  return [
    createMeasure(
      'bottom',
      1,
      1,
      [
        createVoice('bottom', 1, 1, 0, (voiceId) => [
          chord(voiceId, 'bottom-s1-m1-v1-c1', [p('C', 3), p('G', 3)], 'w'),
        ]),
      ],
      { directions: ['Accidentals'] }
    ),
    createMeasure('bottom', 1, 2, [
      createVoice('bottom', 1, 2, 0, (voiceId) => [
        chord(voiceId, 'bottom-s1-m2-v1-c1', [p('B', 2, 'b'), p('F', 3)], 'h'),
        chord(voiceId, 'bottom-s1-m2-v1-c2', [p('A', 2), p('E', 3)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 1, 3, [
      createVoice('bottom', 1, 3, 0, (voiceId) => [
        chord(
          voiceId,
          'bottom-s1-m3-v1-c1',
          [p('E', 3, 'b'), p('G', 3), p('B', 3, 'b')],
          'w'
        ),
      ]),
    ]),
    createMeasure('bottom', 1, 4, [
      createVoice('bottom', 1, 4, 0, (voiceId) => [
        note(voiceId, 'bottom-s1-m4-v1-n1', 'F', 2, 'h', { accidental: '#' }),
        note(voiceId, 'bottom-s1-m4-v1-n2', 'G', 2, 'h'),
      ]),
    ]),
    createMeasure('bottom', 1, 5, [
      createVoice('bottom', 1, 5, 0, (voiceId) => [
        chord(voiceId, 'bottom-s1-m5-v1-c1', [p('D', 3), p('A', 3)], 'w'),
      ]),
    ]),
    createMeasure(
      'bottom',
      2,
      6,
      [
        createVoice('bottom', 2, 6, 0, (voiceId) => [
          note(voiceId, 'bottom-s2-m6-v1-n1', 'C', 3, 'h', { dots: 1 }),
          note(voiceId, 'bottom-s2-m6-v1-n2', 'G', 2, 'q'),
        ]),
      ],
      { directions: ['Dotted rhythms'] }
    ),
    createMeasure('bottom', 2, 7, [
      createVoice('bottom', 2, 7, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m7-v1-n1', 'F', 2, 'h', { dots: 1 }),
        note(voiceId, 'bottom-s2-m7-v1-n2', 'C', 3, 'q'),
      ]),
    ]),
    createMeasure('bottom', 2, 8, [
      createVoice('bottom', 2, 8, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m8-v1-n1', 'A', 2, 'h', { dots: 1 }),
        note(voiceId, 'bottom-s2-m8-v1-n2', 'E', 3, 'q'),
      ]),
    ]),
    createMeasure('bottom', 2, 9, [
      createVoice('bottom', 2, 9, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m9-v1-n1', 'D', 3, 'q', { dots: 1 }),
        note(voiceId, 'bottom-s2-m9-v1-n2', 'E', 3, '8'),
        note(voiceId, 'bottom-s2-m9-v1-n3', 'A', 2, 'h'),
      ]),
    ]),
    createMeasure('bottom', 2, 10, [
      createVoice('bottom', 2, 10, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m10-v1-n1', 'G', 2, 'h', { dots: 1 }),
        note(voiceId, 'bottom-s2-m10-v1-n2', 'D', 3, 'q'),
      ]),
    ]),
    createMeasure(
      'bottom',
      3,
      11,
      [
        createVoice('bottom', 3, 11, 0, (voiceId) => [
          note(voiceId, 'bottom-s3-m11-v1-n1', 'C', 3, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n2', 'G', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n3', 'A', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n4', 'F', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n5', 'G', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n6', 'E', 2, '8'),
        ]),
      ],
      { directions: ['Beams'], meter: COMPOUND_BEAM_METER }
    ),
    createMeasure('bottom', 3, 12, [
      createVoice('bottom', 3, 12, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m12-v1-n1', 'F', 2, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n2', 'C', 3, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n3', 'D', 3, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n4', 'B', 2, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n5', 'C', 3, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n6', 'G', 2, '8'),
      ]),
    ]),
    createMeasure('bottom', 3, 13, [
      createVoice('bottom', 3, 13, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m13-v1-n1', 'A', 2, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n2', 'E', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n3', 'F', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n4', 'D', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n5', 'E', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n6', 'C', 3, '8'),
      ]),
    ]),
    createMeasure('bottom', 3, 14, [
      createVoice('bottom', 3, 14, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m14-v1-n1', 'D', 3, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n2', 'A', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n3', 'B', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n4', 'G', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n5', 'A', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n6', 'F', 2, '8'),
      ]),
    ]),
    createMeasure('bottom', 3, 15, [
      createVoice('bottom', 3, 15, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m15-v1-n1', 'C', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n2', 'G', 2, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n3', 'E', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n4', 'F', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n5', 'G', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n6', 'C', 3, '8'),
      ]),
    ]),
    createMeasure(
      'bottom',
      4,
      16,
      [
        createVoice('bottom', 4, 16, 0, (voiceId) => [
          chord(voiceId, 'bottom-s4-m16-v1-c1', [p('C', 3), p('G', 3)], 'h'),
          chord(voiceId, 'bottom-s4-m16-v1-c2', [p('F', 2), p('C', 3)], 'h'),
        ]),
      ],
      { directions: ['Lyrics'], meter: COMMON_TIME }
    ),
    createMeasure('bottom', 4, 17, [
      createVoice('bottom', 4, 17, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m17-v1-c1', [p('G', 2), p('D', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m17-v1-c2', [p('E', 2), p('B', 2)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 4, 18, [
      createVoice('bottom', 4, 18, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m18-v1-c1', [p('A', 2), p('E', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m18-v1-c2', [p('D', 3), p('A', 3)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 4, 19, [
      createVoice('bottom', 4, 19, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m19-v1-c1', [p('G', 2), p('D', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m19-v1-c2', [p('C', 3), p('G', 3)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 4, 20, [
      createVoice('bottom', 4, 20, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m20-v1-c1', [p('F', 2), p('C', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m20-v1-c2', [p('G', 2), p('D', 3)], 'h'),
      ]),
    ]),
    createMeasure(
      'bottom',
      5,
      21,
      [
        createVoice('bottom', 5, 21, 0, (voiceId) => [
          chord(voiceId, 'bottom-s5-m21-v1-c1', [p('C', 3), p('G', 3)], 'w'),
        ]),
      ],
      { directions: ['Two voices'] }
    ),
    createMeasure('bottom', 5, 22, [
      createVoice('bottom', 5, 22, 0, (voiceId) => [
        chord(voiceId, 'bottom-s5-m22-v1-c1', [p('B', 2), p('F', 3)], 'w'),
      ]),
    ]),
    createMeasure('bottom', 5, 23, [
      createVoice('bottom', 5, 23, 0, (voiceId) => [
        chord(voiceId, 'bottom-s5-m23-v1-c1', [p('E', 3), p('B', 3)], 'w'),
      ]),
    ]),
    createMeasure('bottom', 5, 24, [
      createVoice('bottom', 5, 24, 0, (voiceId) => [
        chord(voiceId, 'bottom-s5-m24-v1-c1', [p('F', 3), p('C', 4)], 'w'),
      ]),
    ]),
    createMeasure(
      'bottom',
      5,
      25,
      [
        createVoice('bottom', 5, 25, 0, (voiceId) => [
          chord(
            voiceId,
            'bottom-s5-m25-v1-c1',
            [p('C', 3), p('G', 3), p('C', 4)],
            'w'
          ),
        ]),
      ],
      { endBarline: 'final' }
    ),
  ];
}

function createMeasure(
  staffPrefix: 'top' | 'bottom',
  section: number,
  measureNumber: number,
  voices: Voice[],
  overrides: Partial<Omit<Measure, 'id' | 'number' | 'voices'>> = {}
): Measure {
  return {
    id: `${staffPrefix}-s${section}-m${measureNumber}`,
    number: measureNumber,
    voices,
    ...overrides,
  };
}

function createVoice(
  staffPrefix: 'top' | 'bottom',
  section: number,
  measureNumber: number,
  index: number,
  buildItems: (voiceId: string) => VoiceItem[],
  name?: string
): Voice {
  const id = `${staffPrefix}-s${section}-m${measureNumber}-v${index + 1}`;

  return {
    id,
    ...(name ? { name } : {}),
    index,
    items: buildItems(id),
  };
}

function p(
  step: Pitch['step'],
  octave: number,
  accidental?: Accidental
): Pitch {
  return {
    step,
    octave,
    ...(accidental ? { accidental } : {}),
  };
}

function note(
  voiceId: string,
  id: string,
  step: Pitch['step'],
  octave: number,
  length: Duration['length'],
  options: {
    accidental?: Accidental;
    dots?: Duration['dots'];
    lyric?: string;
    stemDirection?: Note['stemDirection'];
  } = {}
): Note {
  return {
    id,
    type: 'note',
    voiceId,
    pitch: p(step, octave, options.accidental),
    duration: duration(length, options.dots),
    ...(options.lyric ? { lyric: options.lyric } : {}),
    ...(options.stemDirection ? { stemDirection: options.stemDirection } : {}),
  };
}

function chord(
  voiceId: string,
  id: string,
  pitches: Pitch[],
  length: Duration['length'],
  options: {
    dots?: Duration['dots'];
    stemDirection?: Chord['stemDirection'];
  } = {}
): Chord {
  return {
    id,
    type: 'chord',
    voiceId,
    pitches,
    duration: duration(length, options.dots),
    ...(options.stemDirection ? { stemDirection: options.stemDirection } : {}),
  };
}

function duration(
  length: Duration['length'],
  dots?: Duration['dots']
): Duration {
  return {
    length,
    ...(dots ? { dots } : {}),
  };
}
