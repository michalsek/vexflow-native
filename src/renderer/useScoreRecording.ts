import { useMemo } from 'react';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { VexflowRecordingCommand } from '../base';
import VexflowRecordingContext from '../base/VexflowRecordingContext';
import type { Score } from '../state';
import { layoutScore, type ScoreLayoutPlan } from './layout';
import { measureScore } from './measure';
import { renderScore } from './render';
import type { RendererRect, RendererType, ScoreOptions } from './types';

export interface ScoreRecording {
  commands: readonly VexflowRecordingCommand[];
  layoutPlan: ScoreLayoutPlan;
}

export function useScoreRecording({
  defaultFont,
  fontManager,
  options,
  rendererType,
  score,
  viewport,
}: {
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  options: ScoreOptions;
  rendererType: RendererType;
  score: Score;
  viewport: RendererRect;
}): ScoreRecording {
  return useMemo(() => {
    const ctx = new VexflowRecordingContext(fontManager, defaultFont);
    const measuredScore = measureScore(score, options);
    const layoutPlan = layoutScore(
      score,
      measuredScore,
      options,
      rendererType,
      viewport
    );

    renderScore(ctx, score, layoutPlan, options);

    return {
      commands: ctx.finish(),
      layoutPlan,
    };
  }, [defaultFont, fontManager, options, rendererType, score, viewport]);
}
