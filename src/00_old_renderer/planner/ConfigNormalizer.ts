import {
  DEFAULT_RENDERER_PADDING,
  DEFAULT_RENDERER_RENDER_OPTIONS,
  DEFAULT_RENDERER_SPACING,
} from '../constants';
import type { RendererConfig } from '../types';

import { stableSerialize } from './FingerprintUtils';
import type { NormalizedConfigResult } from './types';

export class ConfigNormalizer {
  normalize(config: RendererConfig): NormalizedConfigResult {
    const normalized = {
      layoutMode: 'infiniteScore' as const,
      viewport: config.viewport,
      padding: {
        ...DEFAULT_RENDERER_PADDING,
        ...config.padding,
      },
      spacing: {
        ...DEFAULT_RENDERER_SPACING,
        ...config.spacing,
      },
      render: {
        ...DEFAULT_RENDERER_RENDER_OPTIONS,
        ...config.render,
      },
    };

    const layoutFingerprint = stableSerialize({
      layoutMode: normalized.layoutMode,
      viewport: normalized.viewport,
      padding: normalized.padding,
      spacing: normalized.spacing,
    });
    const renderFingerprint = stableSerialize(normalized.render);

    return {
      config: normalized,
      fingerprint: stableSerialize({
        layoutFingerprint,
        renderFingerprint,
      }),
      layoutFingerprint,
      renderFingerprint,
      measureWidthFingerprint: stableSerialize({
        minimumMeasureWidth: normalized.spacing.minimumMeasureWidth,
      }),
      horizontalLayoutFingerprint: stableSerialize({
        left: normalized.padding.left,
      }),
      verticalLayoutFingerprint: stableSerialize({
        top: normalized.padding.top,
        staffGap: normalized.spacing.staffGap,
        groupGap: normalized.spacing.groupGap,
        staffHeight: normalized.spacing.staffHeight,
      }),
    };
  }
}
