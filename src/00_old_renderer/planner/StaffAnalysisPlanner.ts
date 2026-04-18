import type { KeySignature, Measure, Voice, VoiceItem } from '../../state';

import type {
  MeasureDisplayPlan,
  RendererScore,
  RendererStaff,
  ResolvedMeasureState,
} from '../types';
import { getDurationInQuarterBeats } from '../timing';

import type {
  GlobalMeasureTiming,
  NormalizedConfigResult,
  StaffAnalysis,
  StaffFingerprintEntry,
  StaffMeasureAnalysis,
} from './types';

interface MeasureWidthMetrics {
  voiceCount: number;
  totalItems: number;
  maxVoiceItems: number;
  densityWidth: number;
  accidentalCount: number;
  tupletCount: number;
  lyricCount: number;
  directionCount: number;
  keyWidth: number;
}

interface CachedStaffMeasureAnalysis extends StaffMeasureAnalysis {
  metrics: MeasureWidthMetrics;
  widthFingerprint: string;
}

interface StaffAnalysisCache {
  staffId: RendererStaff['id'];
  staffClef: RendererStaff['clef'];
  measures: CachedStaffMeasureAnalysis[];
}

interface SemanticsRecomputeInput {
  score: RendererScore;
  staffEntry: StaffFingerprintEntry;
  timings: GlobalMeasureTiming[];
  cache: StaffAnalysisCache;
  startIndex: number;
  config: NormalizedConfigResult;
}

interface WidthRecomputeInput {
  cache: StaffAnalysisCache;
  config: NormalizedConfigResult;
  startIndex: number;
}

function normalizeKeySignature(
  keySignature: KeySignature | undefined
): KeySignature | undefined {
  return keySignature;
}

export class StaffAnalysisPlanner {
  private cacheByStaffId = new Map<RendererStaff['id'], StaffAnalysisCache>();

  private analysisDefaultsFingerprint?: string;

  plan(input: {
    score: RendererScore;
    staffEntries: StaffFingerprintEntry[];
    timings: GlobalMeasureTiming[];
    config: NormalizedConfigResult;
    analysisDefaultsFingerprint: string;
  }): StaffAnalysis[] {
    const didDefaultsChange =
      this.analysisDefaultsFingerprint !== undefined &&
      this.analysisDefaultsFingerprint !== input.analysisDefaultsFingerprint;

    const analyses = input.staffEntries.map((staffEntry, staffIndex) => {
      const cached =
        this.cacheByStaffId.get(staffEntry.staffId) ??
        this.createStaffCache(staffEntry.staff);
      const semanticsStartIndex = this.getSemanticsDirtyIndex({
        cache: cached,
        staffEntry,
        timings: input.timings,
        resetAll: didDefaultsChange,
      });

      cached.staffClef = staffEntry.staff.clef;

      if (semanticsStartIndex !== null) {
        this.recomputeStaffSemanticsFromIndex({
          score: input.score,
          staffEntry,
          timings: input.timings,
          cache: cached,
          startIndex: semanticsStartIndex,
          config: input.config,
        });
      } else {
        this.refreshReferences(cached, staffEntry.staff);
      }

      const widthStartIndex = this.getWidthDirtyIndex(
        cached,
        input.config,
        semanticsStartIndex
      );

      if (widthStartIndex !== null) {
        this.updateMeasureWidthsFromIndex({
          cache: cached,
          config: input.config,
          startIndex: widthStartIndex,
        });
      }

      this.trimMeasures(cached, staffEntry.staff.measures.length);
      this.cacheByStaffId.set(staffEntry.staffId, cached);

      return {
        staff: staffEntry.staff,
        staffIndex,
        analysisFingerprint: staffEntry.analysisFingerprint,
        measures: cached.measures,
      };
    });

    this.analysisDefaultsFingerprint = input.analysisDefaultsFingerprint;

    return analyses;
  }

