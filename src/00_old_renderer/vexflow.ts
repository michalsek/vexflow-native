import {
  Accidental,
  BarlineType,
  Beam,
  Dot,
  Element,
  Formatter,
  Fraction,
  Stave,
  StaveConnector,
  StaveNote,
  Tuplet,
  Voice as VexflowVoice,
} from 'vexflow';

import type { Duration } from '../state';
import type {
  MeasureLayout,
  MeasurePlan,
  MeasureRange,
  NoteBounds,
  RenderRequest,
  RenderResult,
  RendererMeasure,
  RendererPlan,
  RendererRect,
  RendererVoiceItem,
} from './types';

import { getDurationInQuarterBeats } from './timing';

type VexflowTickable = InstanceType<typeof StaveNote>;

interface TickableEntry {
  voiceId: string;
  voiceItemId: string;
  measureId: string;
  staffId: string;
  measureIndex: number;
  globalMeasureIndex: number;
  pageIndex: number;
  systemIndex: number;
  staffIndex: number;
  startBeat: number;
  endBeat: number;
  tickable: VexflowTickable;
}

interface VoiceRenderData {
  voice: InstanceType<typeof VexflowVoice>;
  tickables: TickableEntry[];
  beams: InstanceType<typeof Beam>[];
  tuplets: InstanceType<typeof Tuplet>[];
}

function createRect(
  x: number,
  y: number,
  width: number,
  height: number
): RendererRect {
  return { x, y, width, height };
}

function createFallbackTextMeasurementCanvas() {
  const context = {
    font: '',
    measureText(text: string) {
      const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(context.font);
      const fontSize = sizeMatch ? Number(sizeMatch[1]) : 12;
      const width = text.length * fontSize * 0.6;

      return {
        width,
        actualBoundingBoxAscent: fontSize * 0.8,
        actualBoundingBoxDescent: fontSize * 0.2,
        fontBoundingBoxAscent: fontSize * 0.8,
        fontBoundingBoxDescent: fontSize * 0.2,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: width,
      };
    },
  };

  return {
    getContext(type: string) {
      return type === '2d' ? context : null;
    },
  };
}

function ensureTextMeasurementCanvas(): void {
  if (!Element.getTextMeasurementCanvas()) {
    Element.setTextMeasurementCanvas(
      createFallbackTextMeasurementCanvas() as unknown as HTMLCanvasElement
    );
  }
}

function withinRange(
  globalMeasureIndex: number,
  range: MeasureRange | undefined
): boolean {
  if (!range) {
    return true;
  }

  return (
    globalMeasureIndex >= range.startMeasureIndex &&
    globalMeasureIndex < range.endMeasureIndex
  );
}

function toVexflowPitch(pitch: {
  step: string;
  octave: number;
  accidental?: string;
}): string {
  return `${pitch.step.toLowerCase()}${pitch.accidental ?? ''}/${pitch.octave}`;
}

function toRestKey(clef: string): string {
  return clef === 'bass' ? 'd/3' : 'b/4';
}

function toVexflowDuration(duration: Duration, isRest: boolean): string {
  return `${duration.length}${isRest ? 'r' : ''}`;
}

function toStemDirection(stemDirection: 'up' | 'down' | 'auto' | undefined) {
  if (stemDirection === 'up') {
    return 1;
  }

  if (stemDirection === 'down') {
    return -1;
  }

  return undefined;
}

function addAccidentals(note: VexflowTickable, item: RendererVoiceItem): void {
  if (item.type === 'note') {
    if (item.pitch.accidental) {
      note.addModifier(new Accidental(item.pitch.accidental), 0);
    }
    return;
  }

  if (item.type === 'chord') {
    item.pitches.forEach((pitch, index) => {
      if (pitch.accidental) {
        note.addModifier(new Accidental(pitch.accidental), index);
      }
    });
  }
}

function createTickable(
  item: RendererVoiceItem,
  clef: string
): VexflowTickable {
  const keys =
    item.type === 'rest'
      ? [toRestKey(clef)]
      : item.type === 'note'
      ? [toVexflowPitch(item.pitch)]
      : item.pitches.map((pitch) => toVexflowPitch(pitch));

  const note = new StaveNote({
    clef,
    keys,
    duration: toVexflowDuration(item.duration, item.type === 'rest'),
    stemDirection: toStemDirection(
      item.type === 'rest' ? undefined : item.stemDirection
    ),
  } as ConstructorParameters<typeof StaveNote>[0]);

  for (let dotIndex = 0; dotIndex < (item.duration.dots ?? 0); dotIndex += 1) {
    Dot.buildAndAttach([note], { all: true });
  }

  addAccidentals(note, item);
  return note;
}

