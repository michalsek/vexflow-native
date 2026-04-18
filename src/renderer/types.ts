import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { Score } from '../state';

export type RendererType = 'infiniteScore' | 'document' | 'documentEven';

export interface ScoreRendererProps {
  score: Score;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  rendererType?: RendererType;
  options?: Partial<ScoreOptions>;
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
  systemGap: number;
  staffGap: number;
  groupGap: number;
  minimumMeasureWidth: number;
  measureHorizontalPadding: number;
  staffHeight: number;
  staffInnerVerticalPadding: number;
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
