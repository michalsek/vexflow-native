import { Formatter, Stave, Voice as VFVoice } from 'vexflow';

import type { SkiaVexflowContext } from '../base';
import type { Score } from '../state';
import type { MeasuredScore } from './measure';
import {
  buildResolvedMeasureStates,
  buildMeasurementGroups,
  makeVFVoice,
  resolveGroupStaves,
} from './scoreParsing';
import type { ScoreOptions } from './types';
import type { RendererType } from './types';

interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getSystemStartInViewport(
  viewport: Viewport,
  options: ScoreOptions,
  rendererType: RendererType,
  isGrandScore: boolean = false
) {
  if (rendererType !== 'infiniteScore') {
    return {
      systemX: viewport.x + options.insets.left,
      systemY: viewport.y + options.insets.top,
    };
  }

  const hallucinatedStaveHeight = isGrandScore ? 277.5 : 135;

  return {
    systemX: viewport.x + options.insets.left,
    systemY:
      (viewport.y +
        viewport.height -
        hallucinatedStaveHeight -
        options.spacing.staffGap) /
      2,
  };
}

/**
 * Renders the measured score by aligning each staff group's voices on shared staves.
 */
export function renderScore(
  ctx: SkiaVexflowContext,
  score: Score,
  measuredScore: MeasuredScore,
  options: ScoreOptions,
  rendererType: RendererType = 'document',
  viewport: { x: number; y: number; width: number; height: number }
) {
  const groups = buildMeasurementGroups(score);
  const { maxIntrinsicNoteWidth } = measuredScore;

  const staffGap = options.spacing.staffGap;
  let { systemX, systemY } = getSystemStartInViewport(
    viewport,
    options,
    rendererType,
    score.staves.length > 1
  );

  for (const group of groups) {
    const staves = resolveGroupStaves(score, group);

    if (staves.length === 0) {
      continue;
    }

    const measureCount = Math.min(
      ...staves.map((staff) => staff.measures.length)
    );

    const resolvedStatesByStaff = staves.map((staff) =>
      buildResolvedMeasureStates(score, staff)
    );

    for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
      const measured = measuredScore.measures.find(
        (measure) =>
          measure.groupId === group.groupId &&
          measure.measureIndex === measureIndex
      );

      if (!measured) {
        continue;
      }

      const noteWidth = Math.max(
        measured.intrinsicNoteWidth,
        maxIntrinsicNoteWidth
      );
      const formatter = new Formatter();

      const vfVoicesByStaff: VFVoice[][] = staves.map((staff, staffIndex) => {
        const measure = staff.measures[measureIndex]!;
        const resolvedState = resolvedStatesByStaff[staffIndex]![measureIndex]!;

        const vfVoices = measure.voices.map(
          (voice) =>
            makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice)
              .vfVoice
        );

        if (vfVoices.length > 1) {
          formatter.joinVoices(vfVoices);
        }

        return vfVoices;
      });

      const allVoices = vfVoicesByStaff.flat();

      const renderedStaves = staves.map((staff, index) => {
        const measure = staff.measures[measureIndex]!;
        const resolvedState = resolvedStatesByStaff[index]![measureIndex]!;
        const stave = new Stave(systemX, systemY + index * staffGap, noteWidth);

        if (measureIndex === 0 || measure.leftModifiers?.showClef) {
          stave.addClef(resolvedState.clef);
        }

        stave.setContext(ctx).draw();
        return stave;
      });

      formatter.formatToStave(allVoices, renderedStaves[0]!);

      vfVoicesByStaff.forEach((vfVoices, staffIndex) => {
        const stave = renderedStaves[staffIndex]!;
        vfVoices.forEach((voice) => voice.draw(ctx, stave));
      });

      systemX += noteWidth;
    }
  }
}
