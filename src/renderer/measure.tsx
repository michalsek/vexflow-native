import { Formatter, Stave, Voice as VFVoice } from 'vexflow';
import type { BoundingBox } from 'vexflow';
import { Platform } from 'react-native';

import {
  ensureVexflowTextMeasurementCanvas,
  installVexflowReactNativeFallbacks,
} from '../base/setupVexflowReactNative';
import type { Score, Staff } from '../state';
import {
  buildResolvedMeasureStates,
  buildMeasurementGroups,
  makeVFVoice,
  resolveGroupStaves,
} from './scoreParsing';
import type { ScoreOptions } from './types';
import type { VFVoiceNote } from './scoreParsing';
import {
  VEXFLOW_STAVE_BOTTOM_LINE_OFFSET,
  VEXFLOW_STAVE_TOP_LINE_OFFSET,
} from './Layout/LayoutMetrics';

export interface StaffVerticalBounds {
  top: number;
  bottom: number;
}

export interface MeasuredMeasure {
  groupId: string;
  measureIndex: number;
  measureNumbers: number[];
  staffIds: string[];
  staffBounds: StaffVerticalBounds[];
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

  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    installVexflowReactNativeFallbacks();
  }
  ensureVexflowTextMeasurementCanvas();

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
      const resolvedStateByStaffId = new Map(
        staves.map((staff, staffIndex) => [
          staff.id,
          resolvedStatesByStaff[staffIndex]?.[measureIndex],
        ])
      );
      const staffMeasurementContexts = staves.map((staff, staffIndex) => {
        const measure = staff.measures[measureIndex]!;
        const resolvedState = resolvedStatesByStaff[staffIndex]![measureIndex]!;
        measureNumbers.push(measure.number);

        const voiceArtifacts = measure.voices.map((voice) =>
          makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice, {
            resolveClef: (item) =>
              item.targetStaffId
                ? resolvedStateByStaffId.get(item.targetStaffId)?.clef ??
                  resolvedState.clef
                : resolvedState.clef,
          })
        );
        const vfVoices = voiceArtifacts.map(({ vfVoice }) => vfVoice);

        if (vfVoices.length > 1) {
          formatter.joinVoices(vfVoices);
        }

        allVoices.push(...vfVoices);

        return {
          ownerStaffId: staff.id,
          staffIndex,
          measure,
          resolvedState,
          showClef:
            measureIndex === 0 || Boolean(measure.leftModifiers?.showClef),
          voiceArtifacts,
        };
      });

      try {
        const intrinsicNoteWidth =
          allVoices.length > 0
            ? formatter.preCalculateMinTotalWidth(allVoices) *
              Math.max(1, minIntrinsicSizeMultiplier)
            : 0;
        const staffBounds = measureStaffVerticalBounds({
          allVoices,
          intrinsicNoteWidth,
          staves,
          staffMeasurementContexts,
        });

        measures.push({
          groupId: group.groupId,
          measureIndex,
          measureNumbers,
          staffIds: group.staffIds,
          staffBounds,
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

function measureStaffVerticalBounds({
  allVoices,
  intrinsicNoteWidth,
  staves,
  staffMeasurementContexts,
}: {
  allVoices: VFVoice[];
  intrinsicNoteWidth: number;
  staves: Staff[];
  staffMeasurementContexts: Array<{
    ownerStaffId: string;
    staffIndex: number;
    measure: Staff['measures'][number];
    resolvedState: ReturnType<typeof buildResolvedMeasureStates>[number];
    showClef: boolean;
    voiceArtifacts: ReturnType<typeof makeVFVoice>[];
  }>;
}): StaffVerticalBounds[] {
  const width = Math.max(intrinsicNoteWidth, 1);
  const renderedStaves = staffMeasurementContexts.map(
    ({ resolvedState, showClef }) => {
      const stave = new Stave(0, 0, width);

      if (showClef) {
        stave.addClef(resolvedState.clef);
      }

      return stave;
    }
  );
  const staffIndexById = new Map(
    staves.map((staff, staffIndex) => [staff.id, staffIndex])
  );
  const bounds = renderedStaves.map((stave) => ({
    top: Math.min(VEXFLOW_STAVE_TOP_LINE_OFFSET, stave.getTopLineTopY()),
    bottom: Math.max(
      VEXFLOW_STAVE_BOTTOM_LINE_OFFSET,
      stave.getBottomLineBottomY()
    ),
  }));
  const formatter = new Formatter();

  staffMeasurementContexts.forEach(
    ({ measure, ownerStaffId, staffIndex, voiceArtifacts }) => {
      const vfVoices = voiceArtifacts.map(({ vfVoice }) => vfVoice);

      if (vfVoices.length > 1) {
        formatter.joinVoices(vfVoices);
      }

      voiceArtifacts.forEach(({ notes }, voiceIndex) => {
        const items = measure.voices[voiceIndex]?.items ?? [];

        notes.forEach((note, noteIndex) => {
          const ownerStaffIndex =
            staffIndexById.get(
              items[noteIndex]?.targetStaffId ?? ownerStaffId
            ) ?? staffIndex;
          const stave = renderedStaves[ownerStaffIndex];

          if (stave) {
            note.setStave(stave);
          }
        });
      });
    }
  );

  if (allVoices.length > 0 && renderedStaves[0]) {
    formatter.formatToStave(allVoices, renderedStaves[0]);
  }

  staffMeasurementContexts.forEach(
    ({ measure, ownerStaffId, staffIndex, voiceArtifacts }) => {
      voiceArtifacts.forEach(({ beams, notes, tuplets }, voiceIndex) => {
        const items = measure.voices[voiceIndex]?.items ?? [];

        beams.forEach((beam) => {
          try {
            beam.postFormat();
          } catch {
            // Some VexFlow beam variants require draw-time context; note bounds
            // still give us a conservative staff extent fallback.
          }
        });

        notes.forEach((note, noteIndex) => {
          const ownerStaffIndex =
            staffIndexById.get(
              items[noteIndex]?.targetStaffId ?? ownerStaffId
            ) ?? staffIndex;
          mergeNoteBounds(bounds[ownerStaffIndex], note);
        });

        beams.forEach((beam) => {
          try {
            const beamY = beam.getBeamYToDraw();
            mergeY(bounds[staffIndex], beamY - 8);
            mergeY(bounds[staffIndex], beamY + 8);
          } catch {
            // Beam y is unavailable until VexFlow has enough note geometry.
          }
        });

        tuplets.forEach((tuplet) => {
          try {
            const tupletY = tuplet.getYPosition();
            mergeY(bounds[staffIndex], tupletY - 16);
            mergeY(bounds[staffIndex], tupletY + 8);
          } catch {
            // Tuplet y is unavailable until VexFlow has enough note geometry.
          }
        });
      });
    }
  );

  return bounds;
}

function mergeNoteBounds(
  bounds: StaffVerticalBounds | undefined,
  note: VFVoiceNote
) {
  if (!bounds) {
    return;
  }

  try {
    mergeBoundingBox(bounds, note.getBoundingBox());
  } catch {
    // Ghost notes and spacers may not expose useful boxes.
  }
}

function mergeBoundingBox(bounds: StaffVerticalBounds, box: BoundingBox) {
  mergeY(bounds, box.getY());
  mergeY(bounds, box.getY() + box.getH());
}

function mergeY(bounds: StaffVerticalBounds | undefined, y: number) {
  if (!bounds || !Number.isFinite(y)) {
    return;
  }

  bounds.top = Math.min(bounds.top, y);
  bounds.bottom = Math.max(bounds.bottom, y);
}
