import { useMemo } from 'react';
import type { SkTypefaceFontProvider } from 'react-native-skia';

import type { Score } from '../state';
import type { ResolvedScoreColorScheme } from './colorScheme';
import {
  measureScoreRecording,
  recordScore,
  type ScoreRecording,
} from './engraveScore';
import { layoutUsesViewportHeight, type ScoreLayoutPlan } from './layout';
import type {
  RendererRect,
  RendererType,
  ScoreItemHooks,
  ScoreItemsLayout,
  ScoreOptions,
} from './types';

/** Memoised `engraveScore` pipeline for a mounted renderer. */
export function useScoreRecording({
  decorateItem,
  defaultFont,
  enabled = true,
  fontManager,
  colorScheme,
  onDrawItem,
  options,
  rendererType,
  score,
  viewport,
}: ScoreItemHooks & {
  defaultFont: string;
  enabled?: boolean;
  fontManager: SkTypefaceFontProvider;
  colorScheme: ResolvedScoreColorScheme;
  options: ScoreOptions;
  rendererType: RendererType;
  score: Score;
  viewport: RendererRect;
}): ScoreRecording {
  const measurement = useMemo(
    () =>
      enabled
        ? measureScoreRecording({
            score,
            options,
            fontManager,
            defaultFont,
            decorateItem,
          })
        : null,
    [decorateItem, defaultFont, enabled, fontManager, options, score]
  );

  // Height-only changes (a late safe-area inset, the keyboard) cannot move a
  // layout that ignores the height, so the height is pinned to 0 for it and
  // such a change keeps the recording.
  const layoutHeight =
    !measurement ||
    layoutUsesViewportHeight(rendererType, measurement.measuredScore)
      ? viewport.height
      : 0;
  const layoutViewport = useMemo(
    (): RendererRect => ({
      x: viewport.x,
      y: viewport.y,
      width: viewport.width,
      height: layoutHeight,
    }),
    [layoutHeight, viewport.width, viewport.x, viewport.y]
  );

  return useMemo(() => {
    if (!measurement) {
      return {
        commands: [],
        groupIndex: {},
        layoutPlan: createEmptyLayoutPlan(rendererType, layoutViewport),
        itemsLayout: createEmptyItemsLayout(layoutViewport),
      };
    }

    return recordScore({
      measurement,
      score,
      options,
      rendererType,
      viewport: layoutViewport,
      fontManager,
      defaultFont,
      colorScheme,
      decorateItem,
      onDrawItem,
    });
  }, [
    colorScheme,
    decorateItem,
    defaultFont,
    fontManager,
    layoutViewport,
    measurement,
    onDrawItem,
    options,
    rendererType,
    score,
  ]);
}

function createEmptyItemsLayout(viewport: RendererRect): ScoreItemsLayout {
  return {
    items: {},
    measures: [],
    contentSize: {
      width: viewport.width,
      height: viewport.height,
    },
  };
}

function createEmptyLayoutPlan(
  rendererType: RendererType,
  viewport: RendererRect
): ScoreLayoutPlan {
  return {
    rendererType,
    contentSize: {
      width: viewport.width,
      height: viewport.height,
    },
    systems: [],
    measures: [],
    groups: [],
  };
}