function buildBeamGroups(meter: RendererMeasure['meter']) {
  if (!meter?.beaming?.length) {
    return undefined;
  }

  return meter.beaming.map((group) => new Fraction(group, meter.beatUnit));
}

function mapBarlineType(
  barline: RendererMeasure['startBarline'] | RendererMeasure['endBarline']
): number {
  switch (barline) {
    case 'double':
      return BarlineType.DOUBLE;
    case 'end':
    case 'final':
      return BarlineType.END;
    case 'repeat-begin':
      return BarlineType.REPEAT_BEGIN;
    case 'repeat-end':
      return BarlineType.REPEAT_END;
    case 'single':
    default:
      return BarlineType.SINGLE;
  }
}

function resolveRect(
  box:
    | {
        getX?: () => number;
        getY?: () => number;
        getW?: () => number;
        getH?: () => number;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
      }
    | undefined,
  fallback: RendererRect
): RendererRect {
  if (!box) {
    return fallback;
  }

  return {
    x: box.getX?.() ?? box.x ?? fallback.x,
    y: box.getY?.() ?? box.y ?? fallback.y,
    width: box.getW?.() ?? box.w ?? fallback.width,
    height: box.getH?.() ?? box.h ?? fallback.height,
  };
}

function extractNoteRect(
  tickable: VexflowTickable,
  fallback: RendererRect
): RendererRect {
  const boundingBox = tickable.getBoundingBox?.();
  if (boundingBox) {
    return resolveRect(boundingBox, fallback);
  }

  const noteHeadBounds = (
    tickable as VexflowTickable & {
      getNoteHeadBounds?: () => Array<{
        y_top: number;
        y_bottom: number;
        x: number;
        w: number;
      }>;
      getNoteHeadBeginX?: () => number;
      getNoteHeadEndX?: () => number;
      getYs?: () => number[];
    }
  ).getNoteHeadBounds?.() as unknown as
    | Array<{
        y_top: number;
        y_bottom: number;
        x: number;
        w: number;
      }>
    | undefined;

  if (noteHeadBounds && noteHeadBounds.length > 0) {
    const minX = Math.min(...noteHeadBounds.map((bound) => bound.x));
    const maxX = Math.max(...noteHeadBounds.map((bound) => bound.x + bound.w));
    const minY = Math.min(...noteHeadBounds.map((bound) => bound.y_top));
    const maxY = Math.max(...noteHeadBounds.map((bound) => bound.y_bottom));

    return createRect(minX, minY, maxX - minX, maxY - minY);
  }

  const tickableLike = tickable as VexflowTickable & {
    getNoteHeadBeginX?: () => number;
    getNoteHeadEndX?: () => number;
    getYs?: () => number[];
  };
  const startX = tickableLike.getNoteHeadBeginX?.() ?? fallback.x;
  const endX = tickableLike.getNoteHeadEndX?.() ?? startX + 12;
  const ys = tickableLike.getYs?.() ?? [fallback.y];
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return createRect(startX, minY - 6, endX - startX, maxY - minY + 12);
}

function createStave(
  measurePlan: MeasurePlan,
  measure: RendererMeasure,
  context: RenderRequest['context']
): InstanceType<typeof Stave> {
  const stave = new Stave(
    measurePlan.bounds.x,
    measurePlan.bounds.y,
    measurePlan.bounds.width
  );

  if (measurePlan.display.showClef) {
    stave.addClef(measurePlan.resolvedState.clef as string);
  }

  if (
    measurePlan.display.showKeySignature &&
    measurePlan.resolvedState.keySignature
  ) {
    const keySignature = measurePlan.resolvedState.keySignature;
    stave.addKeySignature(
      `${keySignature.tonic}${keySignature.accidental ?? ''}${
        keySignature.mode === 'minor' ? 'm' : ''
      }`
    );
  }

  if (measurePlan.display.showTimeSignature) {
    const { meter } = measurePlan.resolvedState;
    stave.addTimeSignature(`${meter.beats}/${meter.beatUnit}`);
  }

  if (measurePlan.display.showTempo && measurePlan.resolvedState.tempo) {
    stave.setTempo(
      {
        duration: measurePlan.resolvedState.tempo.beatUnit ?? 'q',
        bpm: measurePlan.resolvedState.tempo.bpm,
        name: measurePlan.resolvedState.tempo.text,
      },
      -12
    );
  }

  stave.setBegBarType(mapBarlineType(measure.startBarline));
  stave.setEndBarType(mapBarlineType(measure.endBarline));
  stave.setContext(context).draw();

  return stave;
}

