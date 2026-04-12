import type { KeySignature, Measure, Meter, Voice, VoiceItem } from '../state';

import type {
  MeasureDisplayPlan,
  MeasurePlan,
  MeasureRequest,
  NormalizedRendererConfig,
  RendererConfig,
  RendererLayoutMode,
  RendererPlan,
  RendererRect,
  RendererScore,
  RendererStaff,
  ResolvedMeasureState,
  StaffPlan,
} from './types';

import {
  DEFAULT_RENDERER_PADDING,
  DEFAULT_RENDERER_RENDER_OPTIONS,
  DEFAULT_RENDERER_SPACING,
} from './constants';
import { getDurationInQuarterBeats, getMeasureQuarterBeats } from './timing';

interface GlobalMeasureTiming {
  meter: Meter;
  startBeat: number;
  endBeat: number;
  showTimeSignature: boolean;
}

interface StaffMeasureAnalysis {
  measure: Measure;
  measureIndex: number;
  globalMeasureIndex: number;
  startBeat: number;
  endBeat: number;
  resolvedState: ResolvedMeasureState;
  display: MeasureDisplayPlan;
  minimumWidth: number;
}

interface StaffAnalysis {
  staff: RendererStaff;
  staffIndex: number;
  measures: StaffMeasureAnalysis[];
}

interface LayoutStrategy {
  buildPlan(input: {
    score: RendererScore;
    config: NormalizedRendererConfig;
    staffAnalyses: StaffAnalysis[];
    sortedStaves: RendererStaff[];
    timings: GlobalMeasureTiming[];
  }): RendererPlan;
}

function createRect(
  x: number,
  y: number,
  width: number,
  height: number
): RendererRect {
  return { x, y, width, height };
}

function sortStaves(score: RendererScore): RendererStaff[] {
  return [...score.staves].sort((left, right) => left.order - right.order);
}

function getTotalMeasureCount(staves: RendererStaff[]): number {
  return staves.reduce(
    (maxCount, staff) => Math.max(maxCount, staff.measures.length),
    0
  );
}

function hasExplicitMeterAtIndex(
  staves: RendererStaff[],
  measureIndex: number
): boolean {
  return staves.some(
    (staff) => staff.measures[measureIndex]?.meter !== undefined
  );
}

function resolveGlobalMeasureTimings(
  score: RendererScore,
  staves: RendererStaff[]
): GlobalMeasureTiming[] {
  const totalMeasureCount = getTotalMeasureCount(staves);
  const timings: GlobalMeasureTiming[] = [];
  let activeMeter = score.defaultMeter;
  let currentBeat = 0;

  for (
    let measureIndex = 0;
    measureIndex < totalMeasureCount;
    measureIndex += 1
  ) {
    const explicitMeter = staves
      .map((staff) => staff.measures[measureIndex]?.meter)
      .find((meter): meter is Meter => meter !== undefined);

    if (explicitMeter) {
      activeMeter = explicitMeter;
    }

    const measureQuarterBeats = getMeasureQuarterBeats(activeMeter);
    timings.push({
      meter: activeMeter,
      startBeat: currentBeat,
      endBeat: currentBeat + measureQuarterBeats,
      showTimeSignature:
        measureIndex === 0 || hasExplicitMeterAtIndex(staves, measureIndex),
    });
    currentBeat += measureQuarterBeats;
  }

  return timings;
}

