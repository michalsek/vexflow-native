import React from 'react';
import { RoundedRect, Skia, type SkRRect } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type {
  RendererSize,
  RendererType,
  ScorePlayheadState,
  ScorePlayheadStyle,
} from '../types';
import { createVisibleViewport } from '../viewport';

export interface ResolvedPlayheadStyle {
  color: string;
  width: number;
  borderRadius: number;
  opacity: number;
}

type ScorePlayheadProps = {
  playhead: SharedValue<ScorePlayheadState | null>;
  scrollOffset: SharedValue<number>;
  rendererType: RendererType;
  viewportSize: SharedValue<RendererSize>;
  contentSize: SharedValue<RendererSize>;
  style: ResolvedPlayheadStyle;
};

export function resolvePlayheadStyle(
  style: ScorePlayheadStyle | undefined,
  foreground: string
): ResolvedPlayheadStyle {
  const width = style?.width ?? 2;

  return {
    color: style?.color ?? foreground,
    width,
    borderRadius: style?.borderRadius ?? width / 2,
    opacity: style?.opacity ?? 0.9,
  };
}

/**
 * Maps a playhead state (view space at scroll offset 0) to the on-screen
 * rect: the scroll translation along the active axis is subtracted, the
 * render scale is NOT applied — itemsLayout coordinates are already view
 * space. A null state collapses to a zero rect (declarative Skia cannot
 * unmount from the UI thread; a zero rect draws nothing).
 */
export function createPlayheadRect(
  state: ScorePlayheadState | null,
  scrollOffset: number,
  rendererType: RendererType,
  viewportSize: RendererSize,
  contentSize: RendererSize,
  width: number,
  borderRadius: number
): SkRRect {
  'worklet';

  if (!state) {
    return Skia.RRectXY(Skia.XYWHRect(0, 0, 0, 0), 0, 0);
  }

  const visible = createVisibleViewport(
    scrollOffset,
    rendererType,
    viewportSize,
    contentSize
  );

  return Skia.RRectXY(
    Skia.XYWHRect(
      state.x - width / 2 - visible.x,
      state.y - visible.y,
      width,
      state.height
    ),
    borderRadius,
    borderRadius
  );
}

/** The playback position line, drawn over the notation inside the viewport
 * clip. Follows scrolling on the UI thread without re-recording the score. */
const ScorePlayhead: React.FC<ScorePlayheadProps> = ({
  playhead,
  scrollOffset,
  rendererType,
  viewportSize,
  contentSize,
  style,
}) => {
  const rect = useDerivedValue(
    () =>
      createPlayheadRect(
        playhead.value,
        scrollOffset.value,
        rendererType,
        viewportSize.value,
        contentSize.value,
        style.width,
        style.borderRadius
      ),
    [
      contentSize,
      playhead,
      rendererType,
      scrollOffset,
      style.borderRadius,
      style.width,
      viewportSize,
    ]
  );
  const opacity = useDerivedValue(
    () => (playhead.value ? style.opacity : 0),
    [playhead, style.opacity]
  );

  return <RoundedRect rect={rect} color={style.color} opacity={opacity} />;
};

export default ScorePlayhead;
