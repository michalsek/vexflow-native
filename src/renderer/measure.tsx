import { Formatter, Stave, Voice as VFVoice } from 'vexflow';
import { Platform } from 'react-native';

import {
  ensureVexflowTextMeasurementCanvas,
  installVexflowReactNativeFallbacks,
} from '../base/setupVexflowReactNative';
import type { Score, Staff } from '../state';
import {
  buildResolvedMeasureStates,
  buildMeasurementGroups,
  indexAttachmentsByOwner,
  makeVFVoice,
  resolveGroupStaves,
} from './scoreParsing';
import {
  applyMeasureModifiers,
  resolveMeasureModifiers,
} from './measureModifiers';
import { mergeNoteBounds, mergeY } from './measureBounds';
import { applyStaffLines } from './stave';
import type { ScoreOptions } from './types';
import type { StaffVerticalBounds } from './measureBounds';
import type { ResolvedMeasureModifiers } from './measureModifiers';
import type { ResolvedMeasureState } from './scoreParsing';
import {
  VEXFLOW_STAVE_BOTTOM_LINE_OFFSET,
  VEXFLOW_STAVE_TOP_LINE_OFFSET,
} from './Layout/LayoutMetrics';

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

interface StaffMeasurementContext {
  ownerStaffId: string;
  staffIndex: number;
  staff: Staff;
  measure: Staff['measures'][number];
  resolvedState: ResolvedMeasureState;
  modifiers: ResolvedMeasureModifiers;
  voiceArtifacts: ReturnType<typeof makeVFVoice>[];
}

/**
 * Measures each staff group by building VexFlow voices and estimating note width.
 */
export function measureScore(
  score: Score,
  options: ScoreOptions
): MeasuredScore {
  const groups = buildMeasurementGroups(score);
  const attachmentsByOwner = indexAttachmentsByOwner(score);
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
      const staffMeasurementContexts = staves.map(
        (staff, staffIndex): StaffMeasurementContext => {
          const measure = staff.measures[measureIndex]!;
          const resolvedState =
            resolvedStatesByStaff[staffIndex]![measureIndex]!;
          measureNumbers.push(measure.number);

          const voiceArtifacts = measure.voices.map((voice) =>
            makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice, {
              attachmentsByOwner,
              staff,
              resolveClef: (item) =>
                item.targetStaffId
                  ? resolvedStateByStaffId.get(item.targetStaffId)?.clef ??
                    resolvedState.clef
                  : resolvedState.clef,
            })
          );
          const vfVoices = voiceArtifacts.map(({ vfVoice }) => vfVoice);

          formatter.joinVoices(vfVoices);
          allVoices.push(...vfVoices);

          return {
            ownerStaffId: staff.id,
            staffIndex,
            staff,
            measure,
            resolvedState,
            modifiers: resolveMeasureModifiers(measure, measureIndex),
            voiceArtifacts,
          };
        }
      );

      try {
        // Clef and time signature sit before the note area, so the intrinsic
        // width must include them or an empty measure with a time signature
        // measures ~0 wide and the signature clips.
        const intrinsicNoteWidth =
          (allVoices.length > 0
            ? formatter.preCalculateMinTotalWidth(allVoices) *
              Math.max(1, minIntrinsicSizeMultiplier)
            : 0) + measureLeftModifierWidth(staffMeasurementContexts);
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

// Wide enough that VexFlow never clamps the modifier block on the probe stave.
const MODIFIER_PROBE_STAVE_WIDTH = 500;

/**
 * Widest left-modifier block of the measure, measured as the note-start delta
 * between a bare probe stave and one carrying the resolved modifiers.
 */
function measureLeftModifierWidth(
  staffMeasurementContexts: StaffMeasurementContext[]
): number {
  return staffMeasurementContexts.reduce(
    (maxWidth, { resolvedState, modifiers }) => {
      const { showClef, showMeter, showKeySignature, startBarline } = modifiers;

      if (
        !showClef &&
        !showMeter &&
        !showKeySignature &&
        startBarline === 'single'
      ) {
        return maxWidth;
      }

      const bareStave = new Stave(0, 0, MODIFIER_PROBE_STAVE_WIDTH);
      const modifiedStave = applyMeasureModifiers(
        new Stave(0, 0, MODIFIER_PROBE_STAVE_WIDTH),
        modifiers,
        resolvedState
      );

      return Math.max(
        maxWidth,
        modifiedStave.getNoteStartX() - bareStave.getNoteStartX()
      );
    },
    0
  );
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
  staffMeasurementContexts: StaffMeasurementContext[];
}): StaffVerticalBounds[] {
  const width = Math.max(intrinsicNoteWidth, 1);
  const renderedStaves = staffMeasurementContexts.map(
    ({ resolvedState, modifiers, staff }) =>
      applyMeasureModifiers(
        applyStaffLines(new Stave(0, 0, width), staff.lines),
        modifiers,
        resolvedState
      )
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

      formatter.joinVoices(vfVoices);

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
