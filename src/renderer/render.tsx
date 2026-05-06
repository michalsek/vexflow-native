import { Formatter, Stave, Voice as VFVoice } from 'vexflow';

import type { VexflowRecordingContext } from '../base';
import type { Score } from '../state';
import type {
  GroupLayoutContext,
  MeasureLayoutPlan,
  ScoreLayoutPlan,
} from './layout';
import { makeVFVoice } from './scoreParsing';
import type { ScoreOptions } from './types';

/**
 * Renders the score from a precomputed layout plan.
 */
export function renderScore(
  ctx: VexflowRecordingContext,
  score: Score,
  layoutPlan: ScoreLayoutPlan,
  options: ScoreOptions
) {
  const staffGap = options.spacing.staffGap;
  const groupsById = new Map(
    layoutPlan.groups.map((group) => [group.groupId, group])
  );
  const measuresByGroup = groupMeasuresByIndex(layoutPlan.measures);

  for (const system of layoutPlan.systems) {
    const group = groupsById.get(system.groupId);

    if (!group || group.staves.length === 0) {
      continue;
    }

    const measurePlans = system.measureIndices
      .map((measureIndex) =>
        measuresByGroup.get(system.groupId)?.get(measureIndex)
      )
      .filter((measure): measure is MeasureLayoutPlan => Boolean(measure));

    for (const measurePlan of measurePlans) {
      renderMeasure(ctx, score, group, measurePlan, staffGap);
    }
  }
}

type StaffRenderArtifacts = {
  beams: Array<{
    setContext: (ctx: VexflowRecordingContext) => { draw: () => void };
  }>;
  tuplets: Array<{
    setContext: (ctx: VexflowRecordingContext) => { draw: () => void };
  }>;
  vfVoices: VFVoice[];
};

function renderMeasure(
  ctx: VexflowRecordingContext,
  score: Score,
  group: GroupLayoutContext,
  measurePlan: MeasureLayoutPlan,
  staffGap: number
) {
  const formatter = new Formatter();

  const staffRenderArtifacts: StaffRenderArtifacts[] = group.staves.map(
    (staff, staffIndex) => {
      const measure = staff.measures[measurePlan.measureIndex];
      const resolvedState =
        group.resolvedStatesByStaff[staffIndex]?.[measurePlan.measureIndex];

      if (!measure || !resolvedState) {
        return { vfVoices: [], beams: [], tuplets: [] };
      }

      const voiceArtifacts = measure.voices.map((voice) =>
        makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice)
      );
      const vfVoices = voiceArtifacts.map(({ vfVoice }) => vfVoice);

      if (vfVoices.length > 1) {
        formatter.joinVoices(vfVoices);
      }

      return {
        vfVoices,
        beams: voiceArtifacts.flatMap(({ beams }) => beams),
        tuplets: voiceArtifacts.flatMap(({ tuplets }) => tuplets),
      };
    }
  );

  const allVoices = staffRenderArtifacts.flatMap(({ vfVoices }) => vfVoices);

  const renderedStaves = group.staves.map((staff, staffIndex) => {
    const measure = staff.measures[measurePlan.measureIndex]!;
    const resolvedState =
      group.resolvedStatesByStaff[staffIndex]![measurePlan.measureIndex]!;
    const stave = new Stave(
      measurePlan.x,
      measurePlan.y + staffIndex * staffGap,
      measurePlan.width
    );

    if (measurePlan.measureIndex === 0 || measure.leftModifiers?.showClef) {
      stave.addClef(resolvedState.clef);
    }

    stave.setContext(ctx).draw();
    return stave;
  });

  if (allVoices.length > 0) {
    formatter.formatToStave(allVoices, renderedStaves[0]!);
  }

  staffRenderArtifacts.forEach(({ vfVoices, beams, tuplets }, staffIndex) => {
    const stave = renderedStaves[staffIndex]!;
    vfVoices.forEach((voice) => voice.draw(ctx, stave));
    beams.forEach((beam) => beam.setContext(ctx).draw());
    tuplets.forEach((tuplet) => tuplet.setContext(ctx).draw());
  });
}

function groupMeasuresByIndex(measures: MeasureLayoutPlan[]) {
  const measuresByGroup = new Map<string, Map<number, MeasureLayoutPlan>>();

  for (const measure of measures) {
    const groupMeasures =
      measuresByGroup.get(measure.groupId) ??
      new Map<number, MeasureLayoutPlan>();

    groupMeasures.set(measure.measureIndex, measure);
    measuresByGroup.set(measure.groupId, groupMeasures);
  }

  return measuresByGroup;
}
