import { describe, expect, it } from '@jest/globals';

import type { Meter, Score, Step, VoiceItem } from '../../state';
import { insets, renderOptions, spacing } from '../constants';
import { layoutScore } from '../layout';
import { measureScore } from '../measure';
import {
  createContentViewport,
  getRenderScale,
  scaleItemsLayoutToViewSpace,
  toViewSize,
} from '../scale';
import type { RendererRect, ScoreItemsLayout, ScoreOptions } from '../types';

const TEST_OPTIONS: ScoreOptions = {
  insets: { ...insets },
  spacing: { ...spacing },
  render: { ...renderOptions },
};

const DEFAULT_METER: Meter = {
  beats: 4,
  beatUnit: 4,
};

function makeItems(voiceId: string, noteCount: number): VoiceItem[] {
  const steps: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  return Array.from({ length: noteCount }, (_, index) => ({
    id: `${voiceId}-n${index + 1}`,
    type: 'note' as const,
    voiceId,
    pitch: {
      step: steps[index % steps.length]!,
      octave: 4,
    },
    duration: {
      length: '8',
    },
  }));
}

function makeScore(noteCounts: number[]): Score {
  return {
    id: 'scale-staff',
    defaults: {
      meter: DEFAULT_METER,
    },
    staves: [
      {
        id: 'staff-1',
        order: 0,
        defaultClef: 'treble',
        measures: noteCounts.map((noteCount, index) => ({
          id: `m${index + 1}`,
          number: index + 1,
          voices: [
            {
              id: `m${index + 1}-v1`,
              index: 0,
              timingMode: 'soft' as const,
              items: makeItems(`m${index + 1}-v1`, noteCount),
            },
          ],
        })),
      },
    ],
  };
}

/** Runs the exact content-space pipeline `useScoreRecording` executes for a
 * given render scale and returns both spaces' content sizes. */
function layoutAtScale(
  score: Score,
  viewViewport: RendererRect,
  rendererType: 'document' | 'documentEven' | 'infiniteScore',
  scale: number
) {
  const options: ScoreOptions = {
    ...TEST_OPTIONS,
    render: { ...TEST_OPTIONS.render, scale },
  };
  const resolvedScale = getRenderScale(options);
  const contentViewport = createContentViewport(viewViewport, resolvedScale);
  const measured = measureScore(score, options);
  const plan = layoutScore(
    score,
    measured,
    options,
    rendererType,
    contentViewport
  );

  return {
    contentViewport,
    plan,
    viewContentSize: toViewSize(plan.contentSize, resolvedScale),
  };
}

describe('getRenderScale', () => {
  it('resolves the configured scale', () => {
    expect(getRenderScale({ render: { scale: 0.85 } })).toBe(0.85);
    expect(getRenderScale({ render: { scale: 2 } })).toBe(2);
  });

  it('falls back to 1 for missing or invalid values', () => {
    expect(getRenderScale(undefined)).toBe(1);
    expect(getRenderScale({})).toBe(1);
    expect(getRenderScale({ render: {} })).toBe(1);
    expect(getRenderScale({ render: { scale: 0 } })).toBe(1);
    expect(getRenderScale({ render: { scale: -0.5 } })).toBe(1);
    expect(getRenderScale({ render: { scale: Number.NaN } })).toBe(1);
    expect(
      getRenderScale({ render: { scale: Number.POSITIVE_INFINITY } })
    ).toBe(1);
  });
});

describe('createContentViewport / toViewSize', () => {
  const viewport: RendererRect = { x: 8, y: 16, width: 600, height: 140 };

  it('returns the identical objects at scale 1 (default byte-identical)', () => {
    expect(createContentViewport(viewport, 1)).toBe(viewport);

    const size = { width: 600, height: 140 };
    expect(toViewSize(size, 1)).toBe(size);
  });

  it('divides the whole viewport by the scale', () => {
    expect(createContentViewport(viewport, 0.5)).toEqual({
      x: 16,
      y: 32,
      width: 1200,
      height: 280,
    });
  });

  it('multiplies content sizes back into view space', () => {
    expect(toViewSize({ width: 1200, height: 280 }, 0.5)).toEqual({
      width: 600,
      height: 140,
    });
  });
});

