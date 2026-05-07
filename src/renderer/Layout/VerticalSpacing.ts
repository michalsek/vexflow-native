import type { StaffVerticalBounds } from '../measure';
import type { MeasuredGroupMeasure } from '../layout';
import {
  VEXFLOW_STAVE_BOTTOM_LINE_OFFSET,
  VEXFLOW_STAVE_TOP_LINE_OFFSET,
} from './LayoutMetrics';

const STAFF_ARTIFACT_CLEARANCE = 12;

export interface SystemVerticalLayout {
  height: number;
  staffYOffsets: number[];
  visibleBottom: number;
  visibleTop: number;
}

export function resolveSystemVerticalLayout(
  measures: MeasuredGroupMeasure[],
  staffCount: number,
  staffGap: number
): SystemVerticalLayout {
  const staffBounds = resolveStaffBounds(measures, staffCount);
  const rawStaffYOffsets = resolveRawStaffYOffsets(staffBounds, staffGap);
  const rawVisibleTop = getVisibleTop(staffBounds, rawStaffYOffsets);
  const rawVisibleBottom = getVisibleBottom(staffBounds, rawStaffYOffsets);
  const topShift = rawVisibleTop < 0 ? -rawVisibleTop : 0;
  const staffYOffsets = rawStaffYOffsets.map((offset) => offset + topShift);
  const visibleTop = rawVisibleTop + topShift;
  const visibleBottom = rawVisibleBottom + topShift;

  return {
    height: Math.max(0, visibleBottom),
    staffYOffsets,
    visibleBottom,
    visibleTop,
  };
}

function resolveStaffBounds(
  measures: MeasuredGroupMeasure[],
  staffCount: number
): StaffVerticalBounds[] {
  return Array.from({ length: staffCount }, (_, staffIndex) => {
    const bounds = measures
      .map((measure) => measure.staffBounds[staffIndex])
      .filter((staffBounds): staffBounds is StaffVerticalBounds =>
        Boolean(staffBounds)
      );

    return bounds.reduce(
      (merged, staffBounds) => ({
        top: Math.min(merged.top, staffBounds.top),
        bottom: Math.max(merged.bottom, staffBounds.bottom),
      }),
      defaultStaffBounds()
    );
  });
}

function resolveRawStaffYOffsets(
  staffBounds: StaffVerticalBounds[],
  staffGap: number
): number[] {
  if (staffBounds.length === 0) {
    return [];
  }

  const offsets = [0];

  for (let staffIndex = 1; staffIndex < staffBounds.length; staffIndex++) {
    const previousBounds = staffBounds[staffIndex - 1]!;
    const currentBounds = staffBounds[staffIndex]!;
    const previousOffset = offsets[staffIndex - 1]!;
    const minimumOriginOffset = previousOffset + staffGap;
    const minimumCollisionFreeOffset =
      previousOffset +
      previousBounds.bottom +
      STAFF_ARTIFACT_CLEARANCE -
      currentBounds.top;

    offsets.push(Math.max(minimumOriginOffset, minimumCollisionFreeOffset));
  }

  return offsets;
}

function getVisibleTop(
  staffBounds: StaffVerticalBounds[],
  staffYOffsets: number[]
): number {
  if (staffBounds.length === 0) {
    return 0;
  }

  return Math.min(
    ...staffBounds.map((bounds, staffIndex) => {
      return staffYOffsets[staffIndex]! + bounds.top;
    })
  );
}

function getVisibleBottom(
  staffBounds: StaffVerticalBounds[],
  staffYOffsets: number[]
): number {
  if (staffBounds.length === 0) {
    return 0;
  }

  return Math.max(
    ...staffBounds.map((bounds, staffIndex) => {
      return staffYOffsets[staffIndex]! + bounds.bottom;
    })
  );
}

function defaultStaffBounds(): StaffVerticalBounds {
  return {
    top: VEXFLOW_STAVE_TOP_LINE_OFFSET,
    bottom: VEXFLOW_STAVE_BOTTOM_LINE_OFFSET,
  };
}
