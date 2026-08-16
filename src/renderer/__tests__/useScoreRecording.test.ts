import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ScoreItemsLayout } from '../types';

/* useScoreRecording is a plain useMemo hook — running the factory directly is
 * enough to exercise the recording pipeline without a React renderer. */
jest.mock('react', () => ({
  ...(jest.requireActual('react') as object),
  useMemo: (factory: () => unknown) => factory(),
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
  layoutScore: jest.fn(() => mockMakeLayoutPlan()),
}));
jest.mock('../render', () => ({
  renderScore: jest.fn(() => mockMakeItemsLayout()),
}));

import { layoutScore } from '../layout';
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useScoreRecording items layout', () => {
  it('returns the geometry captured by renderScore in the same pass', () => {
    const recording = useScoreRecording({ ...HOOK_ARGS, enabled: true });

    expect(renderScore).toHaveBeenCalledTimes(1);
    expect(recording.itemsLayout).toEqual(mockMakeItemsLayout());
    expect(recording.commands).toEqual(['command-1']);
  });

  it('passes the exact renderScore output through at the default scale 1', () => {
    // At scale 1 the pipeline must behave exactly as before scaling existed:
    // same viewport, same itemsLayout object.
    const recording = useScoreRecording({ ...HOOK_ARGS, enabled: true });

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
    const recording = useScoreRecording({
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

  it('returns an empty items layout in the disabled branch', () => {
    const recording = useScoreRecording({ ...HOOK_ARGS, enabled: false });

    expect(renderScore).not.toHaveBeenCalled();
    expect(recording.commands).toEqual([]);
    expect(recording.itemsLayout).toEqual({
      items: {},
      measures: [],
      contentSize: { width: 393, height: 116 },
    });
  });
});
