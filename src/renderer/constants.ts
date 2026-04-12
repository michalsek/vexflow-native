import type {
  NormalizedRendererRenderOptions,
  NormalizedRendererSpacingOptions,
  RendererInsets,
} from './types';

export const DEFAULT_RENDERER_PADDING: RendererInsets = {
  top: 24,
  right: 24,
  bottom: 24,
  left: 24,
};

export const DEFAULT_RENDERER_SPACING: NormalizedRendererSpacingOptions = {
  systemGap: 64,
  staffGap: 96,
  groupGap: 56,
  measureGap: 12,
  minimumMeasureWidth: 160,
  measureHorizontalPadding: 24,
  staffHeight: 96,
  staffInnerVerticalPadding: 16,
};

export const DEFAULT_RENDERER_RENDER_OPTIONS: NormalizedRendererRenderOptions =
  {
    pixelRatio: 1,
    scale: 1,
    debug: false,
  };
