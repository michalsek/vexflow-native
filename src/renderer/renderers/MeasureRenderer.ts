import { Formatter, Stave } from 'vexflow';

import type SkiaVexflowContext from '../../base/SkiaVexflowContext';
import type { Measure, Score, Staff } from '../../state';
import type {
  GlobalMeasureTiming,
  MeasureDisplayState,
  MeasureLayout,
  MeasureMeasurementPlan,
  MeasureModifierReservations,
  NoteBounds,
  ResolvedMeasureState,
  ScoreOptions,
} from '../types';
import {
  createRect,
  extractNoteRect,
  mapBarlineType,
  measureTextWidth,
  resolveRect,
} from './common';
import type { VoiceRenderData } from './VoiceRenderer';
import VoiceRenderer from './VoiceRenderer';

export interface MeasureRenderOutput {
  layout: MeasureLayout;
  noteBounds: NoteBounds[];
  stave: Stave;
}

export default class MeasureRenderer {
  constructor(
    private readonly ctx: SkiaVexflowContext,
    private readonly score: Score,
    private readonly staff: Staff,
    private readonly measureModel: Measure,
    private readonly staffIndex: number,
    private readonly measureIndex: number,
    private readonly globalMeasureIndex: number,
    private readonly timing: GlobalMeasureTiming,
    private readonly options: ScoreOptions
  ) {}

  measure(previousState?: ResolvedMeasureState): MeasureMeasurementPlan {
    const resolvedState = this.resolveMeasureState(previousState);
    const display = this.resolveDisplayState(previousState, resolvedState);
    const voiceResult = this.measureVoices(resolvedState);
    const modifierReservations = this.measureModifierReservations(
      resolvedState,
      display
    );
    const leftReservation = this.measureLeftReservation(modifierReservations);
    const minimumWidth = Math.max(
      this.options.spacing.minimumMeasureWidth,
      leftReservation +
        voiceResult.noteAreaWidth +
        this.options.spacing.measureHorizontalPadding * 2
    );

    return {
      scoreId: this.score.id,
      staffId: this.staff.id,
      measureId: this.measureModel.id,
      staffIndex: this.staffIndex,
      measureIndex: this.measureIndex,
      globalMeasureIndex: this.globalMeasureIndex,
      startBeat: this.timing.startBeat,
      endBeat: this.timing.endBeat,
      resolvedState,
      display,
      voicePlans: voiceResult.voicePlans,
      modifierReservations,
      noteAreaWidth: voiceResult.noteAreaWidth,
      minimumWidth,
      allocatedWidth: minimumWidth,
      bounds: createRect(0, 0, minimumWidth, this.options.spacing.staffHeight),
      contentBounds: createRect(
        leftReservation + this.options.spacing.measureHorizontalPadding,
        this.options.spacing.staffInnerVerticalPadding,
        Math.max(
          1,
          minimumWidth -
            leftReservation -
            this.options.spacing.measureHorizontalPadding * 2
        ),
        Math.max(
          1,
          this.options.spacing.staffHeight -
            this.options.spacing.staffInnerVerticalPadding * 2
        )
      ),
    };
  }

  render(plan: MeasureMeasurementPlan): MeasureRenderOutput {
    const stave = new Stave(plan.bounds.x, plan.bounds.y, plan.bounds.width);

    this.renderClef(stave, plan);
    this.renderKeySignature(stave, plan);
    this.renderTimeSignature(stave, plan);
    this.renderTempo(stave, plan);
    this.renderBarlines(stave);
    stave.setContext(this.ctx).draw();

    this.renderDirections(plan);

    const voiceData = this.renderVoices(plan, stave);
    const noteBounds = voiceData.flatMap((voiceEntry) =>
      voiceEntry.tickables.map((tickableEntry) => ({
        voiceItemId: tickableEntry.voiceItemId,
        voiceId: tickableEntry.voiceId,
        staffId: this.staff.id,
        measureId: this.measureModel.id,
        staffIndex: this.staffIndex,
        measureIndex: this.measureIndex,
        globalMeasureIndex: this.globalMeasureIndex,
        bounds: extractNoteRect(
          tickableEntry.tickable,
          createRect(
            plan.contentBounds.x,
            plan.contentBounds.y,
            12,
            plan.contentBounds.height
          )
        ),
        startBeat: tickableEntry.startBeat,
        endBeat: tickableEntry.endBeat,
      }))
    );

    return {
      layout: {
        scoreId: this.score.id,
        staffId: this.staff.id,
        measureId: this.measureModel.id,
        staffIndex: this.staffIndex,
        measureIndex: this.measureIndex,
        globalMeasureIndex: this.globalMeasureIndex,
        bounds: resolveRect(stave.getBoundingBox(), plan.bounds),
        contentBounds: plan.contentBounds,
        noteStartX: stave.getNoteStartX(),
        noteEndX: stave.getNoteEndX(),
        startBeat: plan.startBeat,
        endBeat: plan.endBeat,
      },
      noteBounds,
      stave,
    };
  }

