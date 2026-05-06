import type React from 'react';
import { memo, useMemo } from 'react';
import {
  Canvas,
  Group,
  Picture,
  Skia,
  type SkTypefaceFontProvider,
  type Transforms3d,
  useCanvasRef,
  useCanvasSize,
} from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue } from 'react-native-reanimated';

import type { VexflowRecordingCommand } from '../../base';
import { renderVexflowRecordingCommands } from '../../base/VexflowRecordingReplay';
import { insets, renderOptions, spacing } from '../constants';
import type {
  RendererSize,
  RendererType,
  ScoreOptions,
  ScoreRendererProps,
  Viewport,
} from '../types';
import { useScoreRecording } from '../useScoreRecording';
import { createVisibleViewport } from '../viewport';
import ScoreScrollbar from './ScoreScrollbar';
import { getMaxScroll, useScoreScroll } from './useScoreScroll';

const EMPTY_OPTIONS: Partial<ScoreOptions> = {};

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  options: userOptions = EMPTY_OPTIONS,
  scrollEnabled = true,
  showScrollbars = true,
}) => {
  const options = useMemo(() => withDefaultOptions(userOptions), [userOptions]);
  const effectiveRendererType = rendererType ?? 'document';

  const canvasRef = useCanvasRef();
  const { size: canvasSize } = useCanvasSize(canvasRef);
  const viewport = useMemo(
    () => ({
      x: 0,
      y: 0,
      width: canvasSize.width,
      height: canvasSize.height,
    }),
    [canvasSize.height, canvasSize.width]
  );
  const { commands: recordedCommands, layoutPlan } = useScoreRecording({
    defaultFont,
    fontManager,
    options,
    rendererType: effectiveRendererType,
    score,
    viewport,
  });
  const contentSize = layoutPlan.contentSize;
  const scrollState = useScoreScroll({
    contentSize,
    rendererType: effectiveRendererType,
    scrollEnabled,
    viewportSize: canvasSize,
  });
  const hasScrollableOverflow =
    getMaxScroll(effectiveRendererType, canvasSize, contentSize) > 0;

  const viewportClip = useMemo(
    () => Skia.XYWHRect(0, 0, canvasSize.width, canvasSize.height),
    [canvasSize.height, canvasSize.width]
  );

  const picture = useMemo(() => {
    return createScorePicture({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands,
    });
  }, [contentSize, defaultFont, fontManager, recordedCommands]);

  const pictureTransform = useDerivedValue(() => {
    return createPictureTransform(
      scrollState.scrollOffset.value,
      effectiveRendererType,
      { width: canvasSize.width, height: canvasSize.height },
      contentSize
    );
  }, [
    canvasSize.height,
    canvasSize.width,
    contentSize,
    effectiveRendererType,
    scrollState.scrollOffset,
  ]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={scrollState.panGesture}>
        <View style={styles.gestureSurface}>
          <Canvas style={styles.canvas} ref={canvasRef}>
            <Group clip={viewportClip}>
              <Group transform={pictureTransform}>
                <Picture picture={picture} />
              </Group>
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {showScrollbars && hasScrollableOverflow ? (
        <ScoreScrollbar
          axis={scrollState.axis}
          contentSize={scrollState.contentSize}
          enabled={scrollEnabled}
          scrollOffset={scrollState.scrollOffset}
          style={
            scrollState.axis === 'horizontal'
              ? styles.horizontalScrollbar
              : styles.verticalScrollbar
          }
          viewportSize={scrollState.viewportSize}
        />
      ) : null}
    </View>
  );
};

export default memo(ScoreRenderer);

export function createScorePicture({
  contentSize,
  defaultFont,
  fontManager,
  recordedCommands,
}: {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  recordedCommands: readonly VexflowRecordingCommand[];
}) {
  try {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, contentSize.width, contentSize.height)
    );

    renderVexflowRecordingCommands(
      canvas,
      recordedCommands,
      fontManager,
      defaultFont
    );
    return recorder.finishRecordingAsPicture();
  } catch (error) {
    console.error('ScoreRenderer picture render failed', error);
    throw error;
  }
}

export function createPictureTransform(
  scrollOffset: number,
  rendererType: RendererType,
  viewport: Viewport,
  contentSize: RendererSize
): Transforms3d {
  'worklet';

  const visibleViewport = createVisibleViewport(
    scrollOffset,
    rendererType,
    viewport,
    contentSize
  );

  return [
    {
      translateX: visibleViewport.x === 0 ? 0 : -visibleViewport.x,
    },
    {
      translateY: visibleViewport.y === 0 ? 0 : -visibleViewport.y,
    },
  ];
}

function withDefaultOptions(options: Partial<ScoreOptions>): ScoreOptions {
  return {
    insets: { ...insets, ...(options.insets || {}) },
    spacing: { ...spacing, ...(options.spacing || {}) },
    render: { ...renderOptions, ...(options.render || {}) },
  };
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  gestureSurface: {
    flex: 1,
  },
  horizontalScrollbar: {
    bottom: 12,
    height: 6,
    left: 12,
    right: 12,
  },
  verticalScrollbar: {
    bottom: 20,
    right: 2,
    top: 4,
    width: 6,
  },
});
