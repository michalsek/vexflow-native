import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { VoiceItem } from '../../state';

const mockFormatterJoinVoices = jest.fn();
const mockFormatterFormatToStave = jest.fn();
const mockStaveAddClef = jest.fn();
const mockStaveSetContext = jest.fn();
const mockStaveDraw = jest.fn();
const mockStaveInstances: unknown[] = [];
const mockStaveConnectorType = {
  SINGLE_RIGHT: 0,
  SINGLE_LEFT: 1,
  BRACE: 3,
  BRACKET: 4,
};
const mockStaveConnectorInstances: unknown[] = [];
const mockStaveConnectorSetContext = jest.fn();
const mockStaveConnectorSetType = jest.fn();
const mockStaveConnectorDraw = jest.fn();
const mockNoteSetStave = jest.fn();
const mockMakeVFVoice = jest.fn(
  (
    _score: unknown,
    _meter: unknown,
    _clef: unknown,
    voice: { items: unknown[] },
    _options?: unknown
  ) => ({
    vfVoice: { draw: mockVoiceDraw },
    notes: voice.items.map(() => ({ setStave: mockNoteSetStave })),
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
  })
);

jest.mock('vexflow', () => ({
  Formatter: class MockFormatter {
    joinVoices = mockFormatterJoinVoices;
    formatToStave = mockFormatterFormatToStave;
  },
  Stave: class MockStave {
    constructor() {
      mockStaveInstances.push(this);
    }

    addClef = mockStaveAddClef;
    setContext = mockStaveSetContext.mockReturnThis();
    draw = mockStaveDraw.mockReturnThis();
  },
  StaveConnector: class MockStaveConnector {
    static type: Record<string, number> = {
      SINGLE_RIGHT: 0,
      SINGLE_LEFT: 1,
      BRACE: 3,
      BRACKET: 4,
    };

    topStave: unknown;
    bottomStave: unknown;

    constructor(mockTopStave: unknown, mockBottomStave: unknown) {
      this.topStave = mockTopStave;
      this.bottomStave = mockBottomStave;
      mockStaveConnectorInstances.push(this);
    }

    setType = mockStaveConnectorSetType.mockReturnThis();
    setContext = mockStaveConnectorSetContext.mockReturnThis();
    draw = mockStaveConnectorDraw.mockReturnThis();
  },
  Voice: class MockVoice {},
}));

const mockVoiceDraw = jest.fn();
const mockBeamSetContext = jest.fn();
const mockBeamDraw = jest.fn();
const mockTupletSetContext = jest.fn();
const mockTupletDraw = jest.fn();

