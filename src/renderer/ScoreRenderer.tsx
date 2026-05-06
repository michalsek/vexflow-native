import type React from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';
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
import { StyleSheet } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import type { VexflowRecordingCommand } from '../base';
import type {
  RendererSize,
  RendererType,
  ScoreOptions,
  ScoreRendererProps,
  Viewport,
} from './types';
import { insets, spacing, renderOptions } from './constants';
import { renderVexflowRecordingCommands } from '../base/VexflowRecordingReplay';
import { useScoreRecording } from './useScoreRecording';
import { createVisibleViewport } from './viewport';

const EMPTY_OPTIONS: Partial<ScoreOptions> = {};
const EMPTY_SCROLL_OFFSET = 0;

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  options: userOptions = EMPTY_OPTIONS,
  scrollOffset,
  onContentSizeChange,
}) => {
  const options = useMemo(() => withDefaultOptions(userOptions), [userOptions]);
  const effectiveRendererType = rendererType ?? 'document';
  const defaultScrollOffset = useSharedValue(EMPTY_SCROLL_OFFSET);
  const effectiveScrollOffset = scrollOffset ?? defaultScrollOffset;

  const canvasRef = useCanvasRef();
  const { size: canvasSize } = useCanvasSize(canvasRef);
  const reportedContentSizeRef = useRef(
    layoutPlanSizeKey({ width: 0, height: 0 })
  );
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

  useEffect(() => {
    if (!onContentSizeChange) {
      return;
    }

    const nextContentSizeKey = layoutPlanSizeKey(contentSize);

    if (reportedContentSizeRef.current === nextContentSizeKey) {
      return;
    }

    reportedContentSizeRef.current = nextContentSizeKey;
    onContentSizeChange(contentSize);
  }, [contentSize, onContentSizeChange]);

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
      effectiveScrollOffset.value,
      effectiveRendererType,
      { width: canvasSize.width, height: canvasSize.height },
      contentSize
    );
  }, [
    canvasSize.height,
    canvasSize.width,
    contentSize,
    effectiveRendererType,
    effectiveScrollOffset,
  ]);

  return (
    <Canvas style={styles.canvas} ref={canvasRef}>
      <Group clip={viewportClip}>
        <Group transform={pictureTransform}>
          <Picture picture={picture} />
        </Group>
      </Group>
    </Canvas>
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

function layoutPlanSizeKey({
  width,
  height,
}: {
  width: number;
  height: number;
}): string {
  return `${width}:${height}`;
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
