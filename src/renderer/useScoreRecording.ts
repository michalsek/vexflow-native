import { useMemo } from 'react';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { VexflowRecordingCommand } from '../base';
import VexflowRecordingContext from '../base/VexflowRecordingContext';
import {
  buildVexflowGroupIndex,
  type VexflowRecordingGroupIndex,
} from '../base/VexflowRecordingIndex';
import type { Score } from '../state';
import { isVexflowNativeDebugEnabled } from '../shared/debug';
import { layoutScore, type ScoreLayoutPlan } from './layout';
import { measureScore } from './measure';
import { renderScore } from './render';
import {
  createContentViewport,
  getRenderScale,
  scaleItemsLayoutToViewSpace,
} from './scale';
import type { ResolvedScoreColorScheme } from './colorScheme';
import type {
  RendererRect,
  RendererType,
  ScoreItemsLayout,
  ScoreOptions,
} from './types';

export interface ScoreRecording {
  /** Recorded draw commands, content-space coordinates. */
  commands: readonly VexflowRecordingCommand[];
  /**
   * `commands` bucketed by `groupId` so a style-override replay can redraw
   * just the overridden items instead of the whole recording.
   */
  groupIndex: VexflowRecordingGroupIndex;
  /**
   * Layout plan in content space; multiply its `contentSize` by the render
   * scale for the view-space size that drives scrolling.
   */
  layoutPlan: ScoreLayoutPlan;
  /** Emitted geometry, already converted to view space. */
  itemsLayout: ScoreItemsLayout;
}

export function useScoreRecording({
  defaultFont,
  enabled = true,
  fontManager,
  colorScheme,
  options,
  rendererType,
  score,
  viewport,
}: {
  defaultFont: string;
  enabled?: boolean;
  fontManager: SkTypefaceFontProvider;
  colorScheme: ResolvedScoreColorScheme;
  options: ScoreOptions;
  rendererType: RendererType;
  score: Score;
  viewport: RendererRect;
}): ScoreRecording {
  return useMemo(() => {
    if (!enabled) {
      return {
        commands: [],
        groupIndex: {},
        layoutPlan: createEmptyLayoutPlan(rendererType, viewport),
        itemsLayout: createEmptyItemsLayout(viewport),
      };
    }

    // Layout, measure and render run in content space against the virtual
    // viewport; see src/renderer/scale.ts.
    const scale = getRenderScale(options);
    const contentViewport = createContentViewport(viewport, scale);

    const measureStart = nowMs();
    const ctx = new VexflowRecordingContext(
      fontManager,
      defaultFont,
      colorScheme
    );
    const measuredScore = measureScore(score, options);
    const measureMs = nowMs() - measureStart;

    const layoutStart = nowMs();
    const layoutPlan = layoutScore(
      score,
      measuredScore,
      options,
      rendererType,
      contentViewport
    );
    const layoutMs = nowMs() - layoutStart;

    const renderStart = nowMs();
    const itemsLayout = scaleItemsLayoutToViewSpace(
      renderScore(ctx, score, layoutPlan, options),
      scale
    );
    const renderMs = nowMs() - renderStart;

    const finishStart = nowMs();
    const commands = ctx.finish();
    const groupIndex = buildVexflowGroupIndex(commands);
    const finishMs = nowMs() - finishStart;

    logScoreRecordingProfile({
      commandCount: commands.length,
      groupCount: Object.keys(groupIndex).length,
      contentSize: layoutPlan.contentSize,
      finishMs,
      layoutMs,
      measureCount: layoutPlan.measures.length,
      measureMs,
      renderMs,
      rendererType,
      scoreId: score.id,
      systemCount: layoutPlan.systems.length,
      viewport,
    });

    return {
      commands,
      groupIndex,
      layoutPlan,
      itemsLayout,
    };
  }, [
    colorScheme,
    defaultFont,
    enabled,
    fontManager,
    options,
    rendererType,
    score,
    viewport,
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

function logScoreRecordingProfile({
  commandCount,
  groupCount,
  contentSize,
  finishMs,
  layoutMs,
  measureCount,
  measureMs,
  renderMs,
  rendererType,
  scoreId,
  systemCount,
  viewport,
}: {
  commandCount: number;
  groupCount: number;
  contentSize: { height: number; width: number };
  finishMs: number;
  layoutMs: number;
  measureCount: number;
  measureMs: number;
  renderMs: number;
  rendererType: RendererType;
  scoreId: string;
  systemCount: number;
  viewport: RendererRect;
}) {
  if (!isVexflowNativeDebugEnabled()) {
    return;
  }

  console.info('[ScoreRenderer] recording profile', {
    scoreId,
    rendererType,
    viewport,
    contentSize,
    measureCount,
    systemCount,
    commandCount,
    groupCount,
    measureMs: roundMs(measureMs),
    layoutMs: roundMs(layoutMs),
    renderMs: roundMs(renderMs),
    finishMs: roundMs(finishMs),
    totalMs: roundMs(measureMs + layoutMs + renderMs + finishMs),
  });
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}
