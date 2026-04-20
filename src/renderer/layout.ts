import type { Score, Staff } from '../state';
import {
  buildMeasurementGroups,
  buildResolvedMeasureStates,
  resolveGroupStaves,
  type ResolvedMeasureState,
} from './scoreParsing';
import type { MeasuredScore } from './measure';
import type {
  RendererPoint,
  RendererRect,
  RendererSize,
  RendererType,
  ScoreOptions,
} from './types';

const STAVE_LINE_BLOCK_HEIGHT = 41;
const STAVE_STEM_CLEARANCE = 11;
const MIN_SYSTEM_GAP = 82;
const SYSTEM_GAP_DIVISOR = 8;

export interface MeasuredGroupMeasure {
  groupId: string;
  measureIndex: number;
  intrinsicWidth: number;
  measureNumbers: number[];
}

export interface GroupLayoutContext {
  groupId: string;
  staffIds: string[];
  staves: Staff[];
  resolvedStatesByStaff: ResolvedMeasureState[][];
  measures: MeasuredGroupMeasure[];
}

export interface MeasureLayoutPlan {
  groupId: string;
  measureIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  systemIndex: number;
}

export interface SystemLayoutPlan {
  groupId: string;
  systemIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  staffCount: number;
  measureIndices: number[];
}

export interface GroupLayoutResult {
  groupId: string;
  systems: SystemLayoutPlan[];
  measures: MeasureLayoutPlan[];
  nextY: number;
}

export interface ScoreLayoutPlan {
  rendererType: RendererType;
  contentSize: RendererSize;
  systems: SystemLayoutPlan[];
  measures: MeasureLayoutPlan[];
  groups: GroupLayoutContext[];
}

export function layoutScore(
  score: Score,
  measuredScore: MeasuredScore,
  options: ScoreOptions,
  rendererType: RendererType,
  viewport: RendererRect
): ScoreLayoutPlan {
  const groups = buildGroupLayoutContext(score, measuredScore);
  const groupResults: GroupLayoutResult[] = [];

  if (rendererType === 'infiniteScore') {
    for (const group of groups) {
      groupResults.push(
        layoutInfiniteScoreGroup(group, viewport, options, score)
      );
    }
  } else if (rendererType === 'documentEven') {
    const availableWidth = getAvailableDocumentWidth(viewport, options);
    const { measuresPerFullLine, equalMeasureWidth } =
      resolveDocumentEvenMeasureWidth(measuredScore, availableWidth);
    let cursorY = viewport.y + options.insets.top;

    for (const group of groups) {
      const result = layoutDocumentEvenGroup(
        group,
        { x: viewport.x + options.insets.left, y: cursorY },
        availableWidth,
        equalMeasureWidth,
        measuresPerFullLine,
        options
      );

      groupResults.push(result);
      cursorY = result.nextY;
    }
  } else {
    let cursorY = viewport.y + options.insets.top;

    for (const group of groups) {
      const result = layoutDocumentGroup(
        group,
        { x: viewport.x + options.insets.left, y: cursorY },
        options
      );

      groupResults.push(result);
      cursorY = result.nextY;
    }
  }

  return {
    rendererType,
    contentSize: measureContentSize(
      groupResults,
      viewport,
      rendererType,
      options
    ),
    systems: groupResults.flatMap((group) => group.systems),
    measures: groupResults.flatMap((group) => group.measures),
    groups,
  };
}

function getAvailableDocumentWidth(
  viewport: RendererRect,
  options: ScoreOptions
): number {
  return Math.max(
    0,
    viewport.width - options.insets.left - options.insets.right
  );
}

function getStaffStackHeight(staffCount: number, staffGap: number): number {
  const singleStaffHeight = STAVE_LINE_BLOCK_HEIGHT + STAVE_STEM_CLEARANCE;

  if (staffCount <= 1) {
    return singleStaffHeight;
  }

  return singleStaffHeight + (staffCount - 1) * staffGap;
}

function getSystemGap(staffGap: number): number {
  return Math.max(MIN_SYSTEM_GAP, staffGap / SYSTEM_GAP_DIVISOR);
}

function buildGroupLayoutContext(
  score: Score,
  measuredScore: MeasuredScore
): GroupLayoutContext[] {
  const groups = buildMeasurementGroups(score);

  return groups.map((group) => ({
    groupId: group.groupId,
    staffIds: group.staffIds,
    staves: resolveGroupStaves(score, group),
    resolvedStatesByStaff: resolveGroupStaves(score, group).map((staff) =>
      buildResolvedMeasureStates(score, staff)
    ),
    measures: measuredScore.measures
      .filter((measure) => measure.groupId === group.groupId)
      .sort((left, right) => left.measureIndex - right.measureIndex)
      .map((measure) => ({
        groupId: measure.groupId,
        measureIndex: measure.measureIndex,
        intrinsicWidth: measure.intrinsicNoteWidth,
        measureNumbers: measure.measureNumbers,
      })),
  }));
}

