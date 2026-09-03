import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Canvas,
  Group,
  Picture,
  Skia,
  useCanvasRef,
} from '@shopify/react-native-skia';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue } from 'react-native-reanimated';

import FontManager from '../../base/FontManager';
import { resolveScoreColorScheme } from '../colorScheme';
import { getRenderScale, toViewSize } from '../scale';
import type {
  RendererSize,
  ScoreRendererOptions,
  ScoreRendererProps,
} from '../types';
import { useScoreRecording } from '../useScoreRecording';
import ScoreOverlayPicture from './ScoreOverlayPicture';
import ScorePlayhead, { resolvePlayheadStyle } from './ScorePlayhead';
import ScoreScrollbar from './ScoreScrollbar';
import { getMaxScroll, getScrollAxis, useScoreScroll } from './useScoreScroll';
import {
  createPictureTransform,
  createScorePicture,
  withDefaultOptions,
} from './utils';

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
  scrollOffset: externalScrollOffset,
  playhead,
  playheadStyle,
  onScrollGeometry,
  onItemsLayout,
  onReady,
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
    groupIndex,
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

  const scale = getRenderScale(options);
  const contentSize = layoutPlan.contentSize;

  const viewContentSize = useMemo(
    () => toViewSize(contentSize, scale),
    [contentSize, scale]
  );

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
    externalScrollOffset,
    rendererType: effectiveRendererType,
    scrollEnabled,
    viewportSize,
  });

  const hasScrollableOverflow =
    getMaxScroll(effectiveRendererType, viewportSize, viewContentSize) > 0;

  const onScrollGeometryRef = useRef(onScrollGeometry);

  useEffect(() => {
    onScrollGeometryRef.current = onScrollGeometry;
  });

  useEffect(() => {
    if (!hasViewportSize) {
      return;
    }

    onScrollGeometryRef.current?.({
      axis: getScrollAxis(effectiveRendererType),
      viewportSize,
      contentSize: viewContentSize,
      maxScroll: getMaxScroll(
        effectiveRendererType,
        viewportSize,
        viewContentSize
      ),
    });
  }, [effectiveRendererType, hasViewportSize, viewContentSize, viewportSize]);

  const resolvedPlayheadStyle = useMemo(
    () => resolvePlayheadStyle(playheadStyle, resolvedColorScheme.foreground),
    [playheadStyle, resolvedColorScheme.foreground]
  );

  const viewportClip = useMemo(
    () => Skia.XYWHRect(0, 0, viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width]
  );

  const replayFontManager = useMemo(
    () => new FontManager(fontManager, defaultFont),
    [defaultFont, fontManager]
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
      replayFontManager,
    });
  }, [
    contentSize,
    defaultFont,
    fontManager,
    hasViewportSize,
    recordedCommands,
    replayFontManager,
  ]);

  useEffect(() => {
    if (!picture) {
      return;
    }

    return () => picture.dispose();
  }, [picture]);

  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  });

  const hasFiredReadyRef = useRef(false);

  useEffect(() => {
    if (hasFiredReadyRef.current || !hasViewportSize || !picture) {
      return;
    }

    hasFiredReadyRef.current = true;
    onReadyRef.current?.();
  }, [hasViewportSize, picture]);

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
                {picture ? <Picture picture={picture} /> : null}
                {itemStyleOverrides && hasViewportSize ? (
                  <ScoreOverlayPicture
                    contentSize={contentSize}
                    defaultFont={defaultFont}
                    fontManager={fontManager}
                    groupIndex={groupIndex}
                    itemStyleOverrides={itemStyleOverrides}
                  />
                ) : null}
              </Group>
              {playhead ? (
                <ScorePlayhead
                  playhead={playhead}
                  scrollOffset={scrollState.scrollOffset}
                  rendererType={effectiveRendererType}
                  viewportSize={scrollState.viewportSize}
                  contentSize={scrollState.contentSize}
                  style={resolvedPlayheadStyle}
                />
              ) : null}
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
