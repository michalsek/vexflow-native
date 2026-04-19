import { StaveConnector } from 'vexflow';

import type { SkiaVexflowContext } from '../base';
import type { Meter, Score, Staff } from '../state';
import { createRect } from './renderers/common';
import type { MeasureRenderOutput } from './renderers/MeasureRenderer';
import StaffRenderer from './renderers/StaffRenderer';
import { getMeasureQuarterBeats } from './timing';
import type {
  GlobalMeasureTiming,
  MeasureMeasurementPlan,
  RenderPassOptions,
  RenderResult,
  RendererType,
  ScoreMeasurementPlan,
  ScoreOptions,
  StaffMeasurementPlan,
  SystemGroupPlan,
  Viewport,
} from './types';
import { getVisibleStaffPlans, intersectsRect } from './viewport';

export default class Renderer {
  private ctx: SkiaVexflowContext;
  private readonly score: Score;
  private readonly viewport: Viewport;
  private readonly options: ScoreOptions;
  private readonly rendererType: RendererType;

  constructor(
    ctx: SkiaVexflowContext,
    viewport: Viewport,
    options: ScoreOptions,
    score: Score,
    rendererType: RendererType = 'documentEven'
  ) {
    this.ctx = ctx;
    this.viewport = viewport;
    this.options = options;
    this.score = score;
    this.rendererType = rendererType;
  }

  // ------------------
  // --- Measuring ---
  // ------------------

