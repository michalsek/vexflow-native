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
    expect(plan.systems[0]?.height).toBeCloseTo(
      52 + TEST_OPTIONS.spacing.staffGap,
      5
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

  it('keeps document mode as one horizontal run using intrinsic widths', () => {
    const score = makePianoScore([1, 2, 4]);
    const measuredScore = measureScore(score, TEST_OPTIONS);
    const viewport = {
      x: 0,
      y: 0,
      width: 900,
      height: 420,
    };

    const plan = layoutScore(
      score,
      measuredScore,
      TEST_OPTIONS,
      'document',
      viewport
    );
    const expectedWidths = measuredScore.measures
      .filter((measure) => measure.groupId === 'piano')
      .sort((left, right) => left.measureIndex - right.measureIndex)
      .map((measure) => measure.intrinsicNoteWidth);

    expect(plan.systems).toHaveLength(1);
    plan.measures.forEach((measure, index) => {
      expect(measure.width).toBeCloseTo(expectedWidths[index]!, 5);
    });
    expect(plan.systems[0]?.width).toBeCloseTo(
      expectedWidths.reduce((sum, width) => sum + width, 0),
      5
    );
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
