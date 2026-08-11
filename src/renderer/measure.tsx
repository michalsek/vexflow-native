import {
  Articulation as VFArticulation,
  Formatter,
  Stave,
  Voice as VFVoice,
} from 'vexflow';
import type { BoundingBox, RenderContext } from 'vexflow';
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
      const staffMeasurementContexts = staves.map((staff, staffIndex) => {
        const measure = staff.measures[measureIndex]!;
        const resolvedState = resolvedStatesByStaff[staffIndex]![measureIndex]!;
        measureNumbers.push(measure.number);

        const voiceArtifacts = measure.voices.map((voice) =>
          makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice, {
            attachmentsByOwner,
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
          showMeter: measure.leftModifiers?.showMeter === true,
          voiceArtifacts,
        };
      });

      try {
        // Intrinsic width = note width + widest left-modifier block. The left
        // modifiers (clef when shown, time signature when shown) occupy the
        // stave BEFORE its note-start x, so a measure needs room for both —
        // without the modifier term an empty measure with a time signature
        // measures ~0 wide and the signature clips in the infiniteScore /
        // documentEven layouts, which size measures from this value.
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

/** Probe stave width for left-modifier measurement — must comfortably exceed
 * any clef + time-signature block so `Stave.format()` never clamps it. */
const MODIFIER_PROBE_STAVE_WIDTH = 500;

/**
 * Widest per-staff left-modifier block (clef and/or time signature) of the
 * measure, in canvas points. Measured as the note-start-x delta between a
 * bare stave and one carrying the staff's shown modifiers, so staves without
 * modifiers contribute exactly 0 and the measured value excludes the bare
 * stave's own start padding.
 */
function measureLeftModifierWidth(
  staffMeasurementContexts: Array<{
    resolvedState: { clef: string; meter: { beats: number; beatUnit: number } };
    showClef: boolean;
    showMeter: boolean;
  }>
): number {
  return staffMeasurementContexts.reduce(
    (maxWidth, { resolvedState, showClef, showMeter }) => {
      if (!showClef && !showMeter) {
        return maxWidth;
      }

      const bareStave = new Stave(0, 0, MODIFIER_PROBE_STAVE_WIDTH);
      const modifiedStave = new Stave(0, 0, MODIFIER_PROBE_STAVE_WIDTH);

      if (showClef) {
        modifiedStave.addClef(resolvedState.clef);
      }

      if (showMeter) {
        modifiedStave.addTimeSignature(
          `${resolvedState.meter.beats}/${resolvedState.meter.beatUnit}`
        );
      }

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
  staffMeasurementContexts: Array<{
    ownerStaffId: string;
    staffIndex: number;
    measure: Staff['measures'][number];
    resolvedState: ReturnType<typeof buildResolvedMeasureStates>[number];
    showClef: boolean;
    showMeter: boolean;
    voiceArtifacts: ReturnType<typeof makeVFVoice>[];
  }>;
}): StaffVerticalBounds[] {
  const width = Math.max(intrinsicNoteWidth, 1);
  const renderedStaves = staffMeasurementContexts.map(
    ({ resolvedState, showClef, showMeter }) => {
      const stave = new Stave(0, 0, width);

      if (showClef) {
        stave.addClef(resolvedState.clef);
      }

      if (showMeter) {
        stave.addTimeSignature(
          `${resolvedState.meter.beats}/${resolvedState.meter.beatUnit}`
        );
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
          mergeArticulationBounds(bounds[ownerStaffIndex], note);
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

/**
 * No-op VexFlow render context for measurement-time drawing. A `Proxy` that
 * answers every method with a chainable no-op, so any context call VexFlow's
 * modifier `draw()` implementations make (today: `setFont` + `fillText` via
 * `Element.renderText`) is absorbed without rendering anything. Should a
 * VexFlow upgrade start calling a context method differently, the proxy keeps
 * absorbing it — the articulation-extent regression tests are the canary that
 * placement itself still measures correctly.
 */
function createNoopRenderContext(): RenderContext {
  const memo: Record<PropertyKey, unknown> = {};
  const proxy: object = new Proxy(memo, {
    get: (target, property) => {
      if (!(property in target)) {
        target[property] = () => proxy;
      }

      return target[property];
    },
  });

  return proxy as RenderContext;
}

const NOOP_RENDER_CONTEXT = createNoopRenderContext();

/**
 * Merges the TRUE drawn extents of a note's articulation modifiers into the
 * staff bounds. VexFlow only assigns an articulation's x/y (stacked text line,
 * stem-tip offset, staff-line snapping, origin shift) inside
 * `Articulation.draw()` — after formatting alone the modifier's bounding box
 * still sits at the origin, which is why note bounding boxes never grew when
 * accents were attached. Drawing against a no-op context runs exactly the
 * placement math `render.tsx`'s real draw will run (the measurement voices are
 * private to `measureScore`, so mutating them is contained), and afterwards
 * `getBoundingBox()` is the actual glyph box for placement above AND below,
 * including multi-articulation stacking.
 */
function mergeArticulationBounds(
  bounds: StaffVerticalBounds | undefined,
  note: VFVoiceNote
) {
  if (!bounds) {
    return;
  }

  for (const modifier of note.getModifiers()) {
    if (!(modifier instanceof VFArticulation)) {
      continue;
    }

    try {
      modifier.setContext(NOOP_RENDER_CONTEXT);
      modifier.draw();
      mergeBoundingBox(bounds, modifier.getBoundingBox());
    } catch {
      // Notes without formatted geometry (ghosts, spacers) cannot place
      // modifiers; note bounds still provide the conservative fallback.
    }
  }
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
