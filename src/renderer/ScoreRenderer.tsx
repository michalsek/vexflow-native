import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
  Canvas,
  Picture,
  Skia,
  useCanvasRef,
  useCanvasSize,
} from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

import type { ScoreOptions, ScoreRendererProps } from './types';
import { insets, spacing, renderOptions } from './constants';
import SkiaVexflowContext from '../base/SkiaVexflowContext';
import { layoutScore } from './layout';
import { createVisibleViewport } from './viewport';

const EMPTY_OPTIONS: Partial<ScoreOptions> = {};
const EMPTY_SCROLL_OFFSET = { x: 0, y: 0 };

import { measureScore } from './measure';
import { renderScore } from './render';

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  options: userOptions = EMPTY_OPTIONS,
  scrollOffset = EMPTY_SCROLL_OFFSET,
  onContentSizeChange,
}) => {
  const options = withDefaultOptions(userOptions);
  const effectiveRendererType = rendererType ?? 'document';

  const canvasRef = useCanvasRef();
  const { size: canvasSize } = useCanvasSize(canvasRef);
  const reportedContentSizeRef = useRef(
    layoutPlanSizeKey({ width: 0, height: 0 })
  );

  /**
   * Creates a disposable picture which is used to measure the score layout without rendering it.
   * The layout plan is stored in a useMemo to avoid re-measuring on every render,
   * and is only re-computed when the score, renderer type, options, canvas size, default font,
   * or font manager change.
   */
  const measuredScore = useMemo(
    () => measureScore(score, options),
    [score, options]
  );

  const layoutPlan = useMemo(
    () =>
      layoutScore(score, measuredScore, options, effectiveRendererType, {
        x: 0,
        y: 0,
        width: canvasSize.width,
        height: canvasSize.height,
      }),
    [
      canvasSize.height,
      canvasSize.width,
      effectiveRendererType,
      measuredScore,
      options,
      score,
    ]
  );

  const visibleViewport = useMemo(
    () =>
      createVisibleViewport(
        scrollOffset,
        { width: canvasSize.width, height: canvasSize.height },
        layoutPlan.contentSize
      ),
    [canvasSize.height, canvasSize.width, layoutPlan.contentSize, scrollOffset]
  );

  useEffect(() => {
    if (!onContentSizeChange) {
      return;
    }

    const nextContentSizeKey = layoutPlanSizeKey(layoutPlan.contentSize);

    if (reportedContentSizeRef.current === nextContentSizeKey) {
      return;
    }

    reportedContentSizeRef.current = nextContentSizeKey;
    onContentSizeChange(layoutPlan.contentSize);
  }, [layoutPlan.contentSize, onContentSizeChange]);

  /**
   * Creates a picture from the full layout plan while limiting drawing to the
   * currently visible viewport. Full measurement and layout stay intact so
   * wrapping, repeated modifiers, and content size remain stable while scrolling.
   */
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, canvasSize.width, canvasSize.height)
    );

    const ctx = new SkiaVexflowContext(canvas, fontManager, defaultFont);

    ctx.save();
    ctx.clipRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.translate(-visibleViewport.x, -visibleViewport.y);
    renderScore(ctx, score, layoutPlan, options);
    ctx.restore();
    return recorder.finishRecordingAsPicture();
  }, [
    canvasSize.height,
    canvasSize.width,
    fontManager,
    defaultFont,
    layoutPlan,
    options,
    score,
    visibleViewport.x,
    visibleViewport.y,
  ]);

  return (
    <Canvas style={styles.canvas} ref={canvasRef}>
      <Picture picture={picture} />
    </Canvas>
  );
};

export default ScoreRenderer;

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
