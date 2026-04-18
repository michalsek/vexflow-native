import { type useFont } from '@shopify/react-native-skia';

import type SkiaVexflowContext from '../SkiaVexflowContext';

export type VexflowCanvasDrawArgs = {
  ctx: SkiaVexflowContext;
  width: number;
  height: number;
};

export type VexflowCanvasProps = {
  onDraw: (args: VexflowCanvasDrawArgs) => void;
  font: Parameters<typeof useFont>[0];
  width?: number;
  height?: number;
  colorScheme?: 'light' | 'dark';
};