describe('scaleItemsLayoutToViewSpace', () => {
  const contentLayout: ScoreItemsLayout = {
    items: {
      'item-1': { x: 60, width: 12, headCenterX: 65, measureIndex: 0 },
      'item-2': { x: 120, width: 24, headCenterX: 129, measureIndex: 0 },
    },
    measures: [
      {
        groupId: 'staff:staff-1',
        staffId: 'staff-1',
        measureIndex: 0,
        systemIndex: 0,
        x: 24,
        width: 345,
        staveNoteStartX: 34,
        staveNoteEndX: 369,
      },
      {
        groupId: 'staff:staff-1',
        staffId: 'staff-2',
        measureIndex: 0,
        systemIndex: 0,
        x: 24,
        width: 345,
        staveNoteStartX: 54,
        staveNoteEndX: 369,
      },
    ],
    contentSize: { width: 393, height: 116 },
  };

  it('returns the identical object at scale 1 (default byte-identical)', () => {
    expect(scaleItemsLayoutToViewSpace(contentLayout, 1)).toBe(contentLayout);
  });

  it('halves every emitted x/width, per-stave bound and the content size at scale 0.5', () => {
    const viewLayout = scaleItemsLayoutToViewSpace(contentLayout, 0.5);

    expect(viewLayout).toEqual({
      items: {
        'item-1': { x: 30, width: 6, headCenterX: 32.5, measureIndex: 0 },
        'item-2': { x: 60, width: 12, headCenterX: 64.5, measureIndex: 0 },
      },
      measures: [
        {
          groupId: 'staff:staff-1',
          staffId: 'staff-1',
          measureIndex: 0,
          systemIndex: 0,
          x: 12,
          width: 172.5,
          staveNoteStartX: 17,
          staveNoteEndX: 184.5,
        },
        {
          groupId: 'staff:staff-1',
          staffId: 'staff-2',
          measureIndex: 0,
          systemIndex: 0,
          x: 12,
          width: 172.5,
          staveNoteStartX: 27,
          staveNoteEndX: 184.5,
        },
      ],
      contentSize: { width: 196.5, height: 58 },
    });
    // Input untouched.
    expect(contentLayout.items['item-1']?.x).toBe(60);
    expect(contentLayout.measures[0]?.staveNoteEndX).toBe(369);
  });

  it('scales headCenterX along with x (regression: hand-maintained field list)', () => {
    const viewLayout = scaleItemsLayoutToViewSpace(contentLayout, 0.5);

    for (const [itemId, item] of Object.entries(contentLayout.items)) {
      expect(viewLayout.items[itemId]?.headCenterX).toBeCloseTo(
        item.headCenterX * 0.5
      );
    }
  });

  /* Structural guard for the hand-maintained field list in
   * scaleItemsLayoutToViewSpace: every NUMERIC field of an item / measure
   * entry that is not an index must come out multiplied by the scale. A new
   * x-ish field added to the types (which tsc forces into this fixture)
   * fails here until scale.ts learns to multiply it. Best-effort: only
   * catches fields present on the fixture with values that change under
   * scaling (non-zero), which all coordinate fields here have. */
  it('scales every numeric non-index field of items and measures (structural guard)', () => {
    const SCALE = 0.5;
    const INDEX_FIELDS = new Set(['measureIndex', 'systemIndex']);
    const viewLayout = scaleItemsLayoutToViewSpace(contentLayout, SCALE);

    for (const [itemId, item] of Object.entries(contentLayout.items)) {
      const scaled = viewLayout.items[itemId] as unknown as Record<
        string,
        unknown
      >;

      for (const [field, value] of Object.entries(item)) {
        if (typeof value !== 'number' || INDEX_FIELDS.has(field)) {
          continue;
        }
        expect({ itemId, field, value: scaled[field] }).toEqual({
          itemId,
          field,
          value: value * SCALE,
        });
      }
    }

    contentLayout.measures.forEach((measure, index) => {
      const scaled = viewLayout.measures[index] as unknown as Record<
        string,
        unknown
      >;

      for (const [field, value] of Object.entries(measure)) {
        if (typeof value !== 'number' || INDEX_FIELDS.has(field)) {
          continue;
        }
        expect({ index, field, value: scaled[field] }).toEqual({
          index,
          field,
          value: value * SCALE,
        });
      }
    });
  });
});

