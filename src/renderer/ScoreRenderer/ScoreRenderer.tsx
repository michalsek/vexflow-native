import type React from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Canvas,
  Group,
  Picture,
  Skia,
  type SkTypefaceFontProvider,
  type Transforms3d,
  useCanvasRef,
} from '@shopify/react-native-skia';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue } from 'react-native-reanimated';

import type { VexflowRecordingCommand } from '../../base';
import { renderVexflowRecordingCommands } from '../../base/VexflowRecordingReplay';
import { resolveScoreColorScheme } from '../colorScheme';
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
const EMPTY_SIZE: RendererSize = { width: 0, height: 0 };

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  colorScheme,
  options: userOptions = EMPTY_OPTIONS,
  scrollEnabled = true,
  showScrollbars = true,
}) => {
  const options = useMemo(() => withDefaultOptions(userOptions), [userOptions]);
  const resolvedColorScheme = useMemo(
    () => resolveScoreColorScheme(colorScheme),
    [colorScheme]
  );
  const backgroundStyle = useMemo(
    () => ({ backgroundColor: resolvedColorScheme.background }),
    [resolvedColorScheme.background]
  );
  const effectiveRendererType = rendererType ?? 'document';

  const canvasRef = useCanvasRef();
  const [viewportSize, setViewportSize] = useState<RendererSize>(EMPTY_SIZE);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;

    setViewportSize((currentSize) => {
      if (currentSize.width === width && currentSize.height === height) {
        return currentSize;
      }

      return { width, height };
    });
  }, []);
  const hasViewportSize = viewportSize.width > 0 && viewportSize.height > 0;
  const viewport = useMemo(
    () => ({
      x: 0,
      y: 0,
      width: viewportSize.width,
      height: viewportSize.height,
    }),
    [viewportSize.height, viewportSize.width]
  );
  const { commands: recordedCommands, layoutPlan } = useScoreRecording({
    defaultFont,
    enabled: hasViewportSize,
    fontManager,
    colorScheme: resolvedColorScheme,
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
    viewportSize,
  });
  const hasScrollableOverflow =
    getMaxScroll(effectiveRendererType, viewportSize, contentSize) > 0;

  const viewportClip = useMemo(
    () => Skia.XYWHRect(0, 0, viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width]
  );

  const picture = useMemo(() => {
    if (!hasViewportSize) {
      return undefined;
    }

    return createScorePicture({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands,
    });
  }, [
    contentSize,
    defaultFont,
    fontManager,
    hasViewportSize,
    recordedCommands,
  ]);

  const pictureTransform = useDerivedValue(() => {
    return createPictureTransform(
      scrollState.scrollOffset.value,
      effectiveRendererType,
      { width: viewportSize.width, height: viewportSize.height },
      contentSize
    );
  }, [
    contentSize,
    effectiveRendererType,
    scrollState.scrollOffset,
    viewportSize.height,
    viewportSize.width,
  ]);

  return (
    <View style={[styles.container, backgroundStyle]}>
      <GestureDetector gesture={scrollState.panGesture}>
        <View
          style={[styles.gestureSurface, backgroundStyle]}
          onLayout={handleLayout}
        >
          <Canvas style={[styles.canvas, backgroundStyle]} ref={canvasRef}>
            <Group clip={viewportClip}>
              <Group transform={pictureTransform}>
                {picture ? <Picture picture={picture} /> : null}
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
    const start = nowMs();
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
    const picture = recorder.finishRecordingAsPicture();

    logScorePictureProfile({
      commandCount: recordedCommands.length,
      contentSize,
      durationMs: nowMs() - start,
    });

    return picture;
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

function logScorePictureProfile({
  commandCount,
  contentSize,
  durationMs,
}: {
  commandCount: number;
  contentSize: RendererSize;
  durationMs: number;
}) {
  if (!isDevBuild()) {
    return;
  }

  console.info('[ScoreRenderer] picture profile', {
    contentSize,
    commandCount,
    durationMs: roundMs(durationMs),
  });
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function isDevBuild(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false;
  }

  return typeof __DEV__ === 'undefined' ? false : __DEV__;
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
