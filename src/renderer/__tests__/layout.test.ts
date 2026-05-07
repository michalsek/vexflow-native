import { describe, expect, it } from '@jest/globals';

import type { Meter, Score, Step, VoiceItem } from '../../state';
import { insets, renderOptions, spacing } from '../constants';
import { layoutScore } from '../layout';
import { measureScore } from '../measure';
import type { ScoreOptions } from '../types';
import { createVisibleViewport } from '../viewport';

const TEST_OPTIONS: ScoreOptions = {
  insets: { ...insets },
  spacing: { ...spacing },
  render: { ...renderOptions },
};

const DEFAULT_METER: Meter = {
  beats: 4,
  beatUnit: 4,
};

function makeItems(
  voiceId: string,
  noteCount: number,
  octave: number
): VoiceItem[] {
  const steps: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  return Array.from({ length: noteCount }, (_, index) => ({
    id: `${voiceId}-n${index + 1}`,
    type: 'note' as const,
    voiceId,
    pitch: {
      step: steps[index % steps.length]!,
      octave,
    },
    duration: {
      length: '8',
    },
  }));
}

function makeStaffMeasures(
  staffId: string,
  noteCounts: number[],
  octave: number
) {
  return noteCounts.map((noteCount, index) => ({
    id: `${staffId}-m${index + 1}`,
    number: index + 1,
    voices: [
      {
        id: `${staffId}-m${index + 1}-v1`,
        index: 0,
        timingMode: 'soft' as const,
        items: makeItems(`${staffId}-m${index + 1}-v1`, noteCount, octave),
      },
    ],
  }));
}

function makePianoScore(noteCounts: number[]): Score {
  return {
    id: 'layout-piano',
    defaults: {
      meter: DEFAULT_METER,
    },
    staffGroups: [
      {
        id: 'piano',
        role: 'grandStaff',
        staffIds: ['top', 'bottom'],
      },
    ],
    staves: [
      {
        id: 'top',
        order: 0,
        defaultClef: 'treble',
        measures: makeStaffMeasures('top', noteCounts, 5),
      },
      {
        id: 'bottom',
        order: 1,
        defaultClef: 'bass',
        measures: makeStaffMeasures('bottom', noteCounts, 3),
      },
    ],
  };
}

function getMeasuredWidths(measuredScore: ReturnType<typeof measureScore>) {
  return measuredScore.measures
    .filter((measure) => measure.groupId === 'piano')
    .sort((left, right) => left.measureIndex - right.measureIndex)
    .map((measure) => Math.max(measure.intrinsicNoteWidth, 1));
}

function getVisibleSystemBounds(
  measuredScore: ReturnType<typeof measureScore>,
  groupId: string,
  measureIndices: number[],
  staffYOffsets: number[]
) {
  const systemMeasures = measuredScore.measures.filter(
    (measure) =>
      measure.groupId === groupId &&
      measureIndices.includes(measure.measureIndex)
  );
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  systemMeasures.forEach((measure) => {
    measure.staffBounds.forEach((bounds, staffIndex) => {
      const staffOffset = staffYOffsets[staffIndex] ?? 0;

      top = Math.min(top, staffOffset + bounds.top);
      bottom = Math.max(bottom, staffOffset + bounds.bottom);
    });
  });

  return { top, bottom };
}