  public recomputeStaffSemanticsFromIndex(
    input: SemanticsRecomputeInput
  ): void {
    const { cache, score, staffEntry, timings, startIndex } = input;
    let activeClef =
      startIndex > 0
        ? cache.measures[startIndex - 1]!.resolvedState.clef
        : staffEntry.staff.clef;
    let activeKeySignature =
      startIndex > 0
        ? cache.measures[startIndex - 1]!.resolvedState.keySignature
        : score.defaultKeySignature;
    let activeTempo =
      startIndex > 0
        ? cache.measures[startIndex - 1]!.resolvedState.tempo
        : score.tempo;

    for (
      let measureIndex = startIndex;
      measureIndex < staffEntry.staff.measures.length;
      measureIndex += 1
    ) {
      const measure = staffEntry.staff.measures[measureIndex];
      const measureFingerprint = staffEntry.measureFingerprints[measureIndex];
      const timing = timings[measureIndex];

      if (!measure || !measureFingerprint || !timing) {
        continue;
      }

      const resolvedState: ResolvedMeasureState = {
        clef: measure.clef ?? activeClef,
        meter: measure.meter ?? timing.meter,
        keySignature: normalizeKeySignature(
          measure.keySignature ?? activeKeySignature
        ),
        tempo: measure.tempo ?? activeTempo,
      };
      const display: MeasureDisplayPlan = {
        showClef: measureIndex === 0 || measure.clef !== undefined,
        showKeySignature:
          (measureIndex === 0 && resolvedState.keySignature !== undefined) ||
          measure.keySignature !== undefined,
        showTimeSignature: timing.showTimeSignature,
        showTempo:
          (measureIndex === 0 && resolvedState.tempo !== undefined) ||
          measure.tempo !== undefined,
        showDirections: (measure.directions?.length ?? 0) > 0,
      };
      const metrics = this.buildMeasureWidthMetrics(measure, resolvedState);

      cache.measures[measureIndex] = {
        measure,
        measureIndex,
        globalMeasureIndex: measureIndex,
        startBeat: timing.startBeat,
        endBeat: timing.endBeat,
        resolvedState,
        display,
        minimumWidth: this.estimateMeasureMinimumWidth(
          metrics,
          resolvedState,
          display,
          input.config
        ),
        measureFingerprint: measureFingerprint.fingerprint,
        timingFingerprint: timing.fingerprint,
        widthFingerprint: input.config.measureWidthFingerprint,
        metrics,
      };

      activeClef = resolvedState.clef;
      activeKeySignature = resolvedState.keySignature;
      activeTempo = resolvedState.tempo;
    }
  }

  public updateMeasureWidthsFromIndex(input: WidthRecomputeInput): void {
    const { cache, config, startIndex } = input;

    for (
      let measureIndex = startIndex;
      measureIndex < cache.measures.length;
      measureIndex += 1
    ) {
      const entry = cache.measures[measureIndex];

      if (!entry) {
        continue;
      }

      entry.minimumWidth = this.estimateMeasureMinimumWidth(
        entry.metrics,
        entry.resolvedState,
        entry.display,
        config
      );
      entry.widthFingerprint = config.measureWidthFingerprint;
    }
  }

  private createStaffCache(staff: RendererStaff): StaffAnalysisCache {
    return {
      staffId: staff.id,
      staffClef: staff.clef,
      measures: [],
    };
  }

  private refreshReferences(
    cache: StaffAnalysisCache,
    staff: RendererStaff
  ): void {
    cache.measures.forEach((measureAnalysis, index) => {
      const nextMeasure = staff.measures[index];

      if (nextMeasure) {
        measureAnalysis.measure = nextMeasure;
      }
    });
  }

  private trimMeasures(cache: StaffAnalysisCache, length: number): void {
    cache.measures = cache.measures.slice(0, length);
  }

  private getSemanticsDirtyIndex(input: {
    cache: StaffAnalysisCache;
    staffEntry: StaffFingerprintEntry;
    timings: GlobalMeasureTiming[];
    resetAll: boolean;
  }): number | null {
    const { cache, staffEntry, timings, resetAll } = input;

    if (resetAll || cache.staffClef !== staffEntry.staff.clef) {
      return 0;
    }

    const sharedCount = Math.min(
      cache.measures.length,
      staffEntry.measureFingerprints.length
    );

    for (let measureIndex = 0; measureIndex < sharedCount; measureIndex += 1) {
      if (
        cache.measures[measureIndex]?.measureFingerprint !==
          staffEntry.measureFingerprints[measureIndex]?.fingerprint ||
        cache.measures[measureIndex]?.timingFingerprint !==
          timings[measureIndex]?.fingerprint
      ) {
        return measureIndex;
      }
    }

    if (cache.measures.length !== staffEntry.measureFingerprints.length) {
      return sharedCount;
    }

    return null;
  }

