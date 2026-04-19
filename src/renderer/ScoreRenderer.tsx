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
import Renderer from './Renderer';
import { createVisibleViewport } from './viewport';

const recorder = Skia.PictureRecorder();
const EMPTY_OPTIONS: Partial<ScoreOptions> = {};
const EMPTY_SCROLL_OFFSET = { x: 0, y: 0 };

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  options: userOptions = EMPTY_OPTIONS,
  scrollOffset = EMPTY_SCROLL_OFFSET,
  onContentSizeChange,
}) => {
  const options = useMemo(() => withDefaultOptions(userOptions), [userOptions]);

  const canvasRef = useCanvasRef();
  const { size: canvasSize } = useCanvasSize(canvasRef);
  const canvasWidth = canvasSize.width;
  const canvasHeight = canvasSize.height;
  const scrollX = scrollOffset.x;
  const scrollY = scrollOffset.y;
  const viewportRect = useMemo(
    () => Skia.XYWHRect(0, 0, canvasWidth, canvasHeight),
    [canvasHeight, canvasWidth]
  );
  const reportedContentSizeRef = useRef(
    layoutPlanSizeKey({ width: 0, height: 0 })
  );

  /**
   * Creates a disposable picture which is used to measure the score layout without rendering it.
   * The layout plan is stored in a useMemo to avoid re-measuring on every render,
   * and is only re-computed when the score, renderer type, options, canvas size, default font,
   * or font manager change.
   */
  const layoutPlan = useMemo(() => {
    const canvas = recorder.beginRecording(viewportRect);

    const ctx = new SkiaVexflowContext(canvas, fontManager, defaultFont);

    const renderer = new Renderer(
      ctx,
      { width: viewportRect.width, height: viewportRect.height },
      options,
      score,
      rendererType
    );

    const measurementPlan = renderer.measure();
    const plan = renderer.layout(measurementPlan);

    recorder.finishRecordingAsPicture();
    return plan;
  }, [score, rendererType, options, viewportRect, defaultFont, fontManager]);
  const contentWidth = layoutPlan.contentSize.width;
  const contentHeight = layoutPlan.contentSize.height;

  const visibleViewport = useMemo(
    () =>
      createVisibleViewport(
        { x: scrollX, y: scrollY },
        { width: canvasWidth, height: canvasHeight },
        { width: contentWidth, height: contentHeight }
      ),
    [canvasHeight, canvasWidth, contentHeight, contentWidth, scrollX, scrollY]
  );

  useEffect(() => {
    if (!onContentSizeChange) {
      return;
    }

    const nextContentSizeKey = layoutPlanSizeKey({
      width: contentWidth,
      height: contentHeight,
    });

    if (reportedContentSizeRef.current === nextContentSizeKey) {
      return;
    }

    reportedContentSizeRef.current = nextContentSizeKey;
    onContentSizeChange({ width: contentWidth, height: contentHeight });
  }, [contentHeight, contentWidth, onContentSizeChange]);

  /**
   * Creates a picture from the full layout plan while limiting drawing to the
   * currently visible viewport. Full measurement and layout stay intact so
   * wrapping, repeated modifiers, and content size remain stable while scrolling.
   */
  const picture = useMemo(() => {
    'worklet';
    const canvas = recorder.beginRecording(viewportRect);

    const ctx = new SkiaVexflowContext(canvas, fontManager, defaultFont);

    const renderer = new Renderer(
      ctx,
      { width: viewportRect.width, height: viewportRect.height },
      options,
      score,
      rendererType
    );

    ctx.save();
    ctx.clipRect(0, 0, viewportRect.width, viewportRect.height);
    ctx.translate(-visibleViewport.x, -visibleViewport.y);
    renderer.render(layoutPlan, { visibleViewport });
    ctx.restore();
    return recorder.finishRecordingAsPicture();
  }, [
    layoutPlan,
    viewportRect,
    visibleViewport,
    fontManager,
    defaultFont,
    options,
    score,
    rendererType,
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
