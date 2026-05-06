import type { Score, Staff } from '../state';
import {
  getAvailableDocumentWidth,
  getStaffStackHeight,
  getSystemGap,
} from './Layout/LayoutMetrics';
import {
  layoutDocumentEvenGroup,
  layoutDocumentGroup,
  resolveDocumentEvenMeasureWidth,
} from './Layout/DocumentLayout';
import {
  buildMeasurementGroups,
  buildResolvedMeasureStates,
  resolveGroupStaves,
  type ResolvedMeasureState,
} from './scoreParsing';
import type { MeasuredScore } from './measure';
import type {
  RendererRect,
  RendererSize,
  RendererType,
  ScoreOptions,
} from './types';

const VEXFLOW_STAVE_TOP_LINE_OFFSET = 40;
const VEXFLOW_STAVE_BOTTOM_LINE_OFFSET = 80;

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
      groupResults.push(layoutInfiniteScoreGroup(group, viewport, options));
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
    const availableWidth = getAvailableDocumentWidth(viewport, options);
    let cursorY = viewport.y + options.insets.top;

    for (const group of groups) {
      const result = layoutDocumentGroup(
        group,
        { x: viewport.x + options.insets.left, y: cursorY },
        availableWidth,
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

function layoutInfiniteScoreGroup(
  group: GroupLayoutContext,
  viewport: RendererRect,
  options: ScoreOptions
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
  const systemWidth = group.measures.length * maxIntrinsicWidth;
  const origin = {
    x: getInfiniteScoreOriginX(systemWidth, viewport, options),
    y: getInfiniteScoreOriginY(group.staves.length, viewport, options),
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
    nextY: origin.y + staffStackHeight + getSystemGap(options.spacing.staffGap),
  };
}

function getInfiniteScoreOriginX(
  systemWidth: number,
  viewport: RendererRect,
  options: ScoreOptions
): number {
  const insetContentWidth =
    systemWidth + options.insets.left + options.insets.right;

  if (insetContentWidth <= viewport.width) {
    return viewport.x + (viewport.width - systemWidth) / 2;
  }

  return viewport.x + options.insets.left;
}

function getInfiniteScoreOriginY(
  staffCount: number,
  viewport: RendererRect,
  options: ScoreOptions
): number {
  const visibleStaffHeight =
    staffCount <= 1
      ? VEXFLOW_STAVE_BOTTOM_LINE_OFFSET - VEXFLOW_STAVE_TOP_LINE_OFFSET
      : (staffCount - 1) * options.spacing.staffGap +
        VEXFLOW_STAVE_BOTTOM_LINE_OFFSET -
        VEXFLOW_STAVE_TOP_LINE_OFFSET;

  return (
    viewport.y +
    (viewport.height - visibleStaffHeight) / 2 -
    VEXFLOW_STAVE_TOP_LINE_OFFSET
  );
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
