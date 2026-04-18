import type {
  MeasurePlan,
  PagePlan,
  RendererRect,
  RendererScore,
  RendererStaff,
  StaffPlan,
  SystemPlan,
} from '../types';

import { stableSerialize } from './FingerprintUtils';
import type {
  GlobalMeasureTiming,
  NormalizedConfigResult,
  StaffAnalysis,
} from './types';

interface LayoutCache {
  measureWidthFingerprints: string[];
  allocatedWidths: number[];
  xPositions: number[];
  staffOrderFingerprint?: string;
  staffYPositions: number[];
  systemWidth: number;
  systemHeight: number;
  horizontalLayoutFingerprint?: string;
  verticalLayoutFingerprint?: string;
}

function createRect(
  x: number,
  y: number,
  width: number,
  height: number
): RendererRect {
  return { x, y, width, height };
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

export class InfiniteScoreLayoutPlanner {
  private cache: LayoutCache = {
    measureWidthFingerprints: [],
    allocatedWidths: [],
    xPositions: [],
    staffYPositions: [],
    systemWidth: 0,
    systemHeight: 0,
  };

  buildPlan(input: {
    score: RendererScore;
    config: NormalizedConfigResult;
    staffAnalyses: StaffAnalysis[];
    sortedStaves: RendererStaff[];
    timings: GlobalMeasureTiming[];
  }) {
    const { config, score, staffAnalyses, sortedStaves, timings } = input;
    const measureWidthFingerprints = this.buildMeasureWidthFingerprints(
      config,
      staffAnalyses,
      timings.length
    );
    const allocatedWidthStartIndex = this.findFirstDirtyMeasureIndex(
      measureWidthFingerprints
    );

    if (allocatedWidthStartIndex !== null) {
      this.recomputeAllocatedWidthsFromIndex(
        allocatedWidthStartIndex,
        config,
        staffAnalyses,
        timings.length
      );
      this.cache.measureWidthFingerprints = measureWidthFingerprints;
    }

    const shouldRecomputeHorizontal =
      allocatedWidthStartIndex !== null ||
      this.cache.horizontalLayoutFingerprint !==
        config.horizontalLayoutFingerprint;

    if (shouldRecomputeHorizontal) {
      this.recomputeXPositionsFromIndex(allocatedWidthStartIndex ?? 0, config);
      this.cache.horizontalLayoutFingerprint =
        config.horizontalLayoutFingerprint;
    }

    const staffOrderFingerprint = stableSerialize(
      sortedStaves.map((staff) => ({
        id: staff.id,
        order: staff.order,
        systemGroupId: staff.systemGroupId,
        systemGroupRole: staff.systemGroupRole,
      }))
    );

    if (
      this.cache.verticalLayoutFingerprint !==
        config.verticalLayoutFingerprint ||
      this.cache.staffOrderFingerprint !== staffOrderFingerprint
    ) {
      this.recomputeStaffYPositions(sortedStaves, config);
      this.cache.verticalLayoutFingerprint = config.verticalLayoutFingerprint;
      this.cache.staffOrderFingerprint = staffOrderFingerprint;
    }

    const contentSize = {
      width: Math.max(
        config.config.viewport.width,
        config.config.padding.left +
          this.cache.systemWidth +
          config.config.padding.right
      ),
      height: Math.max(
        config.config.viewport.height,
        config.config.padding.top +
          this.cache.systemHeight +
          config.config.padding.bottom
      ),
    };
    const staves: StaffPlan[] = staffAnalyses.map(({ staff, staffIndex }) => {
      const y =
        this.cache.staffYPositions[staffIndex] ?? config.config.padding.top;

      return {
        staffId: staff.id,
        staffIndex,
        pageIndex: 0,
        systemIndex: 0,
        systemGroupId: staff.systemGroupId,
        systemGroupRole: staff.systemGroupRole,
        bounds: createRect(
          config.config.padding.left,
          y,
          this.cache.systemWidth,
          config.config.spacing.staffHeight
        ),
        contentBounds: createRect(
          config.config.padding.left,
          y + config.config.spacing.staffInnerVerticalPadding,
          this.cache.systemWidth,
          Math.max(
            1,
            config.config.spacing.staffHeight -
              config.config.spacing.staffInnerVerticalPadding * 2
          )
        ),
        measureIndices: [],
      };
    });
    const measures: MeasurePlan[] = [];

    staffAnalyses.forEach(({ staff, staffIndex, measures: staffMeasures }) => {
      staffMeasures.forEach((measureAnalysis) => {
        const x =
          this.cache.xPositions[measureAnalysis.globalMeasureIndex] ??
          config.config.padding.left;
        const y =
          this.cache.staffYPositions[staffIndex] ?? config.config.padding.top;
        const allocatedWidth =
          this.cache.allocatedWidths[measureAnalysis.globalMeasureIndex] ??
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
          bounds: createRect(
            x,
            y,
            allocatedWidth,
            config.config.spacing.staffHeight
          ),
          contentBounds: createRect(
            x + config.config.spacing.measureHorizontalPadding,
            y + config.config.spacing.staffInnerVerticalPadding,
            Math.max(
              1,
              allocatedWidth -
                config.config.spacing.measureHorizontalPadding * 2
            ),
            Math.max(
              1,
              config.config.spacing.staffHeight -
                config.config.spacing.staffInnerVerticalPadding * 2
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
    const page: PagePlan = {
      pageIndex: 0,
      bounds: createRect(0, 0, contentSize.width, contentSize.height),
      contentBounds: createRect(
        config.config.padding.left,
        config.config.padding.top,
        this.cache.systemWidth,
        this.cache.systemHeight
      ),
      systemIndices: [0],
      measureIndices: pageMeasureIndices,
    };
    const system: SystemPlan = {
      systemIndex: 0,
      pageIndex: 0,
      bounds: createRect(
        config.config.padding.left,
        config.config.padding.top,
        this.cache.systemWidth,
        this.cache.systemHeight
      ),
      contentBounds: createRect(
        config.config.padding.left,
        config.config.padding.top,
        this.cache.systemWidth,
        this.cache.systemHeight
      ),
      staffIndices: staves.map((_, index) => index),
      measureIndices: pageMeasureIndices,
      range: {
        startMeasureIndex: 0,
        endMeasureIndex: timings.length,
      },
    };

    return {
      score,
      config: config.config,
      contentSize,
      pages: [page],
      systems: [system],
      staves,
      measures,
    };
  }

  public recomputeAllocatedWidthsFromIndex(
    startIndex: number,
    config: NormalizedConfigResult,
    staffAnalyses: StaffAnalysis[],
    totalMeasureCount: number
  ): void {
    const nextWidths = this.cache.allocatedWidths.slice(0, startIndex);

    for (
      let measureIndex = startIndex;
      measureIndex < totalMeasureCount;
      measureIndex += 1
    ) {
      const widths = staffAnalyses
        .map(
          (staffAnalysis) =>
            staffAnalysis.measures[measureIndex]?.minimumWidth ?? 0
        )
        .filter((width) => width > 0);

      nextWidths[measureIndex] = Math.max(
        config.config.spacing.minimumMeasureWidth,
        ...widths
      );
    }

    this.cache.allocatedWidths = nextWidths;
  }

  public recomputeXPositionsFromIndex(
    startIndex: number,
    config: NormalizedConfigResult
  ): void {
    const nextXPositions = this.cache.xPositions.slice(0, startIndex);
    let currentX =
      startIndex > 0
        ? (nextXPositions[startIndex - 1] ?? config.config.padding.left) +
          (this.cache.allocatedWidths[startIndex - 1] ?? 0)
        : config.config.padding.left;

    for (
      let measureIndex = startIndex;
      measureIndex < this.cache.allocatedWidths.length;
      measureIndex += 1
    ) {
      nextXPositions[measureIndex] = currentX;
      currentX = currentX + (this.cache.allocatedWidths[measureIndex] ?? 0);
    }

    this.cache.xPositions = nextXPositions;
    this.cache.systemWidth = this.cache.allocatedWidths.reduce(
      (sum, width) => sum + width,
      0
    );
  }

  public recomputeStaffYPositions(
    sortedStaves: RendererStaff[],
    config: NormalizedConfigResult
  ): void {
    const nextYPositions: number[] = [];
    let currentY = config.config.padding.top;

    sortedStaves.forEach((staff, staffIndex) => {
      nextYPositions[staffIndex] = currentY;
      const nextStaff = sortedStaves[staffIndex + 1];
      const gap = isGroupedWithNext(staff, nextStaff)
        ? config.config.spacing.groupGap
        : config.config.spacing.staffGap;

      currentY += config.config.spacing.staffHeight + gap;
    });

    this.cache.staffYPositions = nextYPositions;
    this.cache.systemHeight =
      sortedStaves.length > 0
        ? nextYPositions[sortedStaves.length - 1]! -
          config.config.padding.top +
          config.config.spacing.staffHeight
        : 0;
  }

  private buildMeasureWidthFingerprints(
    config: NormalizedConfigResult,
    staffAnalyses: StaffAnalysis[],
    totalMeasureCount: number
  ): string[] {
    return Array.from({ length: totalMeasureCount }, (_, measureIndex) =>
      stableSerialize({
        measureWidthFingerprint: config.measureWidthFingerprint,
        widths: staffAnalyses.map(
          (staffAnalysis) =>
            staffAnalysis.measures[measureIndex]?.minimumWidth ?? 0
        ),
      })
    );
  }

  private findFirstDirtyMeasureIndex(
    measureWidthFingerprints: string[]
  ): number | null {
    const sharedCount = Math.min(
      measureWidthFingerprints.length,
      this.cache.measureWidthFingerprints.length
    );

    for (let measureIndex = 0; measureIndex < sharedCount; measureIndex += 1) {
      if (
        this.cache.measureWidthFingerprints[measureIndex] !==
        measureWidthFingerprints[measureIndex]
      ) {
        return measureIndex;
      }
    }

    if (
      measureWidthFingerprints.length !==
      this.cache.measureWidthFingerprints.length
    ) {
      return sharedCount;
    }

    return null;
  }
}
