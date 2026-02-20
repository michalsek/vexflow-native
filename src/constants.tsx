import { type SkFont, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import { type LineCap, type LineJoin } from './types';

export const PT_TO_PX = 4 / 3;

export const VEXFLOW_SCORE_COLORS = {
  light: {
    fill: '#111827',
    stroke: '#111827',
  },
  dark: {
    fill: '#F9FAFB',
    stroke: '#F9FAFB',
  },
} as const;

export const DEFAULT_FILL_STYLE = VEXFLOW_SCORE_COLORS.light.fill;
export const DEFAULT_STROKE_STYLE = VEXFLOW_SCORE_COLORS.light.stroke;
export const DEFAULT_LINE_WIDTH = 1;
export const DEFAULT_FONT = '12px Bravura';

export const LINE_CAP_MAP: Record<LineCap, StrokeCap> = {
  butt: StrokeCap.Butt,
  round: StrokeCap.Round,
  square: StrokeCap.Square,
};

export const LINE_JOIN_MAP: Record<LineJoin, StrokeJoin> = {
  miter: StrokeJoin.Miter,
  round: StrokeJoin.Round,
  bevel: StrokeJoin.Bevel,
};

export const fontCache = new Map<string, SkFont>();