  measure(): ScoreMeasurementPlan {
    const sortedStaves = this.resolveSortedStaves();
    const timings = this.resolveTimings(sortedStaves);
    const measuredStaves = this.measureStaves(sortedStaves, timings);
    const globalMeasureWidths = this.resolveGlobalMeasureWidths(
      measuredStaves,
      timings.length
    );
    const staffYPositions = this.resolveStaffYPositions(sortedStaves);

    const measures: MeasureMeasurementPlan[] = [];
    const staves: StaffMeasurementPlan[] = measuredStaves.map(
      (measuredStaff, staffIndex) => {
        const y = staffYPositions[staffIndex] ?? this.options.insets.top;
        const measureIndices: number[] = [];

        measuredStaff.measurePlans.forEach((measurePlan) => {
          const allocatedWidth =
            globalMeasureWidths[measurePlan.globalMeasureIndex] ??
            measurePlan.minimumWidth;
          const leftReservation = this.measureLeftReservation(measurePlan);
          const nextPlan: MeasureMeasurementPlan = {
            ...measurePlan,
            allocatedWidth,
            bounds: createRect(
              this.options.insets.left,
              y,
              allocatedWidth,
              this.options.spacing.staffHeight
            ),
            contentBounds: createRect(
              this.options.insets.left +
                leftReservation +
                this.options.spacing.measureHorizontalPadding,
              y + this.options.spacing.staffInnerVerticalPadding,
              Math.max(
                1,
                allocatedWidth -
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

          measureIndices.push(measures.length);
          measures.push(nextPlan);
        });

        return {
          staffId: measuredStaff.staff.id,
          staffIndex,
          systemGroupId: measuredStaff.staff.systemGroupId,
          systemGroupRole: measuredStaff.staff.systemGroupRole,
          bounds: createRect(
            this.options.insets.left,
            y,
            globalMeasureWidths.reduce((sum, width) => sum + width, 0),
            this.options.spacing.staffHeight
          ),
          contentBounds: createRect(
            this.options.insets.left,
            y + this.options.spacing.staffInnerVerticalPadding,
            globalMeasureWidths.reduce((sum, width) => sum + width, 0),
            Math.max(
              1,
              this.options.spacing.staffHeight -
                this.options.spacing.staffInnerVerticalPadding * 2
            )
          ),
          measureIndices,
        };
      }
    );
    const systemGroups = this.measureSystemGroups(sortedStaves, staves);
    const systemWidth = globalMeasureWidths.reduce(
      (sum, width) => sum + width,
      0
    );
    const contentSize = {
      width: Math.max(
        this.viewport.width,
        this.options.insets.left + systemWidth + this.options.insets.right
      ),
      height: Math.max(
        this.viewport.height,
        (staffYPositions[staffYPositions.length - 1] ??
          this.options.insets.top) +
          this.options.spacing.staffHeight +
          this.options.insets.bottom
      ),
    };

    return {
      score: this.score,
      viewport: this.viewport,
      options: this.options,
      globalMeasureWidths,
      timings,
      staves,
      measures,
      systemGroups,
      contentSize,
    };
  }

  measureStaves(
    sortedStaves: Staff[],
    timings: GlobalMeasureTiming[]
  ): Array<{ staff: Staff; measurePlans: MeasureMeasurementPlan[] }> {
    return sortedStaves.map((staff, staffIndex) => ({
      staff,
      measurePlans: new StaffRenderer(
        this.ctx,
        this.score,
        staff,
        staffIndex,
        timings,
        this.options
      ).measure(),
    }));
  }

  measureSystemGroups(
    sortedStaves: Staff[],
    staves: StaffMeasurementPlan[]
  ): SystemGroupPlan[] {
    const groups: SystemGroupPlan[] = [];

    for (
      let staffIndex = 0;
      staffIndex < sortedStaves.length - 1;
      staffIndex += 1
    ) {
      const topStaff = sortedStaves[staffIndex];
      const bottomStaff = sortedStaves[staffIndex + 1];
      const topPlan = staves[staffIndex];

      if (
        !topStaff ||
        !bottomStaff ||
        !topPlan ||
        !topStaff.systemGroupId ||
        topStaff.systemGroupId !== bottomStaff.systemGroupId
      ) {
        continue;
      }

      groups.push({
        systemGroupId: topStaff.systemGroupId,
        topStaffId: topStaff.id,
        bottomStaffId: bottomStaff.id,
        measureIndices: topPlan.measureIndices,
      });
    }

    return groups;
  }

  private resolveSortedStaves(): Staff[] {
    return [...this.score.staves].sort(
      (left, right) => left.order - right.order
    );
  }

  private resolveTimings(sortedStaves: Staff[]): GlobalMeasureTiming[] {
    const totalMeasureCount = sortedStaves.reduce(
      (count, staff) => Math.max(count, staff.measures.length),
      0
    );
    const timings: GlobalMeasureTiming[] = [];
    let currentBeat = 0;
    let activeMeter = this.score.defaultMeter;

    for (
      let measureIndex = 0;
      measureIndex < totalMeasureCount;
      measureIndex += 1
    ) {
      const explicitMeter = sortedStaves
        .map((staff) => staff.measures[measureIndex]?.meter)
        .find((meter): meter is Meter => meter !== undefined);

      if (explicitMeter) {
        activeMeter = explicitMeter;
      }

      const measureBeats = getMeasureQuarterBeats(activeMeter);

      timings.push({
        measureIndex,
        startBeat: currentBeat,
        endBeat: currentBeat + measureBeats,
        meter: activeMeter,
        showTimeSignature:
          measureIndex === 0 ||
          sortedStaves.some(
            (staff) => staff.measures[measureIndex]?.meter !== undefined
          ),
      });
      currentBeat += measureBeats;
    }

    return timings;
  }

  private resolveGlobalMeasureWidths(
    measuredStaves: Array<{
      staff: Staff;
      measurePlans: MeasureMeasurementPlan[];
    }>,
    totalMeasureCount: number
  ): number[] {
    return Array.from({ length: totalMeasureCount }, (_, measureIndex) => {
      const widths = measuredStaves
        .map(
          (staffEntry) => staffEntry.measurePlans[measureIndex]?.minimumWidth
        )
        .filter((width): width is number => width !== undefined);

      return Math.max(this.options.spacing.minimumMeasureWidth, ...widths);
    });
  }

  private resolveStaffYPositions(sortedStaves: Staff[]): number[] {
    const positions: number[] = [];
    let currentY = this.options.insets.top;

    sortedStaves.forEach((staff, staffIndex) => {
      positions.push(currentY);

      if (staffIndex === sortedStaves.length - 1) {
        return;
      }

      currentY +=
        this.options.spacing.staffHeight +
        (this.isGroupedWithNext(staff, sortedStaves[staffIndex + 1])
          ? this.options.spacing.groupGap
          : this.options.spacing.staffGap);
    });

    return positions;
  }

  private isGroupedWithNext(
    currentStaff: Staff,
    nextStaff: Staff | undefined
  ): boolean {
    if (!nextStaff) {
      return false;
    }

    return (
      currentStaff.systemGroupId !== undefined &&
      currentStaff.systemGroupId === nextStaff.systemGroupId
    );
  }

  private measureLeftReservation(plan: MeasureMeasurementPlan): number {
    return Math.max(
      plan.modifierReservations.clef +
        plan.modifierReservations.keySignature +
        plan.modifierReservations.timeSignature +
        plan.modifierReservations.barlines,
      plan.modifierReservations.tempo,
      plan.modifierReservations.directions
    );
  }

  // -----------------
  // --- Layouting ---
  // -----------------

  layout(plan: ScoreMeasurementPlan): ScoreMeasurementPlan {
    switch (this.rendererType) {
      case 'document':
        return this.layoutLineBasedPlan(
          plan,
          this.resolveDocumentLines(plan.globalMeasureWidths)
        );
      case 'documentEven':
        return this.layoutLineBasedPlan(
          plan,
          this.resolveDocumentEvenLines(plan.globalMeasureWidths)
        );
      case 'infiniteScore':
      default:
        return this.layoutLineBasedPlan(plan, [
          {
            globalMeasureIndices: plan.globalMeasureWidths.map(
              (_, index) => index
            ),
            widths: [...plan.globalMeasureWidths],
          },
        ]);
    }
  }

  private resolveDocumentLines(globalMeasureWidths: number[]): LayoutLine[] {
    const availableWidth = this.resolveAvailableSystemWidth();
    const lines: LayoutLine[] = [];
    let lineStart = 0;

    while (lineStart < globalMeasureWidths.length) {
      const lineIndices: number[] = [];
      const lineWidths: number[] = [];
      let lineWidth = 0;
      let nextIndex = lineStart;

      while (nextIndex < globalMeasureWidths.length) {
        const nextWidth = globalMeasureWidths[nextIndex] ?? 0;
        const nextLineWidth = lineWidth + nextWidth;

        if (lineIndices.length > 0 && nextLineWidth > availableWidth) {
          break;
        }

        lineIndices.push(nextIndex);
        lineWidths.push(nextWidth);
        lineWidth = nextLineWidth;
        nextIndex += 1;

        if (lineWidth > availableWidth) {
          break;
        }
      }

      lines.push({
        globalMeasureIndices: lineIndices,
        widths: lineWidths,
      });
      lineStart = nextIndex;
    }

    return lines.map((line, lineIndex) => {
      if (lineIndex === lines.length - 1) {
        return line;
      }

      const widthSum = line.widths.reduce((sum, width) => sum + width, 0);
      const scale = widthSum > 0 ? availableWidth / widthSum : 1;

      return {
        globalMeasureIndices: line.globalMeasureIndices,
        widths: line.widths.map((width) => width * scale),
      };
    });
  }

  private resolveDocumentEvenLines(
    globalMeasureWidths: number[]
  ): LayoutLine[] {
    const availableWidth = this.resolveAvailableSystemWidth();
    const uniformBaseWidth = Math.max(
      this.options.spacing.minimumMeasureWidth,
      ...globalMeasureWidths
    );
    const measuresPerLine = Math.max(
      1,
      Math.floor(availableWidth / uniformBaseWidth)
    );
    const fullLineWidth = availableWidth / measuresPerLine;
    const lines: LayoutLine[] = [];

    for (
      let lineStart = 0;
      lineStart < globalMeasureWidths.length;
      lineStart += measuresPerLine
    ) {
      const globalMeasureIndices = globalMeasureWidths
        .slice(lineStart, lineStart + measuresPerLine)
        .map((_, index) => lineStart + index);

      lines.push({
        globalMeasureIndices,
        widths: globalMeasureIndices.map(() => fullLineWidth),
      });
    }

    return lines;
  }

  private layoutLineBasedPlan(
    plan: ScoreMeasurementPlan,
    lines: LayoutLine[]
  ): ScoreMeasurementPlan {
    const sortedStaves = this.resolveSortedStaves();
    const staffOffsets = this.resolveStaffYPositions(sortedStaves).map(
      (position) => position - this.options.insets.top
    );
    const systemHeight =
      (staffOffsets[staffOffsets.length - 1] ?? 0) +
      this.options.spacing.staffHeight;
    const measuresByGlobalIndex = new Map<
      number,
      Array<{ plan: MeasureMeasurementPlan; measurePlanIndex: number }>
    >();

    plan.measures.forEach((measurePlan, measurePlanIndex) => {
      const measurePlans =
        measuresByGlobalIndex.get(measurePlan.globalMeasureIndex) ?? [];

      measurePlans.push({
        plan: measurePlan,
        measurePlanIndex,
      });
      measuresByGlobalIndex.set(measurePlan.globalMeasureIndex, measurePlans);
    });

    const laidOutStaves: StaffMeasurementPlan[] = [];
    const laidOutGroups: SystemGroupPlan[] = [];
    const laidOutGlobalMeasureWidths = [...plan.globalMeasureWidths];
    let currentSystemY = this.options.insets.top;
    let maxLineWidth = 0;

    lines.forEach((line, lineIndex) => {
      const snappedLine = this.snapLineBoundaries(line.widths);
      const lineWidth = snappedLine.widths.reduce(
        (sum, width) => sum + width,
        0
      );
      const measureIndicesByStaff = new Map<Staff['id'], number[]>();

      maxLineWidth = Math.max(maxLineWidth, lineWidth);

      line.globalMeasureIndices.forEach((globalMeasureIndex, index) => {
        const allocatedWidth = snappedLine.widths[index] ?? 0;
        const matchingMeasurePlans =
          measuresByGlobalIndex.get(globalMeasureIndex) ?? [];

        laidOutGlobalMeasureWidths[globalMeasureIndex] = allocatedWidth;

        matchingMeasurePlans.forEach(
          ({ plan: measurePlan, measurePlanIndex }) => {
            this.layoutMeasure(
              measurePlan,
              snappedLine.positions[index] ?? this.options.insets.left,
              currentSystemY,
              allocatedWidth
            );

            const staffMeasureIndices =
              measureIndicesByStaff.get(measurePlan.staffId) ?? [];

            staffMeasureIndices.push(measurePlanIndex);
            measureIndicesByStaff.set(measurePlan.staffId, staffMeasureIndices);
          }
        );
      });

      const lineStaffPlans: StaffMeasurementPlan[] = [];

      sortedStaves.forEach((staff, staffIndex) => {
        const measureIndices = measureIndicesByStaff.get(staff.id) ?? [];

        if (measureIndices.length === 0) {
          return;
        }

        const y = currentSystemY + (staffOffsets[staffIndex] ?? 0);

        lineStaffPlans.push({
          staffId: staff.id,
          staffIndex,
          systemGroupId: staff.systemGroupId,
          systemGroupRole: staff.systemGroupRole,
          bounds: createRect(
            this.options.insets.left,
            y,
            lineWidth,
            this.options.spacing.staffHeight
          ),
          contentBounds: createRect(
            this.options.insets.left,
            y + this.options.spacing.staffInnerVerticalPadding,
            lineWidth,
            Math.max(
              1,
              this.options.spacing.staffHeight -
                this.options.spacing.staffInnerVerticalPadding * 2
            )
          ),
          measureIndices,
        });
      });

      laidOutStaves.push(...lineStaffPlans);
      laidOutGroups.push(
        ...this.resolveLineSystemGroups(sortedStaves, lineStaffPlans)
      );

      if (lineIndex < lines.length - 1) {
        currentSystemY += systemHeight + this.options.spacing.systemGap;
      }
    });

    plan.globalMeasureWidths = laidOutGlobalMeasureWidths;
    plan.staves = laidOutStaves;
    plan.systemGroups = laidOutGroups;
    plan.contentSize = {
      width: Math.max(
        this.viewport.width,
        this.options.insets.left + maxLineWidth + this.options.insets.right
      ),
      height: Math.max(
        this.viewport.height,
        currentSystemY + systemHeight + this.options.insets.bottom
      ),
    };

    return plan;
  }

  private snapLineBoundaries(widths: number[]): SnappedLineLayout {
    const pixelRatio = Math.max(1, this.options.render.pixelRatio || 1);
    const startX = this.options.insets.left;
    const endX = startX + widths.reduce((sum, width) => sum + width, 0);
    const boundaries = widths.reduce<number[]>(
      (positions, width) => [
        ...positions,
        (positions[positions.length - 1] ?? startX) + width,
      ],
      [startX]
    );
    const snappedBoundaries = boundaries.map((boundary, index) => {
      if (index === 0) {
        return startX;
      }

      if (index === boundaries.length - 1) {
        return endX;
      }

      return this.snapToPixelGrid(boundary, pixelRatio);
    });

    return {
      positions: snappedBoundaries.slice(0, -1),
      widths: snappedBoundaries
        .slice(1)
        .map((boundary, index) => boundary - snappedBoundaries[index]!),
    };
  }

  private snapToPixelGrid(value: number, pixelRatio: number): number {
    return Math.round(value * pixelRatio) / pixelRatio;
  }

  private resolveLineSystemGroups(
    sortedStaves: Staff[],
    staves: StaffMeasurementPlan[]
  ): SystemGroupPlan[] {
    const stavesById = new Map(staves.map((staff) => [staff.staffId, staff]));
    const groups: SystemGroupPlan[] = [];

    for (
      let staffIndex = 0;
      staffIndex < sortedStaves.length - 1;
      staffIndex += 1
    ) {
      const topStaff = sortedStaves[staffIndex];
      const bottomStaff = sortedStaves[staffIndex + 1];
      const topPlan = topStaff ? stavesById.get(topStaff.id) : undefined;
      const bottomPlan = bottomStaff
        ? stavesById.get(bottomStaff.id)
        : undefined;

      if (
        !topStaff ||
        !bottomStaff ||
        !topPlan ||
        !bottomPlan ||
        !topStaff.systemGroupId ||
        topStaff.systemGroupId !== bottomStaff.systemGroupId
      ) {
        continue;
      }

      groups.push({
        systemGroupId: topStaff.systemGroupId,
        topStaffId: topStaff.id,
        bottomStaffId: bottomStaff.id,
        measureIndices: topPlan.measureIndices,
      });
    }

    return groups;
  }

  private layoutMeasure(
    plan: MeasureMeasurementPlan,
    x: number,
    systemY: number,
    allocatedWidth: number
  ): void {
    const y = systemY + this.resolveStaffOffset(plan.staffIndex);
    const leftReservation = this.measureLeftReservation(plan);

    plan.allocatedWidth = allocatedWidth;
    plan.bounds = createRect(
      x,
      y,
      allocatedWidth,
      this.options.spacing.staffHeight
    );
    plan.contentBounds = createRect(
      x + leftReservation + this.options.spacing.measureHorizontalPadding,
      y + this.options.spacing.staffInnerVerticalPadding,
      Math.max(
        1,
        allocatedWidth -
          leftReservation -
          this.options.spacing.measureHorizontalPadding * 2
      ),
      Math.max(
        1,
        this.options.spacing.staffHeight -
          this.options.spacing.staffInnerVerticalPadding * 2
      )
    );
  }

  private resolveAvailableSystemWidth(): number {
    return Math.max(
      1,
      this.viewport.width - this.options.insets.left - this.options.insets.right
    );
  }

  private resolveStaffOffset(staffIndex: number): number {
    const sortedStaves = this.resolveSortedStaves();
    const yPositions = this.resolveStaffYPositions(sortedStaves);

    return (
      (yPositions[staffIndex] ?? this.options.insets.top) -
      this.options.insets.top
    );
  }

  // -----------------
  // --- Rendering ---
  // -----------------

  render(
    plan: ScoreMeasurementPlan,
    options: RenderPassOptions = {}
  ): RenderResult {
    const renderedStaves = new Map<
      Staff['id'],
      Map<number, MeasureRenderOutput>
    >();
    const measureLayouts: RenderResult['measureLayouts'] = [];
    const noteBounds: RenderResult['noteBounds'] = [];
    const visibleStaffPlans = options.visibleViewport
      ? getVisibleStaffPlans(plan, options.visibleViewport)
      : plan.staves;

    this.ctx.clear();

    this.renderStaves(plan, visibleStaffPlans, options).forEach(
      ({ staffId, outputs }) => {
        const byMeasureIndex =
          renderedStaves.get(staffId) ?? new Map<number, MeasureRenderOutput>();

        outputs.forEach((output) => {
          byMeasureIndex.set(output.layout.globalMeasureIndex, output);
          measureLayouts.push(output.layout);
          noteBounds.push(
            ...output.noteBounds.filter((noteBound) =>
              options.visibleViewport
                ? intersectsRect(noteBound.bounds, options.visibleViewport)
                : true
            )
          );
        });

        renderedStaves.set(staffId, byMeasureIndex);
      }
    );

    this.renderSystemGroups(plan.systemGroups, renderedStaves);

    return {
      contentSize: plan.contentSize,
      measureLayouts,
      noteBounds,
    };
  }

  renderStaves(
    plan: ScoreMeasurementPlan,
    staffPlans: StaffMeasurementPlan[],
    options: RenderPassOptions = {}
  ): Array<{
    staffId: Staff['id'];
    outputs: MeasureRenderOutput[];
  }> {
    const sortedStaves = this.resolveSortedStaves();

    return staffPlans.map((staffPlan) => {
      const staff = sortedStaves.find(
        (candidate) => candidate.id === staffPlan.staffId
      );

      if (!staff) {
        return {
          staffId: staffPlan.staffId,
          outputs: [],
        };
      }

      const outputs = new StaffRenderer(
        this.ctx,
        this.score,
        staff,
        staffPlan.staffIndex,
        plan.timings,
        this.options
      ).render(staffPlan, plan.measures, options.visibleViewport);

      return {
        staffId: staffPlan.staffId,
        outputs,
      };
    });
  }

  renderSystemGroups(
    systemGroups: SystemGroupPlan[],
    renderedStaves: Map<Staff['id'], Map<number, MeasureRenderOutput>>
  ): void {
    systemGroups.forEach((group) => {
      const firstMeasureIndex = group.measureIndices[0];
      const lastMeasureIndex =
        group.measureIndices[group.measureIndices.length - 1];

      if (firstMeasureIndex === undefined || lastMeasureIndex === undefined) {
        return;
      }

      const topFirst = renderedStaves
        .get(group.topStaffId)
        ?.get(firstMeasureIndex)?.stave;
      const bottomFirst = renderedStaves
        .get(group.bottomStaffId)
        ?.get(firstMeasureIndex)?.stave;
      const topLast = renderedStaves
        .get(group.topStaffId)
        ?.get(lastMeasureIndex)?.stave;
      const bottomLast = renderedStaves
        .get(group.bottomStaffId)
        ?.get(lastMeasureIndex)?.stave;

      if (topFirst && bottomFirst) {
        new StaveConnector(topFirst, bottomFirst)
          .setType(StaveConnector.type.BRACE as never)
          .setContext(this.ctx)
          .draw();
        new StaveConnector(topFirst, bottomFirst)
          .setType(StaveConnector.type.SINGLE_LEFT as never)
          .setContext(this.ctx)
          .draw();
      }

      if (topLast && bottomLast) {
        new StaveConnector(topLast, bottomLast)
          .setType(StaveConnector.type.SINGLE_RIGHT as never)
          .setContext(this.ctx)
          .draw();
      }
    });
  }
}

interface LayoutLine {
  globalMeasureIndices: number[];
  widths: number[];
}

interface SnappedLineLayout {
  positions: number[];
  widths: number[];
}
