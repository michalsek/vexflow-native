import {
  Canvas,
  Picture,
  Skia,
  useFont,
  type SkFont,
  type SkPicture,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Element } from 'vexflow';
import { Text, useWindowDimensions } from 'react-native';

import SkiaVexflowContext from './SkiaVexflowContext';
import { VEXFLOW_SCORE_COLORS } from './constants';
import { createFont, getAdvanceWidth, parseCssFontShorthand } from './utils';

const CANVAS_HEIGHT = 180;

export type VexflowCanvasDrawArgs = {
  ctx: SkiaVexflowContext;
  width: number;
  height: number;
};

type VexflowCanvasProps = {
  onDraw: (args: VexflowCanvasDrawArgs) => void;
  font: Parameters<typeof useFont>[0];
  width?: number;
  height?: number;
  colorScheme?: 'light' | 'dark';
};

const fontName = 'vexflowFont';

function createTextMeasurementCanvas(skiaFont: SkFont | null) {
  let currentFont = createFont(12, fontName, skiaFont);

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
        currentFont = createFont(parsed.sizePx, parsed.family, skiaFont);
      } catch {
        currentFont = createFont(12, fontName, skiaFont);
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
  skiaFont: SkFont | null,
  scoreColors: {
    fill: string;
    stroke: string;
  }
): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

  const ctx = new SkiaVexflowContext(canvas, skiaFont, {
    defaultFillStyle: scoreColors.fill,
    defaultStrokeStyle: scoreColors.stroke,
  });

  onDraw({ ctx, width, height });

  return recorder.finishRecordingAsPicture();
}

export default function VexflowCanvas({
  onDraw,
  font,
  width,
  height = CANVAS_HEIGHT,
  colorScheme = 'light',
}: VexflowCanvasProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scoreColors =
    colorScheme === 'dark'
      ? VEXFLOW_SCORE_COLORS.dark
      : VEXFLOW_SCORE_COLORS.light;

  const canvasWidth = width ?? Math.max(300, Math.floor(windowWidth) - 32);
  const skiaFont = useFont(font, 30);

  const pictureInfo = useMemo(() => {
    if (!skiaFont) {
      return null;
    }

    Element.setTextMeasurementCanvas(
      createTextMeasurementCanvas(skiaFont) as unknown as HTMLCanvasElement
    );

    const picture = createVexflowPicture(
      canvasWidth,
      height,
      onDraw,
      skiaFont,
      scoreColors
    );

    return { picture, width: canvasWidth, height };
  }, [skiaFont, canvasWidth, height, onDraw, scoreColors]);

  if (!pictureInfo) {
    return <Text>Loading font...</Text>;
  }

  return (
    <Canvas style={{ width: pictureInfo.width, height: pictureInfo.height }}>
      <Picture picture={pictureInfo.picture} />
    </Canvas>
  );
}