function resolveDocumentEvenMeasureWidth(
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

function layoutDocumentEvenGroup(
  group: GroupLayoutContext,
  origin: RendererPoint,
  availableWidth: number,
  equalMeasureWidth: number,
  measuresPerFullLine: number,
  options: ScoreOptions
): GroupLayoutResult {
  const systems: SystemLayoutPlan[] = [];
  const measures: MeasureLayoutPlan[] = [];
  const staffStackHeight = getStaffStackHeight(
    group.staves.length,
    options.spacing.staffGap
  );

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
      height: staffStackHeight,
      staffCount: group.staves.length,
      measureIndices: chunk.map((measure) => measure.measureIndex),
    });

    for (const measure of chunk) {
      measures.push({
        groupId: group.groupId,
        measureIndex: measure.measureIndex,
        x: cursorX,
        y: cursorY,
        width: equalMeasureWidth,
        height: staffStackHeight,
        systemIndex,
      });

      cursorX += equalMeasureWidth;
    }

    cursorY += staffStackHeight + systemGap;
  }

  return {
    groupId: group.groupId,
    systems,
    measures,
    nextY: cursorY,
  };
}

function layoutDocumentGroup(
  group: GroupLayoutContext,
  origin: RendererPoint,
  options: ScoreOptions
): GroupLayoutResult {
  const systems: SystemLayoutPlan[] = [];
  const measures: MeasureLayoutPlan[] = [];
  const staffStackHeight = getStaffStackHeight(
    group.staves.length,
    options.spacing.staffGap
  );

  if (group.measures.length === 0) {
    return {
      groupId: group.groupId,
      systems,
      measures,
      nextY: origin.y,
    };
  }

  let cursorX = origin.x;

  for (const measure of group.measures) {
    measures.push({
      groupId: group.groupId,
      measureIndex: measure.measureIndex,
      x: cursorX,
      y: origin.y,
      width: measure.intrinsicWidth,
      height: staffStackHeight,
      systemIndex: 0,
    });

    cursorX += measure.intrinsicWidth;
  }

  systems.push({
    groupId: group.groupId,
    systemIndex: 0,
    x: origin.x,
    y: origin.y,
    width: cursorX - origin.x,
    height: staffStackHeight,
    staffCount: group.staves.length,
    measureIndices: group.measures.map((measure) => measure.measureIndex),
  });

  return {
    groupId: group.groupId,
    systems,
    measures,
    nextY: origin.y + staffStackHeight + getSystemGap(options.spacing.staffGap),
  };
}

function layoutInfiniteScoreGroup(
  group: GroupLayoutContext,
  viewport: RendererRect,
  options: ScoreOptions,
  _score: Score
): GroupLayoutResult {
  const systems: SystemLayoutPlan[] = [];
  const measures: MeasureLayoutPlan[] = [];
  const staffStackHeight = getStaffStackHeight(
    group.staves.length,
    options.spacing.staffGap
  );
  const maxIntrinsicWidth = Math.max(
    ...group.measures.map((measure) => measure.intrinsicWidth),
    0
  );
  const totalHeight = staffStackHeight + getSystemGap(options.spacing.staffGap);
  const origin = {
    x: viewport.x + options.insets.left,
    y: (viewport.y + viewport.height - totalHeight) / 2,
  };

  let cursorX = origin.x;

  for (const measure of group.measures) {
    const width = Math.max(measure.intrinsicWidth, maxIntrinsicWidth);

    measures.push({
      groupId: group.groupId,
      measureIndex: measure.measureIndex,
      x: cursorX,
      y: origin.y,
      width,
      height: staffStackHeight,
      systemIndex: 0,
    });

    cursorX += width;
  }

  systems.push({
    groupId: group.groupId,
    systemIndex: 0,
    x: origin.x,
    y: origin.y,
    width: cursorX - origin.x,
    height: staffStackHeight,
    staffCount: group.staves.length,
    measureIndices: group.measures.map((measure) => measure.measureIndex),
  });

  return {
    groupId: group.groupId,
    systems,
    measures,
    nextY: origin.y + totalHeight,
  };
}

function measureContentSize(
  groupResults: GroupLayoutResult[],
  viewport: RendererRect,
  rendererType: RendererType,
  options: ScoreOptions
): RendererSize {
  if (
    groupResults.length === 0 ||
    groupResults.every((group) => group.systems.length === 0)
  ) {
    return {
      width: viewport.width,
      height: viewport.height,
    };
  }

  let maxRight = viewport.x + options.insets.left;
  let maxBottom = viewport.y + options.insets.top;

  for (const group of groupResults) {
    for (const system of group.systems) {
      maxRight = Math.max(maxRight, system.x + system.width);
      maxBottom = Math.max(maxBottom, system.y + system.height);
    }
  }

  const measuredWidth = maxRight + options.insets.right - viewport.x;
  const measuredHeight = maxBottom + options.insets.bottom - viewport.y;

  if (rendererType === 'documentEven') {
    return {
      width: Math.max(viewport.width, measuredWidth),
      height: measuredHeight,
    };
  }

  if (rendererType === 'document') {
    return {
      width: measuredWidth,
      height: measuredHeight,
    };
  }

  return {
    width: Math.max(viewport.width, measuredWidth),
    height: Math.max(viewport.height, measuredHeight),
  };
}
