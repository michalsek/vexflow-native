import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ScoreItemsLayout } from '../types';

/* useScoreRecording is built from useMemo only; a slot-stable, deps-aware mock
 * is close enough to React to exercise the pipeline and its caching without a
 * renderer. `useRecordingPass` runs one render pass. */
const mockMemoSlots: Array<{ deps: readonly unknown[]; value: unknown }> = [];
let mockMemoCursor = 0;

jest.mock('react', () => ({
  ...(jest.requireActual('react') as object),
  useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
    const index = mockMemoCursor;
    mockMemoCursor += 1;
    const slot = mockMemoSlots[index];

    if (
      slot &&
      deps.every((dep, depIndex) => Object.is(dep, slot.deps[depIndex]))
    ) {
      return slot.value;
    }

    const value = factory();
    mockMemoSlots[index] = { deps, value };
    return value;
  },
}));

const mockFinish = jest.fn(() => ['command-1']);

jest.mock('../../base/VexflowRecordingContext', () => ({
  __esModule: true,
  default: class MockVexflowRecordingContext {
    finish = mockFinish;
  },
}));

function mockMakeLayoutPlan() {
  return {
    rendererType: 'document',
    contentSize: { width: 393, height: 116 },
    systems: [],
    measures: [],
    groups: [],
  };
}

function mockMakeItemsLayout(): ScoreItemsLayout {
  return {
    items: { 'item-1': { x: 60, width: 12, headCenterX: 65, measureIndex: 0 } },
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
        y: 18,
        height: 92,
        staveLineTopY: 30,
        staveLineBottomY: 70,
      },
    ],
    contentSize: { width: 393, height: 116 },
  };
}

jest.mock('../measure', () => ({
  measureScore: jest.fn(() => ({ measures: [] })),
}));
jest.mock('../layout', () => ({
  ...(jest.requireActual('../layout') as object),
  layoutScore: jest.fn(() => mockMakeLayoutPlan()),
}));
jest.mock('../render', () => ({
  renderScore: jest.fn(() => mockMakeItemsLayout()),
}));

import { layoutScore } from '../layout';
import { measureScore } from '../measure';
import { renderScore } from '../render';
import { useScoreRecording } from '../useScoreRecording';

const HOOK_ARGS = {
  defaultFont: 'Bravura',
  fontManager: {} as never,
  colorScheme: {} as never,
  options: {} as never,
  rendererType: 'document' as const,
  score: { id: 'score-1', defaults: {}, staves: [] } as never,
  viewport: { x: 0, y: 0, width: 393, height: 116 },
};

function useRecordingPass(args: Parameters<typeof useScoreRecording>[0]) {
  mockMemoCursor = 0;
  return useScoreRecording(args);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMemoSlots.length = 0;
});

