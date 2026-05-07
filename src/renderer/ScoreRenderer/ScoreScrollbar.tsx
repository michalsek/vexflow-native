import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import type { RendererSize } from '../types';
import type { ScrollAxis } from './types';
import { clampOffset } from './useScoreScroll';

type ScoreScrollbarProps = {
  axis: ScrollAxis;
  contentSize: SharedValue<RendererSize>;
  enabled: boolean;
  scrollOffset: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  viewportSize: SharedValue<RendererSize>;
};

export type ScrollbarMetrics = {
  maxScroll: number;
  maxThumbOffset: number;
  thumbExtent: number;
};

const ScoreScrollbar: React.FC<ScoreScrollbarProps> = ({
  axis,
  contentSize,
  enabled,
  scrollOffset,
  style,
  viewportSize,
}) => {
  const trackExtent = useSharedValue(0);
  const dragStartThumbOffset = useSharedValue(0);
  const thumbStyle = useAnimatedStyle(() => {
    const metrics = getScrollbarMetrics(
      axis,
      viewportSize.value,
      contentSize.value,
      trackExtent.value
    );
    const thumbOffset = getThumbOffsetFromScrollOffset(
      scrollOffset.value,
      metrics
    );

    return axis === 'horizontal'
      ? {
          height: 6,
          transform: [{ translateX: thumbOffset }],
          width: metrics.thumbExtent,
        }
      : {
          height: metrics.thumbExtent,
          transform: [{ translateY: thumbOffset }],
          width: 6,
        };
  }, [axis]);

  const scrollbarGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .minDistance(0)
        .onStart((event) => {
          const metrics = getScrollbarMetrics(
            axis,
            viewportSize.value,
            contentSize.value,
            trackExtent.value
          );
          const pressOffset = axis === 'horizontal' ? event.x : event.y;

          cancelAnimation(scrollOffset);
          dragStartThumbOffset.value = clampOffset(
            pressOffset - metrics.thumbExtent / 2,
            metrics.maxThumbOffset
          );
          scrollOffset.value = getScrollOffsetFromThumbOffset(
            dragStartThumbOffset.value,
            metrics
          );
        })
        .onUpdate((event) => {
          const metrics = getScrollbarMetrics(
            axis,
            viewportSize.value,
            contentSize.value,
            trackExtent.value
          );
          const translation =
            axis === 'horizontal' ? event.translationX : event.translationY;
          const nextThumbOffset = clampOffset(
            dragStartThumbOffset.value + translation,
            metrics.maxThumbOffset
          );

          scrollOffset.value = getScrollOffsetFromThumbOffset(
            nextThumbOffset,
            metrics
          );
        }),
    [
      axis,
      contentSize,
      dragStartThumbOffset,
      enabled,
      scrollOffset,
      trackExtent,
      viewportSize,
    ]
  );

  const handleTrackLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextTrackExtent =
        axis === 'horizontal'
          ? event.nativeEvent.layout.width
          : event.nativeEvent.layout.height;

      trackExtent.value = nextTrackExtent;
    },
    [axis, trackExtent]
  );

  return (
    <GestureDetector gesture={scrollbarGesture}>
      <Animated.View
        onLayout={handleTrackLayout}
        style={[styles.scrollbarTrack, style]}
      >
        <Animated.View
          style={[
            styles.scrollbarThumb,
            axis === 'horizontal'
              ? styles.horizontalScrollbarThumb
              : styles.verticalScrollbarThumb,
            thumbStyle,
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );
};

export default ScoreScrollbar;

export function getScrollbarMetrics(
  axis: ScrollAxis,
  viewportSize: RendererSize,
  contentSize: RendererSize,
  trackExtent: number
): ScrollbarMetrics {
  'worklet';

  const viewportExtent =
    axis === 'horizontal' ? viewportSize.width : viewportSize.height;
  const contentExtent =
    axis === 'horizontal' ? contentSize.width : contentSize.height;
  const maxScroll = Math.max(0, contentExtent - viewportExtent);
  const normalizedContentExtent = Math.max(contentExtent, viewportExtent);
  const thumbExtent =
    trackExtent > 0 && normalizedContentExtent > 0
      ? Math.max(
          12,
          Math.min(
            trackExtent,
            (viewportExtent / normalizedContentExtent) * trackExtent
          )
        )
      : 0;

  return {
    maxScroll,
    maxThumbOffset: Math.max(0, trackExtent - thumbExtent),
    thumbExtent,
  };
}

export function getThumbOffsetFromScrollOffset(
  scrollOffsetValue: number,
  metrics: ScrollbarMetrics
): number {
  'worklet';

  return metrics.maxScroll > 0 && metrics.maxThumbOffset > 0
    ? (scrollOffsetValue / metrics.maxScroll) * metrics.maxThumbOffset
    : 0;
}

export function getScrollOffsetFromThumbOffset(
  thumbOffset: number,
  metrics: ScrollbarMetrics
): number {
  'worklet';

  return metrics.maxScroll > 0 && metrics.maxThumbOffset > 0
    ? (thumbOffset / metrics.maxThumbOffset) * metrics.maxScroll
    : 0;
}

const styles = StyleSheet.create({
  horizontalScrollbarThumb: {
    bottom: 0,
    top: 0,
  },
  scrollbarThumb: {
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    borderRadius: 999,
    position: 'absolute',
  },
  scrollbarTrack: {
    backgroundColor: 'rgba(15, 23, 42, 0.14)',
    borderRadius: 999,
    position: 'absolute',
  },
  verticalScrollbarThumb: {
    left: 0,
    right: 0,
  },
});