function buildVoiceRenderData(
  measure: RendererMeasure,
  measurePlan: MeasurePlan
): VoiceRenderData[] {
  return measure.voices.map((voice) => {
    const tickables: TickableEntry[] = [];
    const vexflowTickables = voice.items.map((item) => {
      const startBeat =
        tickables.length > 0
          ? tickables[tickables.length - 1]!.endBeat
          : measurePlan.startBeat;
      const endBeat = startBeat + getDurationInQuarterBeats(item.duration);
      const tickable = createTickable(
        item,
        measurePlan.resolvedState.clef as string
      );
      tickables.push({
        voiceId: voice.id,
        voiceItemId: item.id,
        measureId: measure.id,
        staffId: measurePlan.staffId,
        measureIndex: measurePlan.measureIndex,
        globalMeasureIndex: measurePlan.globalMeasureIndex,
        pageIndex: measurePlan.pageIndex,
        systemIndex: measurePlan.systemIndex,
        staffIndex: measurePlan.staffIndex,
        startBeat,
        endBeat,
        tickable,
      });
      return tickable;
    });

    const renderedVoice = new VexflowVoice({
      numBeats: measurePlan.resolvedState.meter.beats,
      beatValue: measurePlan.resolvedState.meter.beatUnit,
    }).setMode(VexflowVoice.Mode.SOFT);

    renderedVoice.addTickables(vexflowTickables);

    const beams = Beam.generateBeams(vexflowTickables, {
      groups: buildBeamGroups(measurePlan.resolvedState.meter),
    });
    const tuplets = buildTuplets(vexflowTickables, voice.items);

    return {
      voice: renderedVoice,
      tickables,
      beams,
      tuplets,
    };
  });
}

function buildTuplets(
  tickables: VexflowTickable[],
  items: RendererVoiceItem[]
): InstanceType<typeof Tuplet>[] {
  const tuplets: InstanceType<typeof Tuplet>[] = [];
  let activeStart = -1;
  let activeTuplet: Duration['tuplet'];

  function pushTuplet(endIndex: number): void {
    if (activeTuplet && activeStart >= 0 && endIndex - activeStart >= 2) {
      tuplets.push(
        new Tuplet(tickables.slice(activeStart, endIndex), {
          numNotes: activeTuplet.num,
          notesOccupied: activeTuplet.den,
        })
      );
    }
  }

  items.forEach((item, index) => {
    const currentTuplet = item.duration.tuplet;

    if (!currentTuplet) {
      pushTuplet(index);
      activeStart = -1;
      activeTuplet = undefined;
      return;
    }

    if (
      activeTuplet &&
      (activeTuplet.num !== currentTuplet.num ||
        activeTuplet.den !== currentTuplet.den)
    ) {
      pushTuplet(index);
      activeStart = index;
    }

    if (!activeTuplet) {
      activeStart = index;
    }

    activeTuplet = currentTuplet;
  });

  pushTuplet(items.length);
  return tuplets;
}

function drawGroupedConnectors(
  plan: RendererPlan,
  range: MeasureRange | undefined,
  context: RenderRequest['context'],
  renderedStaves: Map<string, Map<number, InstanceType<typeof Stave>>>
): void {
  for (
    let staffIndex = 0;
    staffIndex < plan.staves.length - 1;
    staffIndex += 1
  ) {
    const topStaff = plan.staves[staffIndex];
    const bottomStaff = plan.staves[staffIndex + 1];

    if (
      !topStaff ||
      !bottomStaff ||
      !topStaff.systemGroupId ||
      topStaff.systemGroupId !== bottomStaff.systemGroupId
    ) {
      continue;
    }

    const visibleMeasures = plan.measures
      .filter(
        (measurePlan) =>
          measurePlan.staffId === topStaff.staffId &&
          withinRange(measurePlan.globalMeasureIndex, range)
      )
      .map((measurePlan) => measurePlan.globalMeasureIndex);

    const firstMeasureIndex = visibleMeasures[0];
    const lastMeasureIndex = visibleMeasures[visibleMeasures.length - 1];

    if (firstMeasureIndex === undefined || lastMeasureIndex === undefined) {
      continue;
    }

    const topFirst = renderedStaves
      .get(topStaff.staffId)
      ?.get(firstMeasureIndex);
    const bottomFirst = renderedStaves
      .get(bottomStaff.staffId)
      ?.get(firstMeasureIndex);
    const topLast = renderedStaves.get(topStaff.staffId)?.get(lastMeasureIndex);
    const bottomLast = renderedStaves
      .get(bottomStaff.staffId)
      ?.get(lastMeasureIndex);

    if (topFirst && bottomFirst) {
      new StaveConnector(topFirst, bottomFirst)
        .setType(StaveConnector.type.BRACE as never)
        .setContext(context)
        .draw();
      new StaveConnector(topFirst, bottomFirst)
        .setType(StaveConnector.type.SINGLE_LEFT as never)
        .setContext(context)
        .draw();
    }

    if (topLast && bottomLast) {
      new StaveConnector(topLast, bottomLast)
        .setType(StaveConnector.type.SINGLE_RIGHT as never)
        .setContext(context)
        .draw();
    }
  }
}

