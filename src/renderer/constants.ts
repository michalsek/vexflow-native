import type { ScoreInsets, ScoreSpacing, RenderOptions } from './types';

export const insets: ScoreInsets = {
  top: 24,
  right: 24,
  bottom: 24,
  left: 24,
};

export const spacing: ScoreSpacing = {
  systemGap: 64,
  staffGap: 96,
  groupGap: 56,
  minimumMeasureWidth: 60,
  measureHorizontalPadding: 0,
  staffHeight: 96,
  staffInnerVerticalPadding: 16,
};

export const renderOptions: RenderOptions = {
  pixelRatio: 1,
  scale: 1,
  debug: false,
};
