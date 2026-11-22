import type { SkTypefaceFontProvider } from 'react-native-skia';

import type { VexflowRecordingCommand } from '../base';
import FontManager from '../base/FontManager';
import VexflowRecordingContext from '../base/VexflowRecordingContext';
import {
  buildVexflowGroupIndex,
  type VexflowRecordingGroupIndex,
} from '../base/VexflowRecordingIndex';
import type { Score } from '../state';
import { isVexflowNativeDebugEnabled } from '../shared/debug';
import {
  resolveScoreColorScheme,
  type ResolvedScoreColorScheme,
  type ScoreColorScheme,
} from './colorScheme';
import { layoutScore, type ScoreLayoutPlan } from './layout';
import { measureScore, type MeasuredScore } from './measure';
import { renderScore } from './render';
import {
  createContentViewport,
  getRenderScale,
  scaleItemsLayoutToViewSpace,
} from './scale';
import { withDefaultOptions } from './ScoreRenderer/utils';
import { coverDrawnExtents } from './systemExtents';
import type {
  RendererRect,
  RendererSize,
  RendererType,
  ScoreItemHooks,
  ScoreItemsLayout,
  ScoreOptions,
  ScoreRendererOptions,
} from './types';

export interface EngraveScoreParams extends ScoreItemHooks {
  score: Score;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  colorScheme?: ScoreColorScheme;
  options?: ScoreRendererOptions;
  /** Default `document`. */
  rendererType?: RendererType;
  /** View-space width the score is laid out against. */
  width: number;
  /**
   * View-space height. Only `infiniteScore`, which centers on it, and a
   * score without measures read it. Default 0.
   */
  height?: number;
}

/** One system of an engraving, in content space. */
export interface ScoreSystemLayout {
  groupId: string;
  /** Index within the staff group. */
  systemIndex: number;
  x: number;
  width: number;
  /**
   * `y`/`height` cover the system's layout band and everything drawn for it
   * (clefs, ledger lines, stems, modifiers, text), so clipping the commands
   * to this band cuts nothing off.
   */
  y: number;
  height: number;
  measureIndices: number[];
}

export interface ScoreEngraving {
  /**
   * Display list in content space (VexFlow units before `render.scale`);
   * replay it with `renderVexflowRecordingCommands`.
   */
  commands: readonly VexflowRecordingCommand[];
  /** Content space; multiply by `render.scale` for view space. */
  contentSize: RendererSize;
  /** Top to bottom per staff group. */
  systems: ScoreSystemLayout[];
  /** View space, the value `ScoreRenderer` passes to `onItemsLayout`. */
  itemsLayout: ScoreItemsLayout;
}

/**
 * Engraves a score to a display list without mounting a view, for print,
 * export or custom drawing. Same pipeline and output as `ScoreRenderer`.
 */
export function engraveScore({
  score,
  defaultFont,
  fontManager,
  colorScheme,
  options: userOptions = {},
  rendererType = 'document',
  width,
  height = 0,
  decorateItem,
  onDrawItem,
}: EngraveScoreParams): ScoreEngraving {
  const options = withDefaultOptions(userOptions);
  const { commands, layoutPlan, itemsLayout } = recordScore({
    measurement: measureScoreRecording({
      score,
      options,
      fontManager,
      defaultFont,
      decorateItem,
    }),
    score,
    options,
    rendererType,
    viewport: { x: 0, y: 0, width, height },
    fontManager,
    defaultFont,
    colorScheme: resolveScoreColorScheme(colorScheme),
    decorateItem,
    onDrawItem,
  });

  return {
    commands,
    contentSize: layoutPlan.contentSize,
    systems: coverDrawnExtents(
      layoutPlan.systems.map(
        (system): ScoreSystemLayout => ({
          groupId: system.groupId,
          systemIndex: system.systemIndex,
          x: system.x,
          width: system.width,
          y: system.y,
          height: system.height,
          measureIndices: system.measureIndices,
        })
      ),
      commands,
      new FontManager(fontManager, defaultFont)
    ),
    itemsLayout,
  };
}

export interface ScoreMeasurement {
  measuredScore: MeasuredScore;
  measureMs: number;
}

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

/**
 * The measuring pass. It does not depend on the viewport and is the most
 * expensive pass, so callers that re-layout cache it apart from
 * {@link recordScore}.
 */
export function measureScoreRecording({
  score,
  options,
  fontManager,
  defaultFont,
  decorateItem,
}: Pick<ScoreItemHooks, 'decorateItem'> & {
  score: Score;
  options: ScoreOptions;
  fontManager: SkTypefaceFontProvider;
  defaultFont: string;
}): ScoreMeasurement {
  const measureStart = nowMs();
  // On native, constructing a context installs it as VexFlow's text
  // measurement canvas, so text is measured with this font setup.
  // eslint-disable-next-line no-new
  new VexflowRecordingContext(fontManager, defaultFont);
  const measuredScore = measureScore(score, options, { decorateItem });

  return { measuredScore, measureMs: nowMs() - measureStart };
}

/** Layout and render passes; `viewport` is view space. */
export function recordScore({
  measurement,
  score,
  options,
  rendererType,
  viewport,
  fontManager,
  defaultFont,
  colorScheme,
  decorateItem,
  onDrawItem,
}: ScoreItemHooks & {
  measurement: ScoreMeasurement;
  score: Score;
  options: ScoreOptions;
  rendererType: RendererType;
  viewport: RendererRect;
  fontManager: SkTypefaceFontProvider;
  defaultFont: string;
  colorScheme: ResolvedScoreColorScheme;
}): ScoreRecording {
  // Layout and render run in content space against the virtual viewport;
  // see src/renderer/scale.ts.
  const scale = getRenderScale(options);
  const contentViewport = createContentViewport(viewport, scale);
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
    viewport,
  });

  return {
    commands,
    groupIndex,
    layoutPlan,
    itemsLayout,
  };
}

/**
 * Measurements already counted by a profile line. A cached measurement is
 * reported once, by the first recording built on it, so summed profiles
 * count each measure pass once.
 */
const profiledMeasurements = new WeakSet<ScoreMeasurement>();

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
