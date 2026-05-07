import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { Score } from '../state';
import type { ScoreColorScheme } from './colorScheme';

export type RendererType = 'infiniteScore' | 'document' | 'documentEven';

export interface ScoreRendererProps {
  score: Score;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  colorScheme?: ScoreColorScheme;
  rendererType?: RendererType;
  options?: Partial<ScoreOptions>;
  scrollEnabled?: boolean;
  showScrollbars?: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ScoreInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ScoreSpacing {
  staffGap: number;
  minIntrinsicSizeMultiplier: number;
}

export interface RenderOptions {
  pixelRatio: number;
  scale: number;
  debug: boolean;
}

export interface ScoreOptions {
  spacing: ScoreSpacing;
  insets: ScoreInsets;
  render: RenderOptions;
}

export interface RendererPoint {
  x: number;
  y: number;
}

export interface RendererSize {
  width: number;
  height: number;
}

export interface RendererRect extends RendererPoint, RendererSize {}

export interface VisibleViewport extends RendererRect {}
