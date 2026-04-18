import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type SkiaVexflowContext from './SkiaVexflowContext';

export interface OnDrawParams {
  ctx: SkiaVexflowContext;
  width: number;
  height: number;
}

export interface VexflowCanvasProps {
  onDraw: (params: OnDrawParams) => void;
  fontManager: SkTypefaceFontProvider;
  defaultFont: string;
  // width?: number;
  // height?: number;
  // colorScheme?: 'light' | 'dark';
}