describe('useScoreRecording items layout', () => {
  it('returns the geometry captured by renderScore in the same pass', () => {
    const recording = useRecordingPass({ ...HOOK_ARGS, enabled: true });

    expect(renderScore).toHaveBeenCalledTimes(1);
    expect(recording.itemsLayout).toEqual(mockMakeItemsLayout());
    expect(recording.commands).toEqual(['command-1']);
  });

  it('passes the exact renderScore output through at the default scale 1', () => {
    // At scale 1 the pipeline must behave exactly as before scaling existed:
    // same viewport, same itemsLayout object.
    const recording = useRecordingPass({ ...HOOK_ARGS, enabled: true });

    expect(layoutScore).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'document',
      HOOK_ARGS.viewport
    );
    const renderScoreMock = renderScore as unknown as {
      mock: { results: Array<{ value: unknown }> };
    };
    expect(recording.itemsLayout).toBe(renderScoreMock.mock.results[0]?.value);
  });

  it('lays out against the virtual viewport and emits view-space geometry at scale 0.5', () => {
    const recording = useRecordingPass({
      ...HOOK_ARGS,
      enabled: true,
      options: { render: { scale: 0.5 } } as never,
    });

    // Layout runs in content space: the whole viewport is divided by the
    // scale up front (see src/renderer/scale.ts).
    expect(layoutScore).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'document',
      { x: 0, y: 0, width: 786, height: 232 }
    );

    // Emitted geometry is content-space renderScore output x scale — half of
    // the same score+viewport's scale-1 values.
    expect(recording.itemsLayout).toEqual({
      items: {
        'item-1': { x: 30, width: 6, headCenterX: 32.5, measureIndex: 0 },
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
          y: 9,
          height: 46,
          staveLineTopY: 15,
          staveLineBottomY: 35,
        },
      ],
      contentSize: { width: 196.5, height: 58 },
    });

    // The layout plan itself stays content-space (picture cull extent).
    expect(recording.layoutPlan.contentSize).toEqual({
      width: 393,
      height: 116,
    });
  });

  it('forwards decorateItem to measurement and both hooks to rendering', () => {
    const decorateItem = jest.fn();
    const onDrawItem = jest.fn();

    useRecordingPass({
      ...HOOK_ARGS,
      enabled: true,
      decorateItem,
      onDrawItem,
    });

    expect(measureScore).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { decorateItem }
    );
    expect(renderScore).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      { decorateItem, onDrawItem }
    );
  });

  it('returns an empty items layout in the disabled branch', () => {
    const recording = useRecordingPass({ ...HOOK_ARGS, enabled: false });

    expect(renderScore).not.toHaveBeenCalled();
    expect(recording.commands).toEqual([]);
    expect(recording.itemsLayout).toEqual({
      items: {},
      measures: [],
      contentSize: { width: 393, height: 116 },
    });
  });
});

describe('useScoreRecording caching', () => {
  const measuredScore = { measures: [{}], maxIntrinsicNoteWidth: 1 };

  beforeEach(() => {
    (measureScore as jest.Mock).mockReturnValue(measuredScore);
  });

  it('keeps the whole recording on a height-only change of a document layout', () => {
    const first = useRecordingPass(HOOK_ARGS);
    const second = useRecordingPass({
      ...HOOK_ARGS,
      viewport: { ...HOOK_ARGS.viewport, height: 400 },
    });

    expect(second).toBe(first);
    expect(measureScore).toHaveBeenCalledTimes(1);
    expect(layoutScore).toHaveBeenCalledTimes(1);
  });

  it('re-lays out on a width change without re-measuring', () => {
    useRecordingPass(HOOK_ARGS);
    useRecordingPass({
      ...HOOK_ARGS,
      viewport: { ...HOOK_ARGS.viewport, width: 800 },
    });

    expect(measureScore).toHaveBeenCalledTimes(1);
    expect(layoutScore).toHaveBeenCalledTimes(2);
    expect(layoutScore).toHaveBeenLastCalledWith(
      expect.anything(),
      measuredScore,
      expect.anything(),
      'document',
      { x: 0, y: 0, width: 800, height: 0 }
    );
  });

  it('re-lays out on a height change of the infinite score without re-measuring', () => {
    const args = { ...HOOK_ARGS, rendererType: 'infiniteScore' as const };

    useRecordingPass(args);
    useRecordingPass({ ...args, viewport: { ...args.viewport, height: 400 } });

    expect(measureScore).toHaveBeenCalledTimes(1);
    expect(layoutScore).toHaveBeenCalledTimes(2);
    expect(layoutScore).toHaveBeenLastCalledWith(
      expect.anything(),
      measuredScore,
      expect.anything(),
      'infiniteScore',
      { x: 0, y: 0, width: 393, height: 400 }
    );
  });

  it('re-measures when the score changes', () => {
    useRecordingPass(HOOK_ARGS);
    useRecordingPass({
      ...HOOK_ARGS,
      score: { id: 'score-2', defaults: {}, staves: [] } as never,
    });

    expect(measureScore).toHaveBeenCalledTimes(2);
    expect(layoutScore).toHaveBeenCalledTimes(2);
  });
});
