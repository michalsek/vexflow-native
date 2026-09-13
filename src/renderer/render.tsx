import { Formatter, Stave, StaveConnector } from 'vexflow';
import type { Voice as VFVoice } from 'vexflow';
import type { StaveConnectorType } from 'vexflow';

import type { VexflowRecordingContext } from '../base';
import type {
  NoteAttachment,
  Score,
  StaffGroupSymbol,
  VoiceItem,
} from '../state';
import type {
  GroupLayoutContext,
  MeasureLayoutPlan,
  ScoreLayoutPlan,
} from './layout';
import {
  applyMeasureModifiers,
  resolveMeasureModifiers,
} from './measureModifiers';
import { indexAttachmentsByOwner, makeVFVoice } from './scoreParsing';
import { applyFixedNoteSpacing } from './fixedNoteSpacing';
import { itemLayoutOf } from './itemLayout';
import { hasNoteHeads } from './noteModifiers';
import { applyStaffLines, visibleLineYs } from './stave';
import type { ScoreItemHooks, ScoreItemsLayout, ScoreOptions } from './types';
import type { VFVoiceNote } from './scoreParsing';

/**
 * Renders the score from a precomputed layout plan and returns the formatted
 * geometry of every rendered item and measure.
 */
export function renderScore(
  ctx: VexflowRecordingContext,
  score: Score,
  layoutPlan: ScoreLayoutPlan,
  options: ScoreOptions,
  hooks: ScoreItemHooks = {}
): ScoreItemsLayout {
  const groupsById = new Map(
    layoutPlan.groups.map((group) => [group.groupId, group])
  );
  const measuresByGroup = groupMeasuresByIndex(layoutPlan.measures);
  const attachmentsByOwner = indexAttachmentsByOwner(score);
  const itemsLayout: ScoreItemsLayout = {
    items: {},
    measures: [],
    contentSize: layoutPlan.contentSize,
  };

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
      renderMeasure(
        ctx,
        score,
        group,
        measurePlan,
        attachmentsByOwner,
        {
          isFirstMeasureInSystem: measureIndex === 0,
          isLastMeasureInSystem: measureIndex === measurePlans.length - 1,
          fixedNoteSpacing: options.render.fixedNoteSpacing,
          ...hooks,
        },
        itemsLayout
      );
    }
  }

  return itemsLayout;
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

interface RenderMeasureOptions extends ScoreItemHooks {
  isFirstMeasureInSystem: boolean;
  isLastMeasureInSystem: boolean;
  fixedNoteSpacing: boolean;
}

function renderMeasure(
  ctx: VexflowRecordingContext,
  score: Score,
  group: GroupLayoutContext,
  measurePlan: MeasureLayoutPlan,
  attachmentsByOwner: Map<string, NoteAttachment[]>,
  options: RenderMeasureOptions,
  itemsLayout: ScoreItemsLayout
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

      const voiceArtifacts = measure.voices.map((voice, voiceIndex) => ({
        ...makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice, {
          attachmentsByOwner,
          staff,
          directions: voiceIndex === 0 ? measure.directions : undefined,
          itemContext: options.decorateItem
            ? {
                decorateItem: options.decorateItem,
                staff,
                measureIndex: measurePlan.measureIndex,
              }
            : undefined,
          resolveClef: (item) =>
            item.targetStaffId
              ? resolvedStateByStaffId.get(item.targetStaffId)?.clef ??
                resolvedState.clef
              : resolvedState.clef,
        }),
        items: voice.items,
        ownerStaffId: staff.id,
      }));
      const vfVoices = voiceArtifacts.map(({ vfVoice }) => vfVoice);

      formatter.joinVoices(vfVoices);

      return {
        vfVoices,
        voiceArtifacts: voiceArtifacts.map(
          ({ items, notes, ownerStaffId }) => ({
            notes,
            items,
            ownerStaffId,
          })
        ),
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
    const stave = applyStaffLines(
      new Stave(
        measurePlan.x,
        measurePlan.y + (measurePlan.staffYOffsets[staffIndex] ?? 0),
        measurePlan.width
      ),
      staff.lines
    );

    applyMeasureModifiers(
      stave,
      resolveMeasureModifiers(measure, measurePlan.measureIndex),
      resolvedState
    );
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
    // Format against the stave with the narrowest note area, so notes never
    // overrun a stave whose clef or time signature pushes its note start
    // further right.
    const referenceStave = getFormatReferenceStave(renderedStaves);
    formatter.formatToStave(allVoices, referenceStave);

    if (options.fixedNoteSpacing && referenceStave) {
      applyFixedNoteSpacing(formatter, allVoices, referenceStave);
    }
  }

  staffRenderArtifacts.forEach(
    ({ vfVoices, voiceArtifacts, beams, tuplets }) => {
      vfVoices.forEach((voice) => voice.setRendered());
      voiceArtifacts.forEach(({ items, notes }) => {
        drawVoiceItems(
          ctx,
          items,
          notes,
          measurePlan.measureIndex,
          itemsLayout,
          options.onDrawItem
        );
      });
      beams.forEach((beam) => beam.setContext(ctx).draw());
      tuplets.forEach((tuplet) => tuplet.setContext(ctx).draw());
    }
  );

  collectMeasureLayout(itemsLayout, measurePlan, group.staves, renderedStaves);
}

/**
 * The stave with the narrowest note area — formatting to it keeps notes
 * inside every stave of the group.
 */
function getFormatReferenceStave(renderedStaves: Stave[]): Stave {
  return renderedStaves.reduce((reference, stave) =>
    stave.getNoteStartX() > reference.getNoteStartX() ? stave : reference
  );
}

/**
 * Emits one measure entry per rendered stave, since note bounds differ per
 * stave.
 */
function collectMeasureLayout(
  itemsLayout: ScoreItemsLayout,
  measurePlan: MeasureLayoutPlan,
  staves: GroupLayoutContext['staves'],
  renderedStaves: Stave[]
) {
  staves.forEach((staff, staffIndex) => {
    const stave = renderedStaves[staffIndex];

    if (!stave) {
      return;
    }

    itemsLayout.measures.push({
      groupId: measurePlan.groupId,
      staffId: staff.id,
      measureIndex: measurePlan.measureIndex,
      systemIndex: measurePlan.systemIndex,
      x: measurePlan.x,
      width: measurePlan.width,
      staveNoteStartX: stave.getNoteStartX(),
      staveNoteEndX: stave.getNoteEndX(),
      y: measurePlan.y,
      height: measurePlan.height,
      staveLineTopY: stave.getTopLineTopY(),
      staveLineBottomY: stave.getBottomLineBottomY(),
      visibleLineYs: visibleLineYs(stave, staff.lines),
    });
  });
}

/**
 * Draws each item and records its formatted geometry; the layout entry is
 * taken after `draw()` because modifiers only take their position there.
 */
function drawVoiceItems(
  ctx: VexflowRecordingContext,
  items: VoiceItem[],
  notes: VFVoiceNote[],
  measureIndex: number,
  itemsLayout: ScoreItemsLayout,
  onDrawItem: ScoreItemHooks['onDrawItem']
) {
  items.forEach((item, index) => {
    const note = notes[index];

    if (!note) {
      return;
    }

    ctx.beginColorGroup(item.id);

    try {
      note.setContext(ctx).drawWithStyle();

      const layout = itemLayoutOf(note, measureIndex);

      itemsLayout.items[item.id] = layout;

      if (onDrawItem && hasNoteHeads(note)) {
        onDrawItem(ctx, item, note, layout);
      }
    } finally {
      ctx.endColorGroup();
    }
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
