import { describe, expect, it, jest } from '@jest/globals';

const mockFormatterJoinVoices = jest.fn();
const mockFormatterFormatToStave = jest.fn();
const mockStaveAddClef = jest.fn();
const mockStaveSetContext = jest.fn();
const mockStaveDraw = jest.fn();

jest.mock('vexflow', () => ({
  Formatter: class MockFormatter {
    joinVoices = mockFormatterJoinVoices;
    formatToStave = mockFormatterFormatToStave;
  },
  Stave: class MockStave {
    addClef = mockStaveAddClef;
    setContext = mockStaveSetContext.mockReturnThis();
    draw = mockStaveDraw.mockReturnThis();
  },
  Voice: class MockVoice {},
}));

const mockVoiceDraw = jest.fn();
const mockBeamSetContext = jest.fn();
const mockBeamDraw = jest.fn();
const mockTupletSetContext = jest.fn();
const mockTupletDraw = jest.fn();

jest.mock('../scoreParsing', () => ({
  makeVFVoice: jest.fn(() => ({
    vfVoice: { draw: mockVoiceDraw },
    notes: [],
    beams: [
      {
        setContext: mockBeamSetContext.mockReturnValue({ draw: mockBeamDraw }),
      },
    ],
    tuplets: [
      {
        setContext: mockTupletSetContext.mockReturnValue({
          draw: mockTupletDraw,
        }),
      },
    ],
  })),
}));

import { renderScore } from '../render';
import type { Score } from '../../state';
import type { ScoreLayoutPlan } from '../layout';
import { insets, renderOptions, spacing } from '../constants';

const TEST_OPTIONS = {
  insets: { ...insets },
  spacing: { ...spacing },
  render: { ...renderOptions },
};

describe('renderScore', () => {
  it('draws beams and tuplets produced by makeVFVoice', () => {
    const score: Score = {
      id: 'render-score',
      defaults: {
        meter: { beats: 4, beatUnit: 4 },
      },
      staves: [
        {
          id: 'staff-1',
          order: 0,
          defaultClef: 'treble',
          measures: [
            {
              id: 'measure-1',
              number: 1,
              voices: [{ id: 'voice-1', index: 0, items: [] }],
            },
          ],
        },
      ],
    };

    const layoutPlan: ScoreLayoutPlan = {
      rendererType: 'documentEven',
      contentSize: { width: 200, height: 100 },
      systems: [
        {
          groupId: 'staff:staff-1',
          systemIndex: 0,
          x: 24,
          y: 24,
          width: 152,
          height: 135,
          staffCount: 1,
          measureIndices: [0],
        },
      ],
      measures: [
        {
          groupId: 'staff:staff-1',
          measureIndex: 0,
          x: 24,
          y: 24,
          width: 152,
          height: 135,
          systemIndex: 0,
        },
      ],
      groups: [
        {
          groupId: 'staff:staff-1',
          staffIds: ['staff-1'],
          staves: score.staves,
          resolvedStatesByStaff: [
            [{ clef: 'treble', meter: score.defaults.meter }],
          ],
          measures: [
            {
              groupId: 'staff:staff-1',
              measureIndex: 0,
              intrinsicWidth: 152,
              measureNumbers: [1],
            },
          ],
        },
      ],
    };

    renderScore({} as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockVoiceDraw).toHaveBeenCalledTimes(1);
    expect(mockBeamSetContext).toHaveBeenCalledTimes(1);
    expect(mockBeamDraw).toHaveBeenCalledTimes(1);
    expect(mockTupletSetContext).toHaveBeenCalledTimes(1);
    expect(mockTupletDraw).toHaveBeenCalledTimes(1);
  });
});
