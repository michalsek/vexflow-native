import type SkiaVexflowContext from '../../base/SkiaVexflowContext';
import type { Score, Staff } from '../../state';
import type {
  GlobalMeasureTiming,
  MeasureMeasurementPlan,
  ScoreOptions,
  StaffMeasurementPlan,
} from '../types';
import { createRect } from './common';
import type { MeasureRenderOutput } from './MeasureRenderer';
import MeasureRenderer from './MeasureRenderer';

export default class StaffRenderer {
  constructor(
    private readonly ctx: SkiaVexflowContext,
    private readonly score: Score,
    private readonly staff: Staff,
    private readonly staffIndex: number,
    private readonly timings: GlobalMeasureTiming[],
    private readonly options: ScoreOptions
  ) {}

  // ------------------
  // --- Measuring ---
  // ------------------

  measure(): MeasureMeasurementPlan[] {
    const measurePlans: MeasureMeasurementPlan[] = [];
    let previousState: MeasureMeasurementPlan['resolvedState'] | undefined;

    this.staff.measures.forEach((measure, measureIndex) => {
      const timing = this.timings[measureIndex];

      if (!timing) {
        return;
      }

      const plan = new MeasureRenderer(
        this.ctx,
        this.score,
        this.staff,
        measure,
        this.staffIndex,
        measureIndex,
        measureIndex,
        timing,
        this.options
      ).measure(previousState);

      measurePlans.push(plan);
      previousState = plan.resolvedState;
    });

    return measurePlans;
  }

  buildPlan(
    y: number,
    width: number,
    measureIndices: number[]
  ): StaffMeasurementPlan {
    return {
      staffId: this.staff.id,
      staffIndex: this.staffIndex,
      systemGroupId: this.staff.systemGroupId,
      systemGroupRole: this.staff.systemGroupRole,
      bounds: createRect(0, y, width, this.options.spacing.staffHeight),
      contentBounds: createRect(
        0,
        y + this.options.spacing.staffInnerVerticalPadding,
        width,
        Math.max(
          1,
          this.options.spacing.staffHeight -
            this.options.spacing.staffInnerVerticalPadding * 2
        )
      ),
      measureIndices,
    };
  }

  // -----------------
  // --- Layouting ---
  // -----------------

  // -----------------
  // --- Rendering ---
  // -----------------

  render(
    staffPlan: StaffMeasurementPlan,
    measurePlans: MeasureMeasurementPlan[]
  ): MeasureRenderOutput[] {
    return staffPlan.measureIndices
      .map((measurePlanIndex) => measurePlans[measurePlanIndex])
      .filter((plan): plan is MeasureMeasurementPlan => plan !== undefined)
      .map((plan) =>
        new MeasureRenderer(
          this.ctx,
          this.score,
          this.staff,
          this.staff.measures[plan.measureIndex]!,
          this.staffIndex,
          plan.measureIndex,
          plan.globalMeasureIndex,
          this.timings[plan.globalMeasureIndex]!,
          this.options
        ).render(plan)
      );
  }
}
