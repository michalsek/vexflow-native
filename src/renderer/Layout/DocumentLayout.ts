import type { MeasuredScore } from '../measure';
import type { RendererPoint, ScoreOptions } from '../types';
import type {
  GroupLayoutContext,
  GroupLayoutResult,
  MeasureLayoutPlan,
  MeasuredGroupMeasure,
  SystemLayoutPlan,
} from '../layout';
import { getSystemGap } from './LayoutMetrics';
import { resolveSystemVerticalLayout } from './VerticalSpacing';

type DocumentLine = {
  measures: MeasuredGroupMeasure[];
  intrinsicWidth: number;
};

export function resolveDocumentEvenMeasureWidth(
  measuredScore: MeasuredScore,
  availableWidth: number
): {
  measuresPerFullLine: number;
  equalMeasureWidth: number;
} {
  const widestMeasure = Math.max(measuredScore.maxIntrinsicNoteWidth, 1);

  if (availableWidth <= 0) {
    return {
      measuresPerFullLine: 1,
      equalMeasureWidth: widestMeasure,
    };
  }

  const measuresPerFullLine = Math.max(
    1,
    Math.floor(availableWidth / widestMeasure)
  );

  return {
    measuresPerFullLine,
    equalMeasureWidth: availableWidth / measuresPerFullLine,
  };
}

export function layoutDocumentEvenGroup(
  group: GroupLayoutContext,
  origin: RendererPoint,
  availableWidth: number,
  equalMeasureWidth: number,
  measuresPerFullLine: number,
  options: ScoreOptions
): GroupLayoutResult {
  const systems: SystemLayoutPlan[] = [];
  const measures: MeasureLayoutPlan[] = [];

  if (group.measures.length === 0) {
    return {
      groupId: group.groupId,
      systems,
      measures,
      nextY: origin.y,
    };
  }

  let cursorY = origin.y;
  const systemGap = getSystemGap(options.spacing.staffGap);

  for (
    let systemIndex = 0, startIndex = 0;
    startIndex < group.measures.length;
    systemIndex++, startIndex += measuresPerFullLine
  ) {
    const chunk = group.measures.slice(
      startIndex,
      startIndex + measuresPerFullLine
    );
    const verticalLayout = resolveSystemVerticalLayout(
      chunk,
      group.staves.length,
      options.spacing.staffGap
    );
    let cursorX = origin.x;

    systems.push({
      groupId: group.groupId,
      systemIndex,
      x: origin.x,
      y: cursorY,
      width:
        chunk.length === measuresPerFullLine
          ? availableWidth
          : chunk.length * equalMeasureWidth,
      height: verticalLayout.height,
      staffCount: group.staves.length,
      staffYOffsets: verticalLayout.staffYOffsets,
      measureIndices: chunk.map((measure) => measure.measureIndex),
    });

    for (const measure of chunk) {
      measures.push({
        groupId: group.groupId,
        measureIndex: measure.measureIndex,
        x: cursorX,
        y: cursorY,
        width: equalMeasureWidth,
        height: verticalLayout.height,
        staffYOffsets: verticalLayout.staffYOffsets,
        systemIndex,
      });

      cursorX += equalMeasureWidth;
    }

    cursorY += verticalLayout.height + systemGap;
  }

  return {
    groupId: group.groupId,
    systems,
    measures,
    nextY: cursorY,
  };
}

export function layoutDocumentGroup(
  group: GroupLayoutContext,
  origin: RendererPoint,
  availableWidth: number,
  options: ScoreOptions
): GroupLayoutResult {
  const systems: SystemLayoutPlan[] = [];
  const measures: MeasureLayoutPlan[] = [];

  if (group.measures.length === 0) {
    return {
      groupId: group.groupId,
      systems,
      measures,
      nextY: origin.y,
    };
  }

  const lines = splitDocumentLines(group.measures, availableWidth);
  let cursorY = origin.y;
  const systemGap = getSystemGap(options.spacing.staffGap);

  for (const [systemIndex, line] of lines.entries()) {
    const lineWidth = availableWidth > 0 ? availableWidth : line.intrinsicWidth;
    const stretchRatio = lineWidth / line.intrinsicWidth;
    const verticalLayout = resolveSystemVerticalLayout(
      line.measures,
      group.staves.length,
      options.spacing.staffGap
    );
    let cursorX = origin.x;

    systems.push({
      groupId: group.groupId,
      systemIndex,
      x: origin.x,
      y: cursorY,
      width: lineWidth,
      height: verticalLayout.height,
      staffCount: group.staves.length,
      staffYOffsets: verticalLayout.staffYOffsets,
      measureIndices: line.measures.map((measure) => measure.measureIndex),
    });

    for (const measure of line.measures) {
      const width = getMeasureLineWidth(measure) * stretchRatio;

      measures.push({
        groupId: group.groupId,
        measureIndex: measure.measureIndex,
        x: cursorX,
        y: cursorY,
        width,
        height: verticalLayout.height,
        staffYOffsets: verticalLayout.staffYOffsets,
        systemIndex,
      });

      cursorX += width;
    }

    cursorY += verticalLayout.height + systemGap;
  }

  return {
    groupId: group.groupId,
    systems,
    measures,
    nextY: cursorY,
  };
}

function splitDocumentLines(
  measures: MeasuredGroupMeasure[],
  availableWidth: number
): DocumentLine[] {
  const lines: DocumentLine[] = [];
  let lineMeasures: MeasuredGroupMeasure[] = [];
  let lineWidth = 0;

  for (const measure of measures) {
    const measureWidth = getMeasureLineWidth(measure);

    if (lineMeasures.length === 0) {
      lineMeasures = [measure];
      lineWidth = measureWidth;
      continue;
    }

    if (availableWidth > 0 && lineWidth + measureWidth > availableWidth) {
      lines.push({
        measures: lineMeasures,
        intrinsicWidth: lineWidth,
      });
      lineMeasures = [measure];
      lineWidth = measureWidth;
      continue;
    }

    lineMeasures.push(measure);
    lineWidth += measureWidth;
  }

  if (lineMeasures.length > 0) {
    lines.push({
      measures: lineMeasures,
      intrinsicWidth: lineWidth,
    });
  }

  return lines;
}

function getMeasureLineWidth(measure: MeasuredGroupMeasure): number {
  return Math.max(measure.intrinsicWidth, 1);
}