jest.mock('../scoreParsing', () => ({
  makeVFVoice: jest.fn(
    (
      score: unknown,
      meter: unknown,
      clef: unknown,
      voice: { items: unknown[] },
      options?: unknown
    ) => mockMakeVFVoice(score, meter, clef, voice, options)
  ),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockStaveInstances.length = 0;
  mockStaveConnectorInstances.length = 0;
});

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

  it('assigns cross-staff voice items to their target staves', () => {
    const score: Score = {
      id: 'cross-staff-render',
      defaults: {
        meter: { beats: 4, beatUnit: 4 },
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
          measures: [
            {
              id: 'top-m1',
              number: 1,
              voices: [
                {
                  id: 'top-v1',
                  index: 1,
                  items: [
                    {
                      id: 'top-v1-n1',
                      type: 'note',
                      voiceId: 'top-v1',
                      pitch: { step: 'C', octave: 5 },
                      duration: { length: 'q' },
                    },
                    {
                      id: 'top-v1-n2',
                      type: 'note',
                      voiceId: 'top-v1',
                      targetStaffId: 'bottom',
                      pitch: { step: 'C', octave: 3 },
                      duration: { length: 'q' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'bottom',
          order: 1,
          defaultClef: 'bass',
          measures: [{ id: 'bottom-m1', number: 1, voices: [] }],
        },
      ],
    };
    const layoutPlan: ScoreLayoutPlan = {
      rendererType: 'documentEven',
      contentSize: { width: 200, height: 180 },
      systems: [
        {
          groupId: 'piano',
          systemIndex: 0,
          x: 24,
          y: 24,
          width: 152,
          height: 135,
          staffCount: 2,
          measureIndices: [0],
        },
      ],
      measures: [
        {
          groupId: 'piano',
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
          groupId: 'piano',
          staffIds: ['top', 'bottom'],
          staves: score.staves,
          resolvedStatesByStaff: [
            [{ clef: 'treble', meter: score.defaults.meter }],
            [{ clef: 'bass', meter: score.defaults.meter }],
          ],
          measures: [
            {
              groupId: 'piano',
              measureIndex: 0,
              intrinsicWidth: 152,
              measureNumbers: [1, 1],
            },
          ],
        },
      ],
    };

    renderScore({} as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockNoteSetStave).toHaveBeenNthCalledWith(1, mockStaveInstances[0]);
    expect(mockNoteSetStave).toHaveBeenNthCalledWith(2, mockStaveInstances[1]);

    const makeVoiceOptions = mockMakeVFVoice.mock.calls[0]?.[4] as
      | { resolveClef: (item: VoiceItem) => string }
      | undefined;
    expect(
      makeVoiceOptions?.resolveClef(
        score.staves[0]!.measures[0]!.voices[0]!.items[1]!
      )
    ).toBe('bass');
  });

  it('draws brace and barline connectors for grand staff systems', () => {
    const score = makeConnectorScore('brace');
    const layoutPlan = makeConnectorLayoutPlan(score, [0, 1]);

    renderScore({} as never, score, layoutPlan, TEST_OPTIONS);

    expect(getConnectorTypes()).toEqual([
      mockStaveConnectorType.BRACE,
      mockStaveConnectorType.SINGLE_LEFT,
      mockStaveConnectorType.SINGLE_LEFT,
      mockStaveConnectorType.SINGLE_RIGHT,
    ]);
    expect(mockStaveConnectorDraw).toHaveBeenCalledTimes(4);
  });

  it('draws bracket connectors for bracketed multistaff groups', () => {
    const score = makeConnectorScore('bracket');
    const layoutPlan = makeConnectorLayoutPlan(score, [0]);

    renderScore({} as never, score, layoutPlan, TEST_OPTIONS);

    expect(getConnectorTypes()).toEqual([
      mockStaveConnectorType.BRACKET,
      mockStaveConnectorType.SINGLE_LEFT,
      mockStaveConnectorType.SINGLE_RIGHT,
    ]);
  });

  it('draws only barline connectors for line multistaff groups', () => {
    const score = makeConnectorScore('line');
    const layoutPlan = makeConnectorLayoutPlan(score, [0]);

    renderScore({} as never, score, layoutPlan, TEST_OPTIONS);

    expect(getConnectorTypes()).toEqual([
      mockStaveConnectorType.SINGLE_LEFT,
      mockStaveConnectorType.SINGLE_RIGHT,
    ]);
    expect(getConnectorTypes()).not.toContain(mockStaveConnectorType.BRACE);
    expect(getConnectorTypes()).not.toContain(mockStaveConnectorType.BRACKET);
  });

  it('does not draw connectors for single-staff groups', () => {
    const score: Score = {
      id: 'single-staff-render',
      defaults: {
        meter: { beats: 4, beatUnit: 4 },
      },
      staffGroups: [
        {
          id: 'solo-group',
          role: 'custom',
          staffIds: ['solo'],
        },
      ],
      staves: [
        {
          id: 'solo',
          order: 0,
          defaultClef: 'treble',
          measures: [
            {
              id: 'solo-m1',
              number: 1,
              voices: [],
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
          groupId: 'solo-group',
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
          groupId: 'solo-group',
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
          groupId: 'solo-group',
          staffGroup: score.staffGroups?.[0],
          staffIds: ['solo'],
          staves: score.staves,
          resolvedStatesByStaff: [
            [{ clef: 'treble', meter: score.defaults.meter }],
          ],
          measures: [
            {
              groupId: 'solo-group',
              measureIndex: 0,
              intrinsicWidth: 152,
              measureNumbers: [1],
            },
          ],
        },
      ],
    };

    renderScore({} as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockStaveConnectorDraw).not.toHaveBeenCalled();
  });
});

function getConnectorTypes() {
  return mockStaveConnectorSetType.mock.calls.map(([type]) => type);
}

function makeConnectorScore(
  symbol: NonNullable<Score['staffGroups']>[number]['symbol']
): Score {
  return {
    id: `connector-${symbol}`,
    defaults: {
      meter: { beats: 4, beatUnit: 4 },
    },
    staffGroups: [
      {
        id: 'piano',
        role: 'grandStaff',
        symbol,
        staffIds: ['top', 'bottom'],
      },
    ],
    staves: [
      {
        id: 'top',
        order: 0,
        defaultClef: 'treble',
        measures: [
          { id: 'top-m1', number: 1, voices: [] },
          { id: 'top-m2', number: 2, voices: [] },
        ],
      },
      {
        id: 'bottom',
        order: 1,
        defaultClef: 'bass',
        measures: [
          { id: 'bottom-m1', number: 1, voices: [] },
          { id: 'bottom-m2', number: 2, voices: [] },
        ],
      },
    ],
  };
}

function makeConnectorLayoutPlan(
  score: Score,
  measureIndices: number[]
): ScoreLayoutPlan {
  return {
    rendererType: 'documentEven',
    contentSize: { width: 320, height: 180 },
    systems: [
      {
        groupId: 'piano',
        systemIndex: 0,
        x: 24,
        y: 24,
        width: 272,
        height: 135,
        staffCount: 2,
        measureIndices,
      },
    ],
    measures: measureIndices.map((measureIndex) => ({
      groupId: 'piano',
      measureIndex,
      x: 24 + measureIndex * 136,
      y: 24,
      width: 136,
      height: 135,
      systemIndex: 0,
    })),
    groups: [
      {
        groupId: 'piano',
        staffGroup: score.staffGroups?.[0],
        staffIds: ['top', 'bottom'],
        staves: score.staves,
        resolvedStatesByStaff: [
          [
            { clef: 'treble', meter: score.defaults.meter },
            { clef: 'treble', meter: score.defaults.meter },
          ],
          [
            { clef: 'bass', meter: score.defaults.meter },
            { clef: 'bass', meter: score.defaults.meter },
          ],
        ],
        measures: measureIndices.map((measureIndex) => ({
          groupId: 'piano',
          measureIndex,
          intrinsicWidth: 136,
          measureNumbers: [measureIndex + 1, measureIndex + 1],
        })),
      },
    ],
  };
}