  measureClef(display: MeasureDisplayState): number {
    if (!display.showClef) {
      return 0;
    }

    return this.measureSequentialModifierWidth((stave) => {
      stave.addClef(this.resolveMeasureState().clef as string);
    });
  }

  renderClef(stave: Stave, plan: MeasureMeasurementPlan): void {
    if (plan.display.showClef) {
      stave.addClef(plan.resolvedState.clef as string);
    }
  }

  measureKeySignature(
    resolvedState: ResolvedMeasureState,
    display: MeasureDisplayState
  ): number {
    if (!display.showKeySignature || !resolvedState.keySignature) {
      return 0;
    }

    return this.measureSequentialModifierWidth((stave) => {
      if (display.showClef) {
        stave.addClef(resolvedState.clef as string);
      }

      stave.addKeySignature(this.toKeySignatureString(resolvedState));
    });
  }

  renderKeySignature(stave: Stave, plan: MeasureMeasurementPlan): void {
    if (plan.display.showKeySignature && plan.resolvedState.keySignature) {
      stave.addKeySignature(this.toKeySignatureString(plan.resolvedState));
    }
  }

  measureTimeSignature(
    resolvedState: ResolvedMeasureState,
    display: MeasureDisplayState
  ): number {
    if (!display.showTimeSignature) {
      return 0;
    }

    return this.measureSequentialModifierWidth((stave) => {
      if (display.showClef) {
        stave.addClef(resolvedState.clef as string);
      }

      if (display.showKeySignature && resolvedState.keySignature) {
        stave.addKeySignature(this.toKeySignatureString(resolvedState));
      }

      stave.addTimeSignature(
        `${resolvedState.meter.beats}/${resolvedState.meter.beatUnit}`
      );
    });
  }

  renderTimeSignature(stave: Stave, plan: MeasureMeasurementPlan): void {
    if (plan.display.showTimeSignature) {
      stave.addTimeSignature(
        `${plan.resolvedState.meter.beats}/${plan.resolvedState.meter.beatUnit}`
      );
    }
  }

  measureTempo(
    resolvedState: ResolvedMeasureState,
    display: MeasureDisplayState
  ): number {
    if (!display.showTempo || !resolvedState.tempo) {
      return 0;
    }

    const label = resolvedState.tempo.text
      ? `${resolvedState.tempo.text} ${resolvedState.tempo.bpm}`
      : String(resolvedState.tempo.bpm);

    return measureTextWidth(this.ctx, label) + 8;
  }

  renderTempo(stave: Stave, plan: MeasureMeasurementPlan): void {
    if (plan.display.showTempo && plan.resolvedState.tempo) {
      stave.setTempo(
        {
          duration: plan.resolvedState.tempo.beatUnit ?? 'q',
          bpm: plan.resolvedState.tempo.bpm,
          name: plan.resolvedState.tempo.text,
        },
        -12
      );
    }
  }

  measureDirections(display: MeasureDisplayState): number {
    if (!display.showDirections || !this.measureModel.directions?.length) {
      return 0;
    }

    return (
      Math.max(
        ...this.measureModel.directions.map((direction) =>
          measureTextWidth(this.ctx, direction)
        )
      ) + 8
    );
  }

  renderDirections(plan: MeasureMeasurementPlan): void {
    if (!plan.display.showDirections || !this.measureModel.directions?.length) {
      return;
    }

    this.measureModel.directions.forEach((direction, directionIndex) => {
      this.ctx.fillText(
        direction,
        plan.bounds.x + 4,
        plan.bounds.y - 10 - directionIndex * 12
      );
    });
  }

  measureBarlines(): number {
    return this.measureModel.startBarline &&
      this.measureModel.startBarline !== 'single'
      ? 6
      : 0;
  }

  renderBarlines(stave: Stave): void {
    stave.setBegBarType(mapBarlineType(this.measureModel.startBarline));
    stave.setEndBarType(mapBarlineType(this.measureModel.endBarline));
  }

