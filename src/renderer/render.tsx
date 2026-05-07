import { Formatter, Stave, StaveConnector, Voice as VFVoice } from 'vexflow';
import type { StaveConnectorType } from 'vexflow';

import type { VexflowRecordingContext } from '../base';
import type { Score, StaffGroupSymbol, VoiceItem } from '../state';
import type {
  GroupLayoutContext,
  MeasureLayoutPlan,
  ScoreLayoutPlan,
} from './layout';
import { makeVFVoice } from './scoreParsing';
import type { ScoreOptions } from './types';
import type { VFVoiceNote } from './scoreParsing';

/**
 * Renders the score from a precomputed layout plan.
 */
export function renderScore(
  ctx: VexflowRecordingContext,
  score: Score,
  layoutPlan: ScoreLayoutPlan,
  _options: ScoreOptions
) {
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

    for (const [measureIndex, measurePlan] of measurePlans.entries()) {
      renderMeasure(ctx, score, group, measurePlan, {
        isFirstMeasureInSystem: measureIndex === 0,
        isLastMeasureInSystem: measureIndex === measurePlans.length - 1,
      });
    }
  }
}

type StaffRenderArtifacts = {
  beams: Array<{
    setContext: (ctx: VexflowRecordingContext) => { draw: () => void };
  }>;
  voiceArtifacts: Array<{
    items: VoiceItem[];
    notes: VFVoiceNote[];
    ownerStaffId: string;
  }>;
  tuplets: Array<{
    setContext: (ctx: VexflowRecordingContext) => { draw: () => void };
  }>;
  vfVoices: VFVoice[];
};

interface RenderMeasureOptions {
  isFirstMeasureInSystem: boolean;
  isLastMeasureInSystem: boolean;
}

function renderMeasure(
  ctx: VexflowRecordingContext,
  score: Score,
  group: GroupLayoutContext,
  measurePlan: MeasureLayoutPlan,
  options: RenderMeasureOptions
) {
  const formatter = new Formatter();
  const resolvedStateByStaffId = new Map(
    group.staves.map((staff, staffIndex) => [
      staff.id,
      group.resolvedStatesByStaff[staffIndex]?.[measurePlan.measureIndex],
    ])
  );

  const staffRenderArtifacts: StaffRenderArtifacts[] = group.staves.map(
    (staff, staffIndex) => {
      const measure = staff.measures[measurePlan.measureIndex];
      const resolvedState =
        group.resolvedStatesByStaff[staffIndex]?.[measurePlan.measureIndex];

      if (!measure || !resolvedState) {
        return { vfVoices: [], voiceArtifacts: [], beams: [], tuplets: [] };
      }

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

      return {
        vfVoices,
        voiceArtifacts: voiceArtifacts.map(({ notes }, voiceIndex) => ({
          notes,
          items: measure.voices[voiceIndex]!.items,
          ownerStaffId: staff.id,
        })),
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
      measurePlan.y + (measurePlan.staffYOffsets[staffIndex] ?? 0),
      measurePlan.width
    );

    if (measurePlan.measureIndex === 0 || measure.leftModifiers?.showClef) {
      stave.addClef(resolvedState.clef);
    }

    stave.setContext(ctx).draw();
    return stave;
  });
  const renderedStaveByStaffId = new Map(
    group.staves.map((staff, staffIndex) => [
      staff.id,
      renderedStaves[staffIndex],
    ])
  );

  renderStaffConnectors(ctx, group, renderedStaves, options);

  staffRenderArtifacts.forEach(({ voiceArtifacts }) => {
    voiceArtifacts.forEach(({ items, notes, ownerStaffId }) => {
      items.forEach((item, index) => {
        const targetStave =
          renderedStaveByStaffId.get(item.targetStaffId ?? ownerStaffId) ??
          renderedStaveByStaffId.get(ownerStaffId);

        if (targetStave) {
          notes[index]?.setStave(targetStave);
        }
      });
    });
  });

  if (allVoices.length > 0) {
    formatter.formatToStave(allVoices, renderedStaves[0]!);
  }

  staffRenderArtifacts.forEach(({ vfVoices, beams, tuplets }) => {
    vfVoices.forEach((voice) => voice.draw(ctx));
    beams.forEach((beam) => beam.setContext(ctx).draw());
    tuplets.forEach((tuplet) => tuplet.setContext(ctx).draw());
  });
}

function renderStaffConnectors(
  ctx: VexflowRecordingContext,
  group: GroupLayoutContext,
  renderedStaves: Stave[],
  options: RenderMeasureOptions
) {
  if (!group.staffGroup || renderedStaves.length < 2) {
    return;
  }

  const topStave = renderedStaves[0];
  const bottomStave = renderedStaves[renderedStaves.length - 1];

  if (!topStave || !bottomStave) {
    return;
  }

  const connectorSymbol = resolveStaffGroupConnectorSymbol(group);

  if (options.isFirstMeasureInSystem && connectorSymbol) {
    drawStaveConnector(
      ctx,
      topStave,
      bottomStave,
      connectorSymbolToVFType(connectorSymbol)
    );
  }

  drawStaveConnector(
    ctx,
    topStave,
    bottomStave,
    requireStaveConnectorType(StaveConnector.type.SINGLE_LEFT)
  );

  if (options.isLastMeasureInSystem) {
    drawStaveConnector(
      ctx,
      topStave,
      bottomStave,
      requireStaveConnectorType(StaveConnector.type.SINGLE_RIGHT)
    );
  }
}

function resolveStaffGroupConnectorSymbol(
  group: GroupLayoutContext
): Exclude<StaffGroupSymbol, 'line'> | undefined {
  if (group.staffGroup?.symbol === 'line') {
    return undefined;
  }

  if (group.staffGroup?.symbol) {
    return group.staffGroup.symbol;
  }

  return group.staffGroup?.role === 'grandStaff' ? 'brace' : 'bracket';
}

function connectorSymbolToVFType(symbol: Exclude<StaffGroupSymbol, 'line'>) {
  return symbol === 'brace'
    ? requireStaveConnectorType(StaveConnector.type.BRACE)
    : requireStaveConnectorType(StaveConnector.type.BRACKET);
}

function drawStaveConnector(
  ctx: VexflowRecordingContext,
  topStave: Stave,
  bottomStave: Stave,
  type: StaveConnectorType
) {
  new StaveConnector(topStave, bottomStave)
    .setType(type)
    .setContext(ctx)
    .draw();
}

function requireStaveConnectorType(
  type: Exclude<StaveConnectorType, string> | undefined
): StaveConnectorType {
  if (typeof type !== 'number') {
    throw new Error('Expected VexFlow StaveConnector type constant');
  }

  return type;
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