function countAccidentals(measure: Measure): number {
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

function countTuplets(measure: Measure): number {
  return measure.voices.reduce((voiceTotal: number, voice: Voice) => {
    return (
      voiceTotal +
      voice.items.filter(
        (item: VoiceItem) => item.duration.tuplet !== undefined
      ).length
    );
  }, 0);
}

function countLyrics(measure: Measure): number {
  return measure.voices.reduce((voiceTotal: number, voice: Voice) => {
    return (
      voiceTotal +
      voice.items.filter(
        (item: VoiceItem) => item.type === 'note' && item.lyric !== undefined
      ).length
    );
  }, 0);
}

function estimateMeasureMinimumWidth(
  measure: Measure,
  resolvedState: ResolvedMeasureState,
  display: MeasureDisplayPlan,
  config: NormalizedRendererConfig
): number {
  const voiceCount = Math.max(1, measure.voices.length);
  const totalItems = measure.voices.reduce(
    (sum: number, voice: Voice) => sum + voice.items.length,
    0
  );
  const maxVoiceItems = measure.voices.reduce(
    (maxItems: number, voice: Voice) => Math.max(maxItems, voice.items.length),
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
  const keyWidth = resolvedState.keySignature
    ? resolvedState.keySignature.tonic.length +
      (resolvedState.keySignature.accidental ? 1 : 0)
    : 0;

  let width = config.spacing.minimumMeasureWidth;
  width += maxVoiceItems * 18;
  width += totalItems * 4;
  width += (voiceCount - 1) * 18;
  width += densityWidth * 6;
  width += countAccidentals(measure) * 8;
  width += countTuplets(measure) * 12;
  width += countLyrics(measure) * 10;
  width += keyWidth * 12;

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
    width += (measure.directions?.length ?? 0) * 14;
  }

  return Math.max(width, config.spacing.minimumMeasureWidth);
}

function isGroupedWithNext(
  currentStaff: RendererStaff,
  nextStaff: RendererStaff | undefined
): boolean {
  if (!nextStaff) {
    return false;
  }

  return (
    currentStaff.systemGroupId !== undefined &&
    currentStaff.systemGroupId === nextStaff.systemGroupId
  );
}

function normalizeKeySignature(
  keySignature: KeySignature | undefined
): KeySignature | undefined {
  return keySignature;
}

function analyzeStaves(
  score: RendererScore,
  sortedStaves: RendererStaff[],
  config: NormalizedRendererConfig,
  timings: GlobalMeasureTiming[]
): StaffAnalysis[] {
  return sortedStaves.map((staff, staffIndex) => {
    let activeClef = staff.clef;
    let activeKeySignature = score.defaultKeySignature;
    let activeTempo = score.tempo;

    const measures = staff.measures.map((measure, measureIndex) => {
      const timing = timings[measureIndex];
      if (!timing) {
        throw new Error(
          `Missing timing information for measure ${measureIndex}`
        );
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

      const minimumWidth = estimateMeasureMinimumWidth(
        measure,
        resolvedState,
        display,
        config
      );

      activeClef = resolvedState.clef;
      activeKeySignature = resolvedState.keySignature;
      activeTempo = resolvedState.tempo;

      return {
        measure,
        measureIndex,
        globalMeasureIndex: measureIndex,
        startBeat: timing.startBeat,
        endBeat: timing.endBeat,
        resolvedState,
        display,
        minimumWidth,
      };
    });

    return { staff, staffIndex, measures };
  });
}

function buildInfiniteScorePlan(input: {
  score: RendererScore;
  config: NormalizedRendererConfig;
  staffAnalyses: StaffAnalysis[];
  sortedStaves: RendererStaff[];
  timings: GlobalMeasureTiming[];
}): RendererPlan {
  const { score, config, staffAnalyses, sortedStaves, timings } = input;
  const totalMeasureCount = timings.length;
  const allocatedWidths = Array.from(
    { length: totalMeasureCount },
    (_, index) => {
      const widths = staffAnalyses
        .map(
          (staffAnalysis) => staffAnalysis.measures[index]?.minimumWidth ?? 0
        )
        .filter((width) => width > 0);

      return Math.max(config.spacing.minimumMeasureWidth, ...widths);
    }
  );

  const xPositions: number[] = [];
  let currentX = config.padding.left;

  allocatedWidths.forEach((width) => {
    xPositions.push(currentX);
    currentX += width + config.spacing.measureGap;
  });

  const systemWidth =
    allocatedWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, allocatedWidths.length - 1) * config.spacing.measureGap;

  const staffYPositions: number[] = [];
  let currentY = config.padding.top;

  sortedStaves.forEach((staff, staffIndex) => {
    staffYPositions[staffIndex] = currentY;
    const nextStaff = sortedStaves[staffIndex + 1];
    const gap = isGroupedWithNext(staff, nextStaff)
      ? config.spacing.groupGap
      : config.spacing.staffGap;
    currentY += config.spacing.staffHeight + gap;
  });

  const systemHeight =
    sortedStaves.length > 0
      ? staffYPositions[sortedStaves.length - 1]! -
        config.padding.top +
        config.spacing.staffHeight
      : 0;

  const contentSize = {
    width: Math.max(
      config.viewport.width,
      config.padding.left + systemWidth + config.padding.right
    ),
    height: Math.max(
      config.viewport.height,
      config.padding.top + systemHeight + config.padding.bottom
    ),
  };

  const staves: StaffPlan[] = staffAnalyses.map(({ staff, staffIndex }) => {
    const y = staffYPositions[staffIndex] ?? config.padding.top;
    return {
      staffId: staff.id,
      staffIndex,
      pageIndex: 0,
      systemIndex: 0,
      systemGroupId: staff.systemGroupId,
      systemGroupRole: staff.systemGroupRole,
      bounds: createRect(
        config.padding.left,
        y,
        systemWidth,
        config.spacing.staffHeight
      ),
      contentBounds: createRect(
        config.padding.left,
        y + config.spacing.staffInnerVerticalPadding,
        systemWidth,
        Math.max(
          1,
          config.spacing.staffHeight -
            config.spacing.staffInnerVerticalPadding * 2
        )
      ),
      measureIndices: [],
    };
  });

  const measures: MeasurePlan[] = [];

  staffAnalyses.forEach(({ staff, staffIndex, measures: staffMeasures }) => {
    staffMeasures.forEach((measureAnalysis) => {
      const x =
        xPositions[measureAnalysis.globalMeasureIndex] ?? config.padding.left;
      const y = staffYPositions[staffIndex] ?? config.padding.top;
      const allocatedWidth =
        allocatedWidths[measureAnalysis.globalMeasureIndex] ??
        measureAnalysis.minimumWidth;
      const measurePlan: MeasurePlan = {
        scoreId: score.id,
        staffId: staff.id,
        measureId: measureAnalysis.measure.id,
        pageIndex: 0,
        systemIndex: 0,
        staffIndex,
        measureIndex: measureAnalysis.measureIndex,
        globalMeasureIndex: measureAnalysis.globalMeasureIndex,
        bounds: createRect(x, y, allocatedWidth, config.spacing.staffHeight),
        contentBounds: createRect(
          x + config.spacing.measureHorizontalPadding,
          y + config.spacing.staffInnerVerticalPadding,
          Math.max(
            1,
            allocatedWidth - config.spacing.measureHorizontalPadding * 2
          ),
          Math.max(
            1,
            config.spacing.staffHeight -
              config.spacing.staffInnerVerticalPadding * 2
          )
        ),
        minimumWidth: measureAnalysis.minimumWidth,
        allocatedWidth,
        startBeat: measureAnalysis.startBeat,
        endBeat: measureAnalysis.endBeat,
        resolvedState: measureAnalysis.resolvedState,
        display: measureAnalysis.display,
      };
      measures.push(measurePlan);
      staves[staffIndex]?.measureIndices.push(measures.length - 1);
    });
  });

  const pageMeasureIndices = measures.map((_, index) => index);
  const page = {
    pageIndex: 0,
    bounds: createRect(0, 0, contentSize.width, contentSize.height),
    contentBounds: createRect(
      config.padding.left,
      config.padding.top,
      systemWidth,
      systemHeight
    ),
    systemIndices: [0],
    measureIndices: pageMeasureIndices,
  };
  const system = {
    systemIndex: 0,
    pageIndex: 0,
    bounds: createRect(
      config.padding.left,
      config.padding.top,
      systemWidth,
      systemHeight
    ),
    contentBounds: createRect(
      config.padding.left,
      config.padding.top,
      systemWidth,
      systemHeight
    ),
    staffIndices: staves.map((_, index) => index),
    measureIndices: pageMeasureIndices,
    range: {
      startMeasureIndex: 0,
      endMeasureIndex: totalMeasureCount,
    },
  };

  return {
    score,
    config,
    contentSize,
    pages: [page],
    systems: [system],
    staves,
    measures,
  };
}

const LAYOUT_STRATEGIES: Record<RendererLayoutMode, LayoutStrategy> = {
  infiniteScore: {
    buildPlan: buildInfiniteScorePlan,
  },
};

export function normalizeRendererConfig(
  config: RendererConfig
): NormalizedRendererConfig {
  return {
    layoutMode: 'infiniteScore',
    viewport: config.viewport,
    padding: {
      ...DEFAULT_RENDERER_PADDING,
      ...config.padding,
    },
    spacing: {
      ...DEFAULT_RENDERER_SPACING,
      ...config.spacing,
    },
    render: {
      ...DEFAULT_RENDERER_RENDER_OPTIONS,
      ...config.render,
    },
  };
}

export function measureScore(request: MeasureRequest): RendererPlan {
  const config = normalizeRendererConfig(request.config);
  const score = request.score;
  const sortedStaves = sortStaves(score);
  const timings = resolveGlobalMeasureTimings(score, sortedStaves);
  const staffAnalyses = analyzeStaves(score, sortedStaves, config, timings);

  return LAYOUT_STRATEGIES[config.layoutMode].buildPlan({
    score,
    config,
    staffAnalyses,
    sortedStaves,
    timings,
  });
}
