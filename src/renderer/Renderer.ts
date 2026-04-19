import { StaveConnector } from 'vexflow';

import type { SkiaVexflowContext } from '../base';
import type { Meter, Score, Staff } from '../state';
import { getMeasureQuarterBeats } from './timing';
import type {
  GlobalMeasureTiming,
  MeasureMeasurementPlan,
  RenderResult,
  RendererType,
  ScoreMeasurementPlan,
  ScoreOptions,
  StaffMeasurementPlan,
  SystemGroupPlan,
  Viewport,
} from './types';
import { createRect } from './renderers/common';
import type { MeasureRenderOutput } from './renderers/MeasureRenderer';
import StaffRenderer from './renderers/StaffRenderer';

export default class Renderer {
  private readonly ctx: SkiaVexflowContext;
  private readonly score: Score;
  private readonly viewport: Viewport;
  private readonly options: ScoreOptions;

  constructor(
    ctx: SkiaVexflowContext,
    viewport: Viewport,
    options: ScoreOptions,
    score: Score,
    _type: RendererType = 'documentEven'
  ) {
    this.ctx = ctx;
    this.viewport = viewport;
    this.options = options;
    this.score = score;
  }

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

  render(): RenderResult {
    const plan = this.measure();
    const renderedStaves = new Map<
      Staff['id'],
      Map<number, MeasureRenderOutput>
    >();
    const measureLayouts: RenderResult['measureLayouts'] = [];
    const noteBounds: RenderResult['noteBounds'] = [];

    this.ctx.clear();

    this.renderStaves(plan).forEach(({ staffId, outputs }) => {
      const byMeasureIndex = new Map<number, MeasureRenderOutput>();

      outputs.forEach((output) => {
        byMeasureIndex.set(output.layout.globalMeasureIndex, output);
        measureLayouts.push(output.layout);
        noteBounds.push(...output.noteBounds);
      });

      renderedStaves.set(staffId, byMeasureIndex);
    });

    this.renderSystemGroups(plan.systemGroups, renderedStaves);

    return {
      contentSize: plan.contentSize,
      measureLayouts,
      noteBounds,
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

  renderStaves(plan: ScoreMeasurementPlan): Array<{
    staffId: Staff['id'];
    outputs: MeasureRenderOutput[];
  }> {
    const sortedStaves = this.resolveSortedStaves();

    return plan.staves.map((staffPlan) => {
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
      ).render(staffPlan, plan.measures);

      return {
        staffId: staffPlan.staffId,
        outputs,
      };
    });
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
}