  private getWidthDirtyIndex(
    cache: StaffAnalysisCache,
    config: NormalizedConfigResult,
    semanticsStartIndex: number | null
  ): number | null {
    if (semanticsStartIndex !== null) {
      return semanticsStartIndex;
    }

    for (
      let measureIndex = 0;
      measureIndex < cache.measures.length;
      measureIndex += 1
    ) {
      if (
        cache.measures[measureIndex]?.widthFingerprint !==
        config.measureWidthFingerprint
      ) {
        return measureIndex;
      }
    }

    return null;
  }

  private buildMeasureWidthMetrics(
    measure: Measure,
    resolvedState: ResolvedMeasureState
  ): MeasureWidthMetrics {
    const voiceCount = Math.max(1, measure.voices.length);
    const totalItems = measure.voices.reduce(
      (sum: number, voice: Voice) => sum + voice.items.length,
      0
    );
    const maxVoiceItems = measure.voices.reduce(
      (maxItems: number, voice: Voice) =>
        Math.max(maxItems, voice.items.length),
      0
    );
    const densityWidth = measure.voices.reduce((sum: number, voice: Voice) => {
      return (
        sum +
        voice.items.reduce(
          (itemSum: number, item: VoiceItem) =>
            itemSum + getDurationInQuarterBeats(item.duration),
          0
        )
      );
    }, 0);
    const accidentalCount = this.countAccidentals(measure);
    const tupletCount = this.countTuplets(measure);
    const lyricCount = this.countLyrics(measure);
    const directionCount = measure.directions?.length ?? 0;
    const keyWidth = resolvedState.keySignature
      ? resolvedState.keySignature.tonic.length +
        (resolvedState.keySignature.accidental ? 1 : 0)
      : 0;

    return {
      voiceCount,
      totalItems,
      maxVoiceItems,
      densityWidth,
      accidentalCount,
      tupletCount,
      lyricCount,
      directionCount,
      keyWidth,
    };
  }

  private estimateMeasureMinimumWidth(
    metrics: MeasureWidthMetrics,
    resolvedState: ResolvedMeasureState,
    display: MeasureDisplayPlan,
    config: NormalizedConfigResult
  ): number {
    let width = config.config.spacing.minimumMeasureWidth;
    width += metrics.maxVoiceItems * 18;
    width += metrics.totalItems * 4;
    width += (metrics.voiceCount - 1) * 18;
    width += metrics.densityWidth * 6;
    width += metrics.accidentalCount * 8;
    width += metrics.tupletCount * 12;
    width += metrics.lyricCount * 10;
    width += metrics.keyWidth * 12;

    if (display.showClef) {
      width += 28;
    }

    if (display.showKeySignature && resolvedState.keySignature) {
      width += 26;
    }

    if (display.showTimeSignature) {
      width += 32;
    }

    if (display.showTempo && resolvedState.tempo) {
      width += 24;
    }

    if (display.showDirections) {
      width += metrics.directionCount * 14;
    }

    return Math.max(width, config.config.spacing.minimumMeasureWidth);
  }

  private countAccidentals(measure: Measure): number {
    return measure.voices.reduce((voiceTotal: number, voice: Voice) => {
      return (
        voiceTotal +
        voice.items.reduce((itemTotal: number, item: VoiceItem) => {
          if (item.type === 'note') {
            return itemTotal + (item.pitch.accidental ? 1 : 0);
          }

          if (item.type === 'chord') {
            return (
              itemTotal +
              item.pitches.filter((pitch) => pitch.accidental !== undefined)
                .length
            );
          }

          return itemTotal;
        }, 0)
      );
    }, 0);
  }

  private countTuplets(measure: Measure): number {
    return measure.voices.reduce((voiceTotal: number, voice: Voice) => {
      return (
        voiceTotal +
        voice.items.filter(
          (item: VoiceItem) => item.duration.tuplet !== undefined
        ).length
      );
    }, 0);
  }

  private countLyrics(measure: Measure): number {
    return measure.voices.reduce((voiceTotal: number, voice: Voice) => {
      return (
        voiceTotal +
        voice.items.filter(
          (item: VoiceItem) => item.type === 'note' && item.lyric !== undefined
        ).length
      );
    }, 0);
  }
}
