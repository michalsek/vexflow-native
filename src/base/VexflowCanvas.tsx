import {
  Canvas,
  Picture,
  Skia,
  useCanvasRef,
  useCanvasSize,
} from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { VexflowCanvasProps } from './types';
import SkiaVexflowContext from './SkiaVexflowContext';

const VexflowCanvas: React.FC<VexflowCanvasProps> = (props) => {
  const {
    onDraw,
    fontManager,
    defaultFont,
    // width: propWidth,
    // height: propHeight,
    // colorScheme = 'light',
  } = props;

  const canvasRef = useCanvasRef();
  const { size: canvasSize } = useCanvasSize(canvasRef);

  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, canvasSize.width, canvasSize.height)
    );

    const ctx = new SkiaVexflowContext(canvas, fontManager, defaultFont);

    onDraw({ ctx, width: canvasSize.width, height: canvasSize.height });

    return recorder.finishRecordingAsPicture();
  }, [onDraw, canvasSize, fontManager, defaultFont]);

  return (
    <Canvas style={styles.canvas} ref={canvasRef}>
      <Picture picture={picture} />
    </Canvas>
  );
};

export default VexflowCanvas;

const styles = StyleSheet.create({
  canvas: {
    flex: 1, // TMP?
  },
});
