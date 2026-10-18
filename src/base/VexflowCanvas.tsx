import { Canvas, Picture, Skia, useCanvasSize } from 'react-native-skia';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { VexflowCanvasProps } from './types';
import VexflowRecordingContext from './VexflowRecordingContext';
import { renderVexflowRecordingCommands } from './VexflowRecordingReplay';

const VexflowCanvas: React.FC<VexflowCanvasProps> = (props) => {
  const {
    onDraw,
    fontManager,
    defaultFont,
    // width: propWidth,
    // height: propHeight,
    // colorScheme = 'light',
  } = props;

  const { size: canvasSize, onLayout } = useCanvasSize();

  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(
      Skia.XYWHRect(0, 0, canvasSize.width, canvasSize.height)
    );

    const ctx = new VexflowRecordingContext(fontManager, defaultFont);

    onDraw({ ctx, width: canvasSize.width, height: canvasSize.height });
    renderVexflowRecordingCommands(
      canvas,
      ctx.finish(),
      fontManager,
      defaultFont
    );

    return recorder.finishRecordingAsPicture();
  }, [onDraw, canvasSize, fontManager, defaultFont]);

  return (
    <Canvas style={styles.canvas} onLayout={onLayout}>
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
