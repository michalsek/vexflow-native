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
import {
  resolveSystemVerticalLayout,
  resolveUniformSystemVerticalLayout,
} from './VerticalSpacing';

type DocumentLine = {
  measures: MeasuredGroupMeasure[];
  intrinsicWidth: number;
  availableWidth: number;
  indent: number;
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

  let measuresPerFullLine = Math.max(
    1,
    Math.floor(availableWidth / widestMeasure)
  );

  // A clef added at a system start has to fit the equal measure width too.
  while (
    measuresPerFullLine > 1 &&
    measuredScore.measures.some(
      (measure) =>
        measure.measureIndex % measuresPerFullLine === 0 &&
        measure.intrinsicNoteWidth + (measure.systemStartClefWidth ?? 0) >
          availableWidth / measuresPerFullLine
    )
  ) {
    measuresPerFullLine -= 1;
  }

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
  const systemGap = getSystemGap(options.spacing);
  const chunks: MeasuredGroupMeasure[][] = [];

  for (
    let startIndex = 0;
    startIndex < group.measures.length;
    startIndex += measuresPerFullLine
  ) {
    chunks.push(
      group.measures.slice(startIndex, startIndex + measuresPerFullLine)
    );
  }

  // One shared layout puts every staff on a fixed grid: system N's first
  // staff sits exactly N pitches below system 0's.
  const uniformVerticalLayout = options.spacing.uniformSystemPitch
    ? resolveUniformSystemVerticalLayout(
        chunks,
        group.staves.length,
        options.spacing.staffGap
      )
    : undefined;

  for (const [systemIndex, chunk] of chunks.entries()) {
    const verticalLayout =
      uniformVerticalLayout ??
      resolveSystemVerticalLayout(
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

  const { firstSystemIndent, lastSystemFill } = options.spacing;
  const lines = splitDocumentLines(
    group.measures,
    availableWidth,
    firstSystemIndent
  );
  let cursorY = origin.y;
  const systemGap = getSystemGap(options.spacing);

  for (const [systemIndex, line] of lines.entries()) {
    const fullWidth =
      line.availableWidth > 0 ? line.availableWidth : line.intrinsicWidth;
    const lineWidth =
      lastSystemFill === 'natural' && systemIndex === lines.length - 1
        ? Math.min(fullWidth, line.intrinsicWidth)
        : fullWidth;
    const stretchRatio = lineWidth / line.intrinsicWidth;
    const verticalLayout = resolveSystemVerticalLayout(
      line.measures,
      group.staves.length,
      options.spacing.staffGap
    );
    const systemX = origin.x + line.indent;
    let cursorX = systemX;

    systems.push({
      groupId: group.groupId,
      systemIndex,
      x: systemX,
      y: cursorY,
      width: lineWidth,
      height: verticalLayout.height,
      staffCount: group.staves.length,
      staffYOffsets: verticalLayout.staffYOffsets,
      measureIndices: line.measures.map((measure) => measure.measureIndex),
    });

    for (const [lineIndex, measure] of line.measures.entries()) {
      const width =
        (lineIndex === 0
          ? getSystemStartWidth(measure)
          : getMeasureLineWidth(measure)) * stretchRatio;

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
  availableWidth: number,
  firstSystemIndent: number
): DocumentLine[] {
  const lines: DocumentLine[] = [];
  let line: DocumentLine | undefined;

  for (const measure of measures) {
    const measureWidth = getMeasureLineWidth(measure);

    if (
      line &&
      !(
        line.availableWidth > 0 &&
        line.intrinsicWidth + measureWidth > line.availableWidth
      )
    ) {
      line.measures.push(measure);
      line.intrinsicWidth += measureWidth;
      continue;
    }

    const indent =
      lines.length === 0 && firstSystemIndent < availableWidth
        ? Math.max(0, firstSystemIndent)
        : 0;

    line = {
      measures: [measure],
      intrinsicWidth: getSystemStartWidth(measure),
      availableWidth: availableWidth - indent,
      indent,
    };
    lines.push(line);
  }

  return lines;
}

function getMeasureLineWidth(measure: MeasuredGroupMeasure): number {
  return Math.max(measure.intrinsicWidth, 1);
}

function getSystemStartWidth(measure: MeasuredGroupMeasure): number {
  return getMeasureLineWidth(measure) + (measure.systemStartClefWidth ?? 0);
}
