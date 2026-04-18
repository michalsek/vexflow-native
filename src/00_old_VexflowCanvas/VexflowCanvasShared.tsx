import {
  Canvas,
  Picture,
  Skia,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Text, useWindowDimensions } from 'react-native';
import { Element } from 'vexflow';

import SkiaVexflowContext from '../SkiaVexflowContext';
import { VEXFLOW_SCORE_COLORS } from '../constants';
import { parseCssFontShorthand } from '../utils';
import {
  createFont,
  getAdvanceWidth,
  type LoadedFontResource,
} from './fontUtils';
import type { VexflowCanvasDrawArgs, VexflowCanvasProps } from './types';

const CANVAS_HEIGHT = 180;
const FALLBACK_FONT_NAME = 'vexflowFont';

type SharedVexflowCanvasProps = VexflowCanvasProps & {
  fontResource: LoadedFontResource | null;
};

function createTextMeasurementCanvas(fontResource: LoadedFontResource | null) {
  let currentFont = createFont(12, FALLBACK_FONT_NAME, fontResource);

  const measureContext = {
    measureText: (text: string) => {
      const rect = currentFont.measureText(text);
      const width = getAdvanceWidth(currentFont, text);
      const ascent = Math.max(0, -rect.y);
      const descent = Math.max(0, rect.y + rect.height);

      return {
        width,
        actualBoundingBoxAscent: ascent,
        actualBoundingBoxDescent: descent,
        fontBoundingBoxAscent: ascent,
        fontBoundingBoxDescent: descent,
        actualBoundingBoxLeft: rect.x,
        actualBoundingBoxRight: rect.x + rect.width,
      };
    },
  };

  Object.defineProperty(measureContext, 'font', {
    get() {
      return '';
    },
    set(value: string) {
      try {
        const parsed = parseCssFontShorthand(value);
        currentFont = createFont(parsed.sizePx, parsed.family, fontResource);
      } catch {
        currentFont = createFont(12, FALLBACK_FONT_NAME, fontResource);
      }
    },
  });

  return {
    getContext: (type: string) =>
      type === '2d' ? (measureContext as any) : null,
  };
}

function createVexflowPicture(
  width: number,
  height: number,
  onDraw: (args: VexflowCanvasDrawArgs) => void,
  fontResource: LoadedFontResource,
  scoreColors: {
    fill: string;
    stroke: string;
  }
): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

  const ctx = new SkiaVexflowContext(canvas, fontResource, {
    defaultFillStyle: scoreColors.fill,
    defaultStrokeStyle: scoreColors.stroke,
  });

  onDraw({ ctx, width, height });

  return recorder.finishRecordingAsPicture();
}

export default function VexflowCanvasShared({
  onDraw,
  fontResource,
  width,
  height = CANVAS_HEIGHT,
  colorScheme = 'light',
}: SharedVexflowCanvasProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scoreColors =
    colorScheme === 'dark'
      ? VEXFLOW_SCORE_COLORS.dark
      : VEXFLOW_SCORE_COLORS.light;

  const canvasWidth = width ?? Math.max(300, Math.floor(windowWidth) - 32);

  const pictureInfo = useMemo(() => {
    if (!fontResource) {
      return null;
    }

    Element.setTextMeasurementCanvas(
      createTextMeasurementCanvas(fontResource) as unknown as HTMLCanvasElement
    );

    const picture = createVexflowPicture(
      canvasWidth,
      height,
      onDraw,
      fontResource,
      scoreColors
    );

    return { picture, width: canvasWidth, height };
  }, [fontResource, canvasWidth, height, onDraw, scoreColors]);

  if (!pictureInfo) {
    return <Text>Loading font...</Text>;
  }

  return (
    <Canvas style={{ width: pictureInfo.width, height: pictureInfo.height }}>
      <Picture picture={pictureInfo.picture} />
    </Canvas>
  );
}