  measureVoices(resolvedState: ResolvedMeasureState): {
    voicePlans: MeasureMeasurementPlan['voicePlans'];
    noteAreaWidth: number;
  } {
    const voiceData = this.measureModel.voices.map((voice) =>
      new VoiceRenderer(
        voice,
        resolvedState.clef,
        resolvedState.meter,
        this.timing.startBeat
      ).measure()
    );
    const voices = voiceData.map((entry) => entry.voice);

    if (voices.length === 0) {
      return {
        voicePlans: [],
        noteAreaWidth: 0,
      };
    }

    const formatter = new Formatter();

    if (voices.length > 1) {
      formatter.joinVoices(voices);
    }

    const noteAreaWidth = Math.max(
      formatter.preCalculateMinTotalWidth(voices),
      formatter.getMinTotalWidth()
    );

    return {
      voicePlans: voiceData.map((entry) => entry.plan),
      noteAreaWidth,
    };
  }

  renderVoices(plan: MeasureMeasurementPlan, stave: Stave): VoiceRenderData[] {
    const voiceData = this.measureModel.voices.map((voice) =>
      new VoiceRenderer(
        voice,
        plan.resolvedState.clef,
        plan.resolvedState.meter,
        plan.startBeat
      ).render()
    );
    const voices = voiceData.map((entry) => entry.voice);

    if (voices.length > 0) {
      const formatter = new Formatter();

      if (voices.length > 1) {
        formatter.joinVoices(voices);
      }

      formatter.formatToStave(voices, stave);
      voices.forEach((voice) => voice.draw(this.ctx, stave));
    }

    voiceData.forEach((voiceEntry) => {
      voiceEntry.beams.forEach((beam) => beam.setContext(this.ctx).draw());
      voiceEntry.tuplets.forEach((tuplet) =>
        tuplet.setContext(this.ctx).draw()
      );
    });

    return voiceData;
  }

  private resolveMeasureState(
    previousState?: ResolvedMeasureState
  ): ResolvedMeasureState {
    return {
      clef: this.measureModel.clef ?? previousState?.clef ?? this.staff.clef,
      meter: this.measureModel.meter ?? this.timing.meter,
      keySignature:
        this.measureModel.keySignature ??
        previousState?.keySignature ??
        this.score.defaultKeySignature,
      tempo:
        this.measureModel.tempo ?? previousState?.tempo ?? this.score.tempo,
    };
  }

  private resolveDisplayState(
    previousState: ResolvedMeasureState | undefined,
    resolvedState: ResolvedMeasureState
  ): MeasureDisplayState {
    return {
      showClef:
        this.measureIndex === 0 ||
        (this.measureModel.clef !== undefined &&
          this.measureModel.clef !== previousState?.clef),
      showKeySignature:
        (this.measureIndex === 0 && resolvedState.keySignature !== undefined) ||
        (this.measureModel.keySignature !== undefined &&
          this.measureModel.keySignature !== previousState?.keySignature),
      showTimeSignature: this.timing.showTimeSignature,
      showTempo:
        (this.measureIndex === 0 && resolvedState.tempo !== undefined) ||
        (this.measureModel.tempo !== undefined &&
          this.measureModel.tempo !== previousState?.tempo),
      showDirections: (this.measureModel.directions?.length ?? 0) > 0,
    };
  }

  private measureModifierReservations(
    resolvedState: ResolvedMeasureState,
    display: MeasureDisplayState
  ): MeasureModifierReservations {
    return {
      clef: this.measureClef(display),
      keySignature: this.measureKeySignature(resolvedState, display),
      timeSignature: this.measureTimeSignature(resolvedState, display),
      tempo: this.measureTempo(resolvedState, display),
      directions: this.measureDirections(display),
      barlines: this.measureBarlines(),
    };
  }

  private measureLeftReservation(
    modifierReservations: MeasureModifierReservations
  ): number {
    const staveModifierWidth =
      modifierReservations.clef +
      modifierReservations.keySignature +
      modifierReservations.timeSignature +
      modifierReservations.barlines;

    return Math.max(
      staveModifierWidth,
      modifierReservations.tempo,
      modifierReservations.directions
    );
  }

  private measureSequentialModifierWidth(
    configure: (stave: Stave) => void
  ): number {
    const stave = new Stave(0, 0, 240);
    configure(stave);

    return Math.max(0, stave.getNoteStartX());
  }

  private toKeySignatureString(resolvedState: ResolvedMeasureState): string {
    const keySignature = resolvedState.keySignature!;

    return `${keySignature.tonic}${keySignature.accidental ?? ''}${
      keySignature.mode === 'minor' ? 'm' : ''
    }`;
  }
}
