import { useMemo } from 'react';
import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type { VexflowRecordingCommand } from '../base';
import VexflowRecordingContext from '../base/VexflowRecordingContext';
import type { Score } from '../state';
import { layoutScore, type ScoreLayoutPlan } from './layout';
import { measureScore } from './measure';
import { renderScore } from './render';
import type { ResolvedScoreColorScheme } from './colorScheme';
import type { RendererRect, RendererType, ScoreOptions } from './types';

export interface ScoreRecording {
  commands: readonly VexflowRecordingCommand[];
  layoutPlan: ScoreLayoutPlan;
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
        layoutPlan: createEmptyLayoutPlan(rendererType, viewport),
      };
    }

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
      viewport
    );
    const layoutMs = nowMs() - layoutStart;

    const renderStart = nowMs();
    renderScore(ctx, score, layoutPlan, options);
    const renderMs = nowMs() - renderStart;

    const finishStart = nowMs();
    const commands = ctx.finish();
    const finishMs = nowMs() - finishStart;

    logScoreRecordingProfile({
      commandCount: commands.length,
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
      layoutPlan,
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
  if (!isDevBuild()) {
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

function isDevBuild(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false;
  }

  return typeof __DEV__ === 'undefined' ? false : __DEV__;
}
