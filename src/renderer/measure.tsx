import { Formatter, Voice as VFVoice } from 'vexflow';

import type { Score } from '../state';
import {
  buildResolvedMeasureStates,
  buildMeasurementGroups,
  makeVFVoice,
  resolveGroupStaves,
} from './scoreParsing';
import type { ScoreOptions } from './types';

export interface MeasuredMeasure {
  groupId: string;
  measureIndex: number;
  measureNumbers: number[];
  staffIds: string[];
  intrinsicNoteWidth: number;
}

export interface MeasuredScore {
  measures: MeasuredMeasure[];
  maxIntrinsicNoteWidth: number;
}

/**
 * Measures each staff group by building VexFlow voices and estimating note width.
 */
export function measureScore(
  score: Score,
  options: ScoreOptions
): MeasuredScore {
  const groups = buildMeasurementGroups(score);
  const measures: MeasuredMeasure[] = [];
  const {
    spacing: { minIntrinsicSizeMultiplier },
  } = options;

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
      const formatter = new Formatter();
      const allVoices: VFVoice[] = [];
      const measureNumbers: number[] = [];

      for (const [staffIndex, staff] of staves.entries()) {
        const measure = staff.measures[measureIndex]!;
        const resolvedState = resolvedStatesByStaff[staffIndex]![measureIndex]!;
        measureNumbers.push(measure.number);

        const vfVoices = measure.voices.map(
          (voice) =>
            makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice)
              .vfVoice
        );

        if (vfVoices.length > 1) {
          formatter.joinVoices(vfVoices);
        }

        allVoices.push(...vfVoices);
      }

      try {
        const intrinsicNoteWidth =
          allVoices.length > 0
            ? formatter.preCalculateMinTotalWidth(allVoices) *
              Math.max(1, minIntrinsicSizeMultiplier)
            : 0;

        measures.push({
          groupId: group.groupId,
          measureIndex,
          measureNumbers,
          staffIds: group.staffIds,
          intrinsicNoteWidth,
        });
      } catch (error) {
        throw new Error(
          `Error calculating intrinsic note width for group ${
            group.groupId
          }, measure index ${measureIndex}: ${(error as Error).message}`
        );
      }
    }
  }

  return {
    measures,
    maxIntrinsicNoteWidth: measures.reduce(
      (maxWidth, measure) => Math.max(maxWidth, measure.intrinsicNoteWidth),
      0
    ),
  };
}
