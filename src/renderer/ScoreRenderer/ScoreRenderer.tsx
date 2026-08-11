import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Canvas,
  Group,
  Picture,
  Skia,
  type SkPicture,
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
import { getRenderScale, toViewSize } from '../scale';
import type {
  RendererSize,
  RendererType,
  ScoreItemStyleOverrides,
  ScoreOptions,
  ScoreRendererOptions,
  ScoreRendererProps,
  Viewport,
} from '../types';
import { useScoreRecording } from '../useScoreRecording';
import { createVisibleViewport } from '../viewport';
import ScoreScrollbar from './ScoreScrollbar';
import { getMaxScroll, useScoreScroll } from './useScoreScroll';

const EMPTY_OPTIONS: ScoreRendererOptions = {};
const EMPTY_SIZE: RendererSize = { width: 0, height: 0 };

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  colorScheme,
  itemStyleOverrides,
  options: userOptions = EMPTY_OPTIONS,
  scrollEnabled = true,
  showScrollbars = true,
  onItemsLayout,
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
  const canvasStyle = useMemo(
    () => StyleSheet.flatten([styles.canvas, backgroundStyle]),
    [backgroundStyle]
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
  const {
    commands: recordedCommands,
    layoutPlan,
    itemsLayout,
  } = useScoreRecording({
    defaultFont,
    enabled: hasViewportSize,
    fontManager,
    colorScheme: resolvedColorScheme,
    options,
    rendererType: effectiveRendererType,
    score,
    viewport,
  });
  // Content space vs view space (see src/renderer/scale.ts): the layout
  // plan's content size is CONTENT-space — it bounds the recorded picture —
  // while scrolling, scrollbars and overflow checks need the VIEW-space size
  // (content x scale), or the scroll range would be wrong whenever
  // options.render.scale !== 1.
  const scale = getRenderScale(options);
  const contentSize = layoutPlan.contentSize;
  const viewContentSize = useMemo(
    () => toViewSize(contentSize, scale),
    [contentSize, scale]
  );

  // Deliver formatted item geometry to the consumer. This effect stays on the
  // plain JS side — neither `onItemsLayout` nor `itemsLayout` may be captured
  // by a worklet (see the PanGesture serialization note below): a consumer
  // callback closing over arbitrary objects would crash the worklets
  // serializer the same way the gesture capture did.
  //
  // The latest callback is held in a ref (updated by its own effect after
  // every commit) so the delivery effect depends ONLY on the geometry
  // identity + viewport readiness: it fires once per recording pass, exactly
  // as the `onItemsLayout` contract states. Depending on the callback
  // identity instead would re-fire for every inline-callback parent render —
  // and an inline callback writing fresh parent state would loop.
  const onItemsLayoutRef = useRef(onItemsLayout);
  useEffect(() => {
    onItemsLayoutRef.current = onItemsLayout;
  });
  useEffect(() => {
    if (!hasViewportSize) {
      return;
    }

    onItemsLayoutRef.current?.(itemsLayout);
  }, [itemsLayout, hasViewportSize]);
  const scrollState = useScoreScroll({
    contentSize: viewContentSize,
    rendererType: effectiveRendererType,
    scrollEnabled,
    viewportSize,
  });
  const hasScrollableOverflow =
    getMaxScroll(effectiveRendererType, viewportSize, viewContentSize) > 0;

  const viewportClip = useMemo(
    () => Skia.XYWHRect(0, 0, viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width]
  );

  const picture = useMemo(() => {
    if (!hasViewportSize || itemStyleOverrides) {
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
    itemStyleOverrides,
    recordedCommands,
  ]);

  // Destructure the shared value before the worklet below. Referencing
  // `scrollState.scrollOffset.value` inside the worklet would capture the
  // whole `scrollState` object — including the non-serializable PanGesture —
  // and crash the worklets serializer ("Cannot copy value of type `PanGesture`").
  const { scrollOffset } = scrollState;
  const pictureTransform = useDerivedValue(() => {
    return createPictureTransform(
      scrollOffset.value,
      effectiveRendererType,
      { width: viewportSize.width, height: viewportSize.height },
      viewContentSize,
      scale
    );
  }, [
    effectiveRendererType,
    scale,
    scrollOffset,
    viewContentSize,
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
          <Canvas style={canvasStyle} ref={canvasRef}>
            <Group clip={viewportClip}>
              <Group transform={pictureTransform}>
                {itemStyleOverrides && hasViewportSize ? (
                  <AnimatedScorePicture
                    contentSize={contentSize}
                    defaultFont={defaultFont}
                    fontManager={fontManager}
                    itemStyleOverrides={itemStyleOverrides}
                    recordedCommands={recordedCommands}
                  />
                ) : picture ? (
                  <Picture picture={picture} />
                ) : null}
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

function AnimatedScorePicture({
  contentSize,
  defaultFont,
  fontManager,
  itemStyleOverrides,
  recordedCommands,
}: {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  itemStyleOverrides: NonNullable<ScoreRendererProps['itemStyleOverrides']>;
  recordedCommands: readonly VexflowRecordingCommand[];
}) {
  const picture = useDerivedValue<SkPicture>(() => {
    return createScorePictureWorklet({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands,
      styleOverrides: itemStyleOverrides.value,
    });
  }, [
    contentSize,
    defaultFont,
    fontManager,
    itemStyleOverrides,
    recordedCommands,
  ]);

  return <Picture picture={picture} />;
}

export function createScorePicture({
  contentSize,
  defaultFont,
  fontManager,
  recordedCommands,
  styleOverrides,
}: {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  recordedCommands: readonly VexflowRecordingCommand[];
  styleOverrides?: ScoreItemStyleOverrides;
}) {
  try {
    const start = nowMs();
    const picture = createScorePictureWorklet({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands,
      styleOverrides,
    });

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

function createScorePictureWorklet({
  contentSize,
  defaultFont,
  fontManager,
  recordedCommands,
  styleOverrides,
}: {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  recordedCommands: readonly VexflowRecordingCommand[];
  styleOverrides?: ScoreItemStyleOverrides;
}): SkPicture {
  'worklet';

  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(0, 0, contentSize.width, contentSize.height)
  );

  renderVexflowRecordingCommands(
    canvas,
    recordedCommands,
    fontManager,
    defaultFont,
    styleOverrides
  );

  return recorder.finishRecordingAsPicture();
}

/**
 * Maps the CONTENT-space picture into the view. `contentSize` must be the
 * VIEW-space content size (content x scale) so the scroll clamp matches the
 * scroll range `useScoreScroll` exposes.
 *
 * Transform order matters: react-native-skia applies a transform array
 * right-to-left to a point, so the trailing `{ scale }` entry scales the
 * content-space point into view space FIRST, and the leading translate
 * entries then shift it by the VIEW-space scroll offset:
 * `p_view = scale * p_content - scrollOffset_view`. The scale entry is only
 * appended when scale !== 1 so the default output is byte-identical to the
 * pre-scale implementation.
 */
export function createPictureTransform(
  scrollOffset: number,
  rendererType: RendererType,
  viewport: Viewport,
  contentSize: RendererSize,
  scale: number = 1
): Transforms3d {
  'worklet';

  const visibleViewport = createVisibleViewport(
    scrollOffset,
    rendererType,
    viewport,
    contentSize
  );

  const transform: Transforms3d = [
    {
      translateX: visibleViewport.x === 0 ? 0 : -visibleViewport.x,
    },
    {
      translateY: visibleViewport.y === 0 ? 0 : -visibleViewport.y,
    },
  ];

  if (scale !== 1) {
    transform.push({ scale });
  }

  return transform;
}

function withDefaultOptions(options: ScoreRendererOptions): ScoreOptions {
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