export function renderScore<TContext extends RenderRequest['context']>(
  request: RenderRequest<TContext>
): RenderResult {
  ensureTextMeasurementCanvas();

  const { context, plan, range } = request;
  const sortedStaves = [...plan.score.staves].sort(
    (left, right) => left.order - right.order
  );
  const measureLayouts: MeasureLayout[] = [];
  const noteBounds: NoteBounds[] = [];
  const renderedStaves = new Map<
    string,
    Map<number, InstanceType<typeof Stave>>
  >();

  plan.staves.forEach((staffPlan) => {
    const staff = sortedStaves.find(
      (candidate) => candidate.id === staffPlan.staffId
    );

    if (!staff) {
      return;
    }

    const renderedMeasures = new Map<number, InstanceType<typeof Stave>>();
    renderedStaves.set(staffPlan.staffId, renderedMeasures);

    staffPlan.measureIndices.forEach((measurePlanIndex) => {
      const measurePlan = plan.measures[measurePlanIndex];
      if (!measurePlan || !withinRange(measurePlan.globalMeasureIndex, range)) {
        return;
      }

      const measure = staff.measures[measurePlan.measureIndex];
      if (!measure) {
        return;
      }

      const stave = createStave(measurePlan, measure, context);
      renderedMeasures.set(measurePlan.globalMeasureIndex, stave);

      const voiceData = buildVoiceRenderData(measure, measurePlan);
      const voices = voiceData.map((entry) => entry.voice);

      if (voices.length > 0) {
        const formatter = new Formatter();

        if (voices.length > 1) {
          formatter.joinVoices(voices);
        }

        formatter.formatToStave(voices, stave);
        voices.forEach((voice) => voice.draw(context, stave));
      }

      voiceData.forEach((voiceEntry) => {
        voiceEntry.beams.forEach((beam) => beam.setContext(context).draw());
        voiceEntry.tuplets.forEach((tuplet) =>
          tuplet.setContext(context).draw()
        );
      });

      const staveBounds = resolveRect(
        stave.getBoundingBox(),
        measurePlan.bounds
      );
      measureLayouts.push({
        scoreId: measurePlan.scoreId,
        staffId: measurePlan.staffId,
        measureId: measurePlan.measureId,
        pageIndex: measurePlan.pageIndex,
        systemIndex: measurePlan.systemIndex,
        staffIndex: measurePlan.staffIndex,
        measureIndex: measurePlan.measureIndex,
        globalMeasureIndex: measurePlan.globalMeasureIndex,
        bounds: staveBounds,
        contentBounds: measurePlan.contentBounds,
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        startBeat: measurePlan.startBeat,
        endBeat: measurePlan.endBeat,
      });

      voiceData.forEach((voiceEntry) => {
        voiceEntry.tickables.forEach((tickableEntry) => {
          noteBounds.push({
            voiceItemId: tickableEntry.voiceItemId,
            voiceId: tickableEntry.voiceId,
            staffId: tickableEntry.staffId,
            measureId: tickableEntry.measureId,
            pageIndex: tickableEntry.pageIndex,
            systemIndex: tickableEntry.systemIndex,
            staffIndex: tickableEntry.staffIndex,
            measureIndex: tickableEntry.measureIndex,
            globalMeasureIndex: tickableEntry.globalMeasureIndex,
            bounds: extractNoteRect(
              tickableEntry.tickable,
              createRect(
                measurePlan.contentBounds.x,
                measurePlan.contentBounds.y,
                12,
                measurePlan.contentBounds.height
              )
            ),
            startBeat: tickableEntry.startBeat,
            endBeat: tickableEntry.endBeat,
          });
        });
      });
    });
  });

  drawGroupedConnectors(plan, range, context, renderedStaves);

  return {
    contentSize: plan.contentSize,
    measureLayouts,
    noteBounds,
  };
}
