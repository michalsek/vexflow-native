// import type {
//   MeasureMeasurementPlan,
//   RendererPoint,
//   RendererRect,
//   RendererSize,
//   ScoreMeasurementPlan,
//   StaffMeasurementPlan,
//   Viewport,
//   VisibleViewport,
// } from './types';

// function clampOffset(
//   offset: number,
//   contentExtent: number,
//   viewportExtent: number
// ): number {
//   const maxOffset = Math.max(0, contentExtent - viewportExtent);

//   return Math.min(Math.max(offset, 0), maxOffset);
// }

// export function createVisibleViewport(
//   scrollOffset: RendererPoint,
//   viewport: Viewport,
//   contentSize: RendererSize
// ): VisibleViewport {
//   return {
//     x: clampOffset(scrollOffset.x, contentSize.width, viewport.width),
//     y: clampOffset(scrollOffset.y, contentSize.height, viewport.height),
//     width: viewport.width,
//     height: viewport.height,
//   };
// }

// export function intersectsRect(
//   left: RendererRect,
//   right: RendererRect
// ): boolean {
//   return (
//     left.x < right.x + right.width &&
//     left.x + left.width > right.x &&
//     left.y < right.y + right.height &&
//     left.y + left.height > right.y
//   );
// }

// export function filterVisibleMeasureIndices(
//   measureIndices: number[],
//   measures: MeasureMeasurementPlan[],
//   visibleViewport: VisibleViewport
// ): number[] {
//   return measureIndices.filter((measureIndex) => {
//     const measure = measures[measureIndex];

//     return measure ? intersectsRect(measure.bounds, visibleViewport) : false;
//   });
// }

// export function getVisibleStaffPlans(
//   plan: ScoreMeasurementPlan,
//   visibleViewport: VisibleViewport
// ): StaffMeasurementPlan[] {
//   return plan.staves.reduce<StaffMeasurementPlan[]>((visibleStaves, staff) => {
//     if (!intersectsRect(staff.bounds, visibleViewport)) {
//       return visibleStaves;
//     }

//     const visibleMeasureIndices = filterVisibleMeasureIndices(
//       staff.measureIndices,
//       plan.measures,
//       visibleViewport
//     );

//     if (visibleMeasureIndices.length === 0) {
//       return visibleStaves;
//     }

//     visibleStaves.push({
//       ...staff,
//       measureIndices: visibleMeasureIndices,
//     });

//     return visibleStaves;
//   }, []);
// }
