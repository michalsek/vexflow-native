import { useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import type { RendererSize, RendererType } from '../types';
import type { ScoreScrollState, ScrollAxis } from './types';

const EMPTY_SIZE: RendererSize = { width: 0, height: 0 };

export function useScoreScroll({
  contentSize,
  rendererType,
  scrollEnabled,
  viewportSize,
}: {
  contentSize: RendererSize;
  rendererType: RendererType;
  scrollEnabled: boolean;
  viewportSize: RendererSize;
}): ScoreScrollState {
  const scrollOffset = useSharedValue(0);
  const viewportSizeValue = useSharedValue<RendererSize>(EMPTY_SIZE);
  const contentSizeValue = useSharedValue<RendererSize>(EMPTY_SIZE);
  const panStartOffset = useSharedValue(0);
  const axis = getScrollAxis(rendererType);

  useEffect(() => {
    viewportSizeValue.value = viewportSize;
  }, [viewportSize, viewportSizeValue]);

  useEffect(() => {
    contentSizeValue.value = contentSize;
  }, [contentSize, contentSizeValue]);

  const maxScrollValue = useDerivedValue(
    () =>
      getMaxScroll(
        rendererType,
        viewportSizeValue.value,
        contentSizeValue.value
      ),
    [contentSizeValue, rendererType, viewportSizeValue]
  );

  useAnimatedReaction(
    () => maxScrollValue.value,
    (nextMaxScroll) => {
      const nextOffset = clampOffset(scrollOffset.value, nextMaxScroll);

      if (nextOffset !== scrollOffset.value) {
        scrollOffset.value = nextOffset;
      }
    },
    [maxScrollValue, scrollOffset]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(scrollEnabled)
        .onStart(() => {
          cancelAnimation(scrollOffset);
          panStartOffset.value = scrollOffset.value;
        })
        .onUpdate((event) => {
          const nextMaxScroll = maxScrollValue.value;
          const translation =
            rendererType === 'infiniteScore'
              ? event.translationX
              : event.translationY;

          scrollOffset.value = clampOffset(
            panStartOffset.value - translation,
            nextMaxScroll
          );
        })
        .onEnd((event) => {
          const nextMaxScroll = maxScrollValue.value;
          const velocity =
            rendererType === 'infiniteScore'
              ? event.velocityX
              : event.velocityY;

          scrollOffset.value =
            nextMaxScroll > 0
              ? withDecay({
                  clamp: [0, nextMaxScroll],
                  velocity: -velocity,
                })
              : 0;
        }),
    [maxScrollValue, panStartOffset, rendererType, scrollEnabled, scrollOffset]
  );

  return {
    axis,
    contentSize: contentSizeValue,
    panGesture,
    scrollOffset,
    viewportSize: viewportSizeValue,
  };
}

export function getScrollAxis(rendererType: RendererType): ScrollAxis {
  'worklet';

  return rendererType === 'infiniteScore' ? 'horizontal' : 'vertical';
}

export function getMaxScroll(
  rendererType: RendererType,
  viewportSize: RendererSize,
  contentSize: RendererSize
): number {
  'worklet';

  return getScrollAxis(rendererType) === 'horizontal'
    ? Math.max(0, contentSize.width - viewportSize.width)
    : Math.max(0, contentSize.height - viewportSize.height);
}

export function clampOffset(offset: number, maxOffset: number): number {
  'worklet';

  return Math.min(Math.max(offset, 0), maxOffset);
}

export function createClampedScrollOffset(
  scrollOffset: number,
  rendererType: RendererType,
  viewportSize: RendererSize,
  contentSize: RendererSize
): number {
  'worklet';

  return clampOffset(
    scrollOffset,
    getMaxScroll(rendererType, viewportSize, contentSize)
  );
}