describe('scaled layout pipeline (document mode)', () => {
  const VIEW_VIEWPORT: RendererRect = { x: 0, y: 0, width: 600, height: 140 };
  const score = makeScore([4]);

  it('keeps scale 1 identical to the unscaled pipeline', () => {
    const baselineMeasured = measureScore(score, TEST_OPTIONS);
    const baselinePlan = layoutScore(
      score,
      baselineMeasured,
      TEST_OPTIONS,
      'document',
      VIEW_VIEWPORT
    );
    const { contentViewport, plan, viewContentSize } = layoutAtScale(
      score,
      VIEW_VIEWPORT,
      'document',
      1
    );

    expect(contentViewport).toBe(VIEW_VIEWPORT);
    expect(plan).toEqual(baselinePlan);
    expect(viewContentSize).toBe(plan.contentSize);
  });

  it('spans the full view width and scales the system height into view space', () => {
    const full = layoutAtScale(score, VIEW_VIEWPORT, 'document', 1);
    const half = layoutAtScale(score, VIEW_VIEWPORT, 'document', 0.5);

    // The stretched single-measure line fills the virtual viewport width, so
    // after scaling the notation still visually fills the view width.
    expect(half.plan.contentSize.width).toBeCloseTo(
      VIEW_VIEWPORT.width / 0.5,
      5
    );
    expect(half.viewContentSize.width).toBeCloseTo(VIEW_VIEWPORT.width, 5);

    // A single measure is one document line at any width, so the content
    // height is scale-invariant — the VIEW-space height is content x scale.
    expect(half.plan.contentSize.height).toBeCloseTo(
      full.plan.contentSize.height,
      5
    );
    expect(half.viewContentSize.height).toBeCloseTo(
      full.plan.contentSize.height * 0.5,
      5
    );
  });

  it('keeps the view-space scroll range consistent for a multi-system document', () => {
    const tallScore = makeScore([4, 4, 4, 4, 4, 4]);
    const shortViewport: RendererRect = { x: 0, y: 0, width: 320, height: 160 };
    const half = layoutAtScale(tallScore, shortViewport, 'document', 0.5);

    // Content overflows the virtual viewport vertically; the view-space
    // content height (content x scale) is what scrolling must be clamped to.
    expect(half.viewContentSize.height).toBeCloseTo(
      half.plan.contentSize.height * 0.5,
      5
    );
    expect(half.viewContentSize.width).toBeCloseTo(shortViewport.width, 5);
  });
});

describe('scaled layout pipeline (infiniteScore mode)', () => {
  const VIEW_VIEWPORT: RendererRect = { x: 0, y: 0, width: 300, height: 200 };

  it('supports scale with correct view-space centering and scroll extent', () => {
    const score = makeScore([4, 4, 4, 4]);
    const half = layoutAtScale(score, VIEW_VIEWPORT, 'infiniteScore', 0.5);
    const system = half.plan.systems[0];

    if (!system) {
      throw new Error('Expected infinite score system');
    }

    // Content height equals the virtual viewport height, so the VIEW-space
    // height equals the view viewport height — no phantom vertical scroll.
    expect(half.plan.contentSize.height).toBeCloseTo(
      VIEW_VIEWPORT.height / 0.5,
      5
    );
    expect(half.viewContentSize.height).toBeCloseTo(VIEW_VIEWPORT.height, 5);

    // The horizontal scroll extent is the view-space content width.
    expect(half.viewContentSize.width).toBeCloseTo(
      half.plan.contentSize.width * 0.5,
      5
    );
  });

  it('centers a short infinite score at the view viewport center after scaling', () => {
    const score = makeScore([1]);
    const half = layoutAtScale(score, VIEW_VIEWPORT, 'infiniteScore', 0.5);
    const system = half.plan.systems[0];

    if (!system) {
      throw new Error('Expected infinite score system');
    }

    // Content-space horizontal centering happens inside the virtual viewport;
    // multiplying by the scale lands the system centered in the real view.
    const viewCenterX = (system.x + system.width / 2) * 0.5;
    expect(viewCenterX).toBeCloseTo(VIEW_VIEWPORT.width / 2, 5);
  });
});
