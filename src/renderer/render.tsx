import { Formatter, Stave, StaveConnector, Voice as VFVoice } from 'vexflow';
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
  indexAttachmentsByOwner,
  makeVFVoice,
  noteheadWidth,
} from './scoreParsing';
import type { ScoreItemsLayout, ScoreOptions } from './types';
import type { VFVoiceNote } from './scoreParsing';

/**
 * Renders the score from a precomputed layout plan and returns the formatted
 * geometry of every rendered item and measure.
 */
export function renderScore(
  ctx: VexflowRecordingContext,
  score: Score,
  layoutPlan: ScoreLayoutPlan,
  options: ScoreOptions
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

interface RenderMeasureOptions {
  isFirstMeasureInSystem: boolean;
  isLastMeasureInSystem: boolean;
  fixedNoteSpacing: boolean;
}

/**
 * Re-positions every tick context at its time-proportional x inside the note
 * area, overriding the formatter's duration-weighted spacing. Runs after
 * `formatToStave` (the same post-format `setX` mechanism the formatter's own
 * tuning uses), so beams, tuplets and modifiers pick the final positions up
 * at draw time. The proportional span is clamped only by the LAST context's
 * width — with a spacer voice on the lattice that width is constant, so the
 * mapping stays a pure function of time.
 */
export function applyFixedNoteSpacing(
  formatter: Formatter,
  voices: VFVoice[],
  stave: Stave
) {
  const contexts = formatter.getTickContexts();
  const lastTick = contexts?.list[contexts.list.length - 1];

  if (
    !contexts ||
    voices.length === 0 ||
    lastTick === undefined ||
    lastTick <= 0
  ) {
    return;
  }

  const totalTicks = voices[0]?.getTotalTicks().value() ?? 0;

  if (!(totalTicks > 0)) {
    return;
  }

  // Tick context x is relative to noteStartX + the stave's left note padding
  // (see Tickable.getAbsoluteX), so the usable span ends at noteEndX. The
  // padding is derived from Stave statics because the `Metrics` module is not
  // re-exported by every vexflow build.
  const stavePadding = Stave.defaultPadding - Stave.rightPadding;
  const noteAreaWidth =
    stave.getNoteEndX() - stave.getNoteStartX() - stavePadding;
  let span = noteAreaWidth;

  const lastContext = contexts.map[lastTick]!;
  const lastOverflow =
    (lastTick / totalTicks) * span + lastContext.getWidth() - noteAreaWidth;

  if (lastOverflow > 0) {
    span -= (lastOverflow * totalTicks) / lastTick;
  }

  if (!(span > 0)) {
    return;
  }

  for (const tick of contexts.list) {
    contexts.map[tick]!.setX((tick / totalTicks) * span);
  }
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

      const voiceArtifacts = measure.voices.map((voice) => ({
        ...makeVFVoice(score, resolvedState.meter, resolvedState.clef, voice, {
          attachmentsByOwner,
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

      if (vfVoices.length > 1) {
        formatter.joinVoices(vfVoices);
      }

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
    const stave = new Stave(
      measurePlan.x,
      measurePlan.y + (measurePlan.staffYOffsets[staffIndex] ?? 0),
      measurePlan.width
    );

    if (measurePlan.measureIndex === 0 || measure.leftModifiers?.showClef) {
      stave.addClef(resolvedState.clef);
    }

    if (measure.leftModifiers?.showMeter === true) {
      stave.addTimeSignature(
        `${resolvedState.meter.beats}/${resolvedState.meter.beatUnit}`
      );
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
    // Format against the stave with the narrowest note area, so notes never
    // overrun a stave whose clef or time signature pushes its note start
    // further right.
    const referenceStave = getFormatReferenceStave(renderedStaves);
    formatter.formatToStave(allVoices, referenceStave);

    if (options.fixedNoteSpacing && referenceStave) {
      applyFixedNoteSpacing(formatter, allVoices, referenceStave);
    }
  }

  collectMeasureItemsLayout(
    itemsLayout,
    measurePlan,
    group.staves,
    renderedStaves,
    staffRenderArtifacts
  );

  staffRenderArtifacts.forEach(
    ({ vfVoices, voiceArtifacts, beams, tuplets }) => {
      vfVoices.forEach((voice) => voice.setRendered());
      voiceArtifacts.forEach(({ items, notes }) => {
        drawVoiceItems(ctx, items, notes);
      });
      beams.forEach((beam) => beam.setContext(ctx).draw());
      tuplets.forEach((tuplet) => tuplet.setContext(ctx).draw());
    }
  );
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
 * Records the formatted geometry of one measure; must run after
 * `formatToStave` because note positions are only final then. Emits one
 * measure entry per rendered stave, since note bounds differ per stave.
 */
function collectMeasureItemsLayout(
  itemsLayout: ScoreItemsLayout,
  measurePlan: MeasureLayoutPlan,
  staves: GroupLayoutContext['staves'],
  renderedStaves: Stave[],
  staffRenderArtifacts: StaffRenderArtifacts[]
) {
  staffRenderArtifacts.forEach(({ voiceArtifacts }) => {
    voiceArtifacts.forEach(({ items, notes }) => {
      items.forEach((item, index) => {
        const note = notes[index];

        if (!note) {
          return;
        }

        const x = note.getAbsoluteX();
        const width = note.getWidth();

        itemsLayout.items[item.id] = {
          x,
          width,
          headCenterX: resolveItemHeadCenterX(note, x, width),
          measureIndex: measurePlan.measureIndex,
        };
      });
    });
  });

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
    });
  });
}

/** Detected structurally because `GhostNote`s lack these getters. */
type NoteHeadSpan = {
  getNoteHeadBeginX?: () => number;
  getNoteHeadEndX?: () => number;
};

/**
 * Center of a formatted note's visual notehead span. When the getters are
 * missing (GhostNotes) the fallback is the center of a NOTIONAL notehead at
 * the block's left edge, capped by the block width — so a `spacer` rest
 * anchors where a real note's head would sit on the same tick, and external
 * UI aligned to it does not hop when the note appears. Zero-width `hidden`
 * rests keep anchoring at their tick x.
 */
export function resolveItemHeadCenterX(
  note: VFVoiceNote,
  x: number,
  width: number
): number {
  const { getNoteHeadBeginX, getNoteHeadEndX } = note as NoteHeadSpan;

  if (
    typeof getNoteHeadBeginX === 'function' &&
    typeof getNoteHeadEndX === 'function'
  ) {
    const center =
      (getNoteHeadBeginX.call(note) + getNoteHeadEndX.call(note)) / 2;

    if (Number.isFinite(center) && center > x && center <= x + width) {
      return center;
    }
  }

  return x + Math.min(width, noteheadWidth()) / 2;
}

function drawVoiceItems(
  ctx: VexflowRecordingContext,
  items: VoiceItem[],
  notes: VFVoiceNote[]
) {
  items.forEach((item, index) => {
    const note = notes[index];

    if (!note) {
      return;
    }

    ctx.beginColorGroup(item.id);

    try {
      note.setContext(ctx).drawWithStyle();
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