describe('layoutScore', () => {
  it('uses one global equal width in documentEven and fills each full system', () => {
    const score = makePianoScore([1, 2, 3, 4, 5]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const availableWidth = measuredScore.maxIntrinsicNoteWidth * 3.4;
    const viewport = {
      x: 0,
      y: 0,
      width:
        availableWidth + TEST_OPTIONS.insets.left + TEST_OPTIONS.insets.right,
      height: 420,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'documentEven',
      viewport
    );

    expect(plan.groups[0]?.staves).toHaveLength(2);
    expect(plan.systems).toHaveLength(2);
    expect(plan.systems[0]?.measureIndices).toEqual([0, 1, 2]);
    expect(plan.systems[1]?.measureIndices).toEqual([3, 4]);

    const measureWidths = plan.measures.map((measure) => measure.width);

    measureWidths.forEach((width) => {
      expect(width).toBeCloseTo(availableWidth / 3, 5);
    });

    expect(plan.systems[0]?.width).toBeCloseTo(availableWidth, 5);
    expect(plan.systems[1]?.width).toBeCloseTo((availableWidth / 3) * 2, 5);
    expect(plan.contentSize.width).toBeCloseTo(viewport.width, 5);
    expect(plan.systems[0]?.staffYOffsets).toHaveLength(2);
    expect(plan.systems[0]?.staffYOffsets[1]).toBeGreaterThanOrEqual(
      TEST_OPTIONS.spacing.staffGap
    );
    expect(plan.systems[0]?.height).toBeGreaterThan(
      TEST_OPTIONS.spacing.staffGap
    );
    expect(plan.systems[1]?.y).toBeCloseTo(
      (plan.systems[0]?.y ?? 0) +
        (plan.systems[0]?.height ?? 0) +
        Math.max(82, TEST_OPTIONS.spacing.staffGap / 8),
      5
    );

    const bottom = Math.max(
      ...plan.systems.map((system) => system.y + system.height)
    );

    expect(plan.contentSize.height).toBeCloseTo(
      bottom + TEST_OPTIONS.insets.bottom,
      5
    );
  });

  it('expands grand staff spacing when measured staff bounds collide', () => {
    const score = makePianoScore([1]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const measure = measuredScore.measures[0];

    if (!measure) {
      throw new Error('Expected measured score measure');
    }

    measure.staffBounds = [
      { top: 40, bottom: 180 },
      { top: 20, bottom: 80 },
    ];

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'documentEven',
      {
        x: 0,
        y: 0,
        width:
          measuredScore.maxIntrinsicNoteWidth +
          TEST_OPTIONS.insets.left +
          TEST_OPTIONS.insets.right,
        height: 420,
      }
    );
    const system = plan.systems[0];

    if (!system) {
      throw new Error('Expected layout system');
    }

    expect(system.staffYOffsets[1]).toBeGreaterThan(
      TEST_OPTIONS.spacing.staffGap
    );
    expect(system.height).toBeGreaterThan(180);
  });

  it('uses each wrapped document system height for the next system origin', () => {
    const score = makePianoScore([1, 1]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const firstMeasure = measuredScore.measures[0];
    const secondMeasure = measuredScore.measures[1];

    if (!firstMeasure || !secondMeasure) {
      throw new Error('Expected measured score measures');
    }

    firstMeasure.staffBounds = [
      { top: 40, bottom: 220 },
      { top: 40, bottom: 80 },
    ];
    secondMeasure.staffBounds = [
      { top: 40, bottom: 80 },
      { top: 40, bottom: 80 },
    ];

    const availableWidth = measuredScore.maxIntrinsicNoteWidth * 0.75;
    const plan = layoutScore(score, measuredScore, TEST_OPTIONS, 'document', {
      x: 0,
      y: 0,
      width:
        availableWidth + TEST_OPTIONS.insets.left + TEST_OPTIONS.insets.right,
      height: 420,
    });

    expect(plan.systems).toHaveLength(2);
    expect(plan.systems[0]?.height).toBeGreaterThan(
      plan.systems[1]?.height ?? 0
    );
    expect(plan.systems[1]?.y).toBeCloseTo(
      (plan.systems[0]?.y ?? 0) +
        (plan.systems[0]?.height ?? 0) +
        Math.max(82, TEST_OPTIONS.spacing.staffGap / 8),
      5
    );
  });

  it('falls back to one measure per line when the widest measure exceeds the available width', () => {
    const score = makePianoScore([1, 2, 3]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const availableWidth = measuredScore.maxIntrinsicNoteWidth * 0.75;
    const viewport = {
      x: 0,
      y: 0,
      width:
        availableWidth + TEST_OPTIONS.insets.left + TEST_OPTIONS.insets.right,
      height: 420,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'documentEven',
      viewport
    );

    expect(plan.systems).toHaveLength(3);
    plan.systems.forEach((system) => {
      expect(system.measureIndices).toHaveLength(1);
      expect(system.width).toBeCloseTo(availableWidth, 5);
    });
  });

  it('wraps document mode by intrinsic width and stretches each line', () => {
    const score = makePianoScore([1, 2, 4]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const measuredWidths = getMeasuredWidths(measuredScore);
    const availableWidth =
      measuredWidths[0]! + measuredWidths[1]! + measuredWidths[2]! / 2;
    const viewport = {
      x: 0,
      y: 0,
      width:
        availableWidth + TEST_OPTIONS.insets.left + TEST_OPTIONS.insets.right,
      height: 420,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'document',
      viewport
    );
    const firstLineRatio =
      availableWidth / (measuredWidths[0]! + measuredWidths[1]!);

    expect(plan.systems).toHaveLength(2);
    expect(plan.systems[0]?.measureIndices).toEqual([0, 1]);
    expect(plan.systems[1]?.measureIndices).toEqual([2]);
    plan.systems.forEach((system) => {
      expect(system.width).toBeCloseTo(availableWidth, 5);
    });

    expect(plan.measures[0]?.width).toBeCloseTo(
      measuredWidths[0]! * firstLineRatio,
      5
    );
    expect(plan.measures[1]?.width).toBeCloseTo(
      measuredWidths[1]! * firstLineRatio,
      5
    );
    expect(plan.measures[2]?.width).toBeCloseTo(availableWidth, 5);
    expect(
      (plan.measures[0]?.x ?? 0) + (plan.measures[0]?.width ?? 0)
    ).toBeCloseTo(plan.measures[1]?.x ?? 0, 5);
    expect(plan.contentSize.width).toBeCloseTo(viewport.width, 5);

    const bottom = Math.max(
      ...plan.systems.map((system) => system.y + system.height)
    );

    expect(plan.contentSize.height).toBeCloseTo(
      bottom + TEST_OPTIONS.insets.bottom,
      5
    );
  });

  it('keeps an over-wide document measure on one stretched line', () => {
    const score = makePianoScore([8, 1]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const measuredWidths = getMeasuredWidths(measuredScore);
    const availableWidth = measuredWidths[0]! * 0.75;
    const viewport = {
      x: 0,
      y: 0,
      width:
        availableWidth + TEST_OPTIONS.insets.left + TEST_OPTIONS.insets.right,
      height: 420,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'document',
      viewport
    );

    expect(plan.systems).toHaveLength(2);
    expect(plan.systems[0]?.measureIndices).toEqual([0]);
    expect(plan.systems[0]?.width).toBeCloseTo(availableWidth, 5);
    expect(plan.measures[0]?.width).toBeCloseTo(availableWidth, 5);
  });

  it('centers a short infinite score horizontally and vertically in the viewport', () => {
    const score = makePianoScore([1]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const viewport = {
      x: 10,
      y: 20,
      width:
        measuredScore.maxIntrinsicNoteWidth +
        TEST_OPTIONS.insets.left +
        TEST_OPTIONS.insets.right +
        120,
      height: 500,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'infiniteScore',
      viewport
    );
    const system = plan.systems[0];

    if (!system) {
      throw new Error('Expected infinite score system');
    }

    expect(system.x).toBeCloseTo(
      viewport.x + (viewport.width - system.width) / 2,
      5
    );
    const visibleBounds = getVisibleSystemBounds(
      measuredScore,
      system.groupId,
      system.measureIndices,
      system.staffYOffsets
    );

    expect(
      system.y + (visibleBounds.top + visibleBounds.bottom) / 2
    ).toBeCloseTo(viewport.y + viewport.height / 2, 5);
    expect(plan.measures[0]?.x).toBeCloseTo(system.x, 5);
    expect(plan.contentSize.width).toBeCloseTo(viewport.width, 5);
    expect(plan.contentSize.height).toBeCloseTo(viewport.height, 5);
  });

  it('keeps a wide infinite score aligned to the start inset for scrolling', () => {
    const score = makePianoScore([1, 2, 3, 4]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const systemWidth = measuredScore.maxIntrinsicNoteWidth * 4;
    const viewport = {
      x: 10,
      y: 20,
      width:
        systemWidth + TEST_OPTIONS.insets.left + TEST_OPTIONS.insets.right - 12,
      height: 500,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'infiniteScore',
      viewport
    );
    const system = plan.systems[0];

    if (!system) {
      throw new Error('Expected infinite score system');
    }

    expect(system.x).toBeCloseTo(viewport.x + TEST_OPTIONS.insets.left, 5);
    expect(system.width).toBeCloseTo(systemWidth, 5);
    expect(plan.contentSize.width).toBeGreaterThan(viewport.width);
  });

  it('keeps tall infinite score notation centered without vertical content overflow', () => {
    const score = makePianoScore([1, 2, 3, 4]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const viewport = {
      x: 0,
      y: 0,
      width: measuredScore.maxIntrinsicNoteWidth * 2,
      height: 180,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'infiniteScore',
      viewport
    );
    const system = plan.systems[0];

    if (!system) {
      throw new Error('Expected infinite score system');
    }

    const visibleBounds = getVisibleSystemBounds(
      measuredScore,
      system.groupId,
      system.measureIndices,
      system.staffYOffsets
    );

    expect(system.height).toBeGreaterThan(viewport.height);
    expect(
      system.y + (visibleBounds.top + visibleBounds.bottom) / 2
    ).toBeCloseTo(viewport.y + viewport.height / 2, 5);
    expect(plan.contentSize.width).toBeGreaterThan(viewport.width);
    expect(plan.contentSize.height).toBeCloseTo(viewport.height, 5);
  });
});

describe('createVisibleViewport', () => {
  it('uses vertical scroll offsets for document mode', () => {
    expect(
      createVisibleViewport(
        600,
        'document',
        { width: 300, height: 200 },
        { width: 800, height: 450 }
      )
    ).toEqual({
      x: 0,
      y: 250,
      width: 300,
      height: 200,
    });
  });

  it('uses vertical scroll offsets for documentEven mode', () => {
    expect(
      createVisibleViewport(
        -20,
        'documentEven',
        { width: 300, height: 200 },
        { width: 800, height: 450 }
      )
    ).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 200,
    });
  });

  it('uses horizontal scroll offsets for infiniteScore mode', () => {
    expect(
      createVisibleViewport(
        600,
        'infiniteScore',
        { width: 300, height: 200 },
        { width: 800, height: 450 }
      )
    ).toEqual({
      x: 500,
      y: 0,
      width: 300,
      height: 200,
    });
  });
});
