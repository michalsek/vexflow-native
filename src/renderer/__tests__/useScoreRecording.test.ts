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
    items: { 'item-1': { x: 60, width: 12, measureIndex: 0 } },
    measures: [
      {
        groupId: 'staff:staff-1',
        measureIndex: 0,
        systemIndex: 0,
        x: 24,
        width: 345,
        staveNoteStartX: 34,
        staveNoteEndX: 369,
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
