import type React from 'react';
import { useMemo } from 'react';
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

const recorder = Skia.PictureRecorder();

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  options: userOptions = {},
}) => {
  const options = useMemo(() => withDefaultOptions(userOptions), [userOptions]);

  const canvasRef = useCanvasRef();
  const { size: canvasSize } = useCanvasSize(canvasRef);
  const viewportRect = useMemo(
    () => Skia.XYWHRect(0, 0, canvasSize.width, canvasSize.height),
    [canvasSize]
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

  /**
   * Creates a picture which renders the score using the previously computed layout plan.
   * It uses shared values, to track score progress or viewport scroll position, in order
   * to only render the visible portion of the score, as well as to enable scroll/progress
   * animations. This allows to keep minimal amount of computation done for rendering.
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

    renderer.render(layoutPlan);
    return recorder.finishRecordingAsPicture();
  }, [
    layoutPlan,
    viewportRect,
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

const styles = StyleSheet.create({
  canvas: {
    flex: 1, // TMP?
  },
});
