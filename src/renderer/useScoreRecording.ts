import { useMemo } from 'react';
import type { SkTypefaceFontProvider } from 'react-native-skia';

import type { VexflowRecordingCommand } from '../base';
import VexflowRecordingContext from '../base/VexflowRecordingContext';
import {
  buildVexflowGroupIndex,
  type VexflowRecordingGroupIndex,
} from '../base/VexflowRecordingIndex';
import type { Score } from '../state';
import { isVexflowNativeDebugEnabled } from '../shared/debug';
import {
  layoutScore,
  layoutUsesViewportHeight,
  type ScoreLayoutPlan,
} from './layout';
import { measureScore, type MeasuredScore } from './measure';
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
  ScoreItemHooks,
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
  // Measuring does not depend on the viewport and is the most expensive pass,
  // so it is cached apart from layout and render.
  const measurement = useMemo((): ScoreMeasurement | null => {
    if (!enabled) {
      return null;
    }

    const measureStart = nowMs();
    // On native, constructing a context installs it as VexFlow's text
    // measurement canvas, so text is measured with this font setup.
    // eslint-disable-next-line no-new
    new VexflowRecordingContext(fontManager, defaultFont);
    const measuredScore = measureScore(score, options, { decorateItem });

    return { measuredScore, measureMs: nowMs() - measureStart };
  }, [decorateItem, defaultFont, enabled, fontManager, options, score]);

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

    // Layout and render run in content space against the virtual viewport;
    // see src/renderer/scale.ts.
    const scale = getRenderScale(options);
    const contentViewport = createContentViewport(layoutViewport, scale);
    const ctx = new VexflowRecordingContext(
      fontManager,
      defaultFont,
      colorScheme
    );

    const layoutStart = nowMs();
    const layoutPlan = layoutScore(
      score,
      measurement.measuredScore,
      options,
      rendererType,
      contentViewport
    );
    const layoutMs = nowMs() - layoutStart;

    const renderStart = nowMs();
    const itemsLayout = scaleItemsLayoutToViewSpace(
      renderScore(ctx, score, layoutPlan, options, {
        decorateItem,
        onDrawItem,
      }),
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
      measurement,
      renderMs,
      rendererType,
      scoreId: score.id,
      systemCount: layoutPlan.systems.length,
      viewport: layoutViewport,
    });

    return {
      commands,
      groupIndex,
      layoutPlan,
      itemsLayout,
    };
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

interface ScoreMeasurement {
  measuredScore: MeasuredScore;
  measureMs: number;
}

/**
 * Measurements already counted by a profile line. A cached measurement is
 * reported once, by the first recording built on it, so summed profiles
 * count each measure pass once.
 */
const profiledMeasurements = new WeakSet<ScoreMeasurement>();

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
  measurement,
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
  measurement: ScoreMeasurement;
  renderMs: number;
  rendererType: RendererType;
  scoreId: string;
  systemCount: number;
  viewport: RendererRect;
}) {
  if (!isVexflowNativeDebugEnabled()) {
    return;
  }

  const measureMs = profiledMeasurements.has(measurement)
    ? 0
    : measurement.measureMs;
  profiledMeasurements.add(measurement);

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
