import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type VexflowRecordingContext from './VexflowRecordingContext';

export interface OnDrawParams {
  ctx: VexflowRecordingContext;
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
