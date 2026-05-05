import type { ScoreInsets, ScoreSpacing, RenderOptions } from './types';

export const insets: ScoreInsets = {
  top: 24,
  right: 24,
  bottom: 24,
  left: 24,
};

export const spacing: ScoreSpacing = {
  staffGap: 96,
  minIntrinsicSizeMultiplier: 2,
};

export const renderOptions: RenderOptions = {
  pixelRatio: 1,
  scale: 1,
  debug: false,
};
