import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { VoiceItem } from '../../state';

const mockFormatterJoinVoices = jest.fn();
const mockFormatterFormatToStave = jest.fn();
const mockStaveAddClef = jest.fn();
const mockStaveAddTimeSignature = jest.fn();
const mockStaveSetContext = jest.fn();
const mockStaveDraw = jest.fn();
const mockStaveInstances: Array<{ constructorArgs: unknown[] }> = [];
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
const mockNoteSetContext = jest.fn();
const mockNoteDrawWithStyle = jest.fn();
const mockVoiceSetRendered = jest.fn();
const mockBeginColorGroup = jest.fn();
const mockEndColorGroup = jest.fn();
const mockRecordingContext = {
  beginColorGroup: mockBeginColorGroup,
  endColorGroup: mockEndColorGroup,
};
/** Formatted geometry stubs: successive notes in a voice report strictly
 * increasing absolute x values, mimicking formatToStave's tick order. */
const MOCK_NOTE_FIRST_X = 60;
const MOCK_NOTE_X_STEP = 30;
const MOCK_NOTE_WIDTH = 12;
const mockMakeVFVoice = jest.fn(
  (
    _score: unknown,
    _meter: unknown,
    _clef: unknown,
    voice: { items: unknown[] },
    _options?: unknown
  ) => ({
    vfVoice: { setRendered: mockVoiceSetRendered },
    notes: voice.items.map((_item, index) => ({
      drawWithStyle: mockNoteDrawWithStyle,
      setContext: mockNoteSetContext.mockReturnThis(),
      setStave: mockNoteSetStave,
      getAbsoluteX: () => MOCK_NOTE_FIRST_X + index * MOCK_NOTE_X_STEP,
      getWidth: () => MOCK_NOTE_WIDTH,
    })),
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
    constructor(...constructorArgs: unknown[]) {
      this.constructorArgs = constructorArgs;
      mockStaveInstances.push(this);
    }

    constructorArgs: unknown[];
    addClef = mockStaveAddClef;
    addTimeSignature = mockStaveAddTimeSignature;
    setContext = mockStaveSetContext.mockReturnThis();
    draw = mockStaveDraw.mockReturnThis();
    getNoteStartX = () => (this.constructorArgs[0] as number) + 10;
    getNoteEndX = () =>
      (this.constructorArgs[0] as number) + (this.constructorArgs[2] as number);
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

const mockBeamSetContext = jest.fn();
const mockBeamDraw = jest.fn();
const mockTupletSetContext = jest.fn();
const mockTupletDraw = jest.fn();

jest.mock('../scoreParsing', () => ({
  indexAttachmentsByOwner: jest.fn(() => new Map()),
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
const SINGLE_STAFF_BOUNDS = [{ top: 40, bottom: 80 }];
const TWO_STAFF_BOUNDS = [
  { top: 40, bottom: 80 },
  { top: 40, bottom: 80 },
];

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
          staffYOffsets: [0],
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
          staffYOffsets: [0],
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
              staffBounds: SINGLE_STAFF_BOUNDS,
            },
          ],
        },
      ],
    };

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockVoiceSetRendered).toHaveBeenCalledTimes(1);
    expect(mockBeamSetContext).toHaveBeenCalledTimes(1);
    expect(mockBeamDraw).toHaveBeenCalledTimes(1);
    expect(mockTupletSetContext).toHaveBeenCalledTimes(1);
    expect(mockTupletDraw).toHaveBeenCalledTimes(1);
  });

  it('builds fresh VexFlow voices while using measured layout data', () => {
    const item = { id: 'item-1', targetStaffId: undefined };
    const score: Score = {
      id: 'render-fresh-artifacts',
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
              voices: [
                {
                  id: 'voice-1',
                  index: 0,
                  items: [item as VoiceItem],
                },
              ],
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
          staffYOffsets: [0],
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
          staffYOffsets: [0],
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
              staffBounds: SINGLE_STAFF_BOUNDS,
            },
          ],
        },
      ],
    };

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockMakeVFVoice).toHaveBeenCalledTimes(1);
    expect(mockVoiceSetRendered).toHaveBeenCalledTimes(1);
    expect(mockBeginColorGroup).toHaveBeenCalledWith('item-1');
    expect(mockNoteSetContext).toHaveBeenCalledWith(mockRecordingContext);
    expect(mockNoteDrawWithStyle).toHaveBeenCalledTimes(1);
    expect(mockEndColorGroup).toHaveBeenCalledTimes(1);
    expect(mockBeamDraw).toHaveBeenCalledTimes(1);
  });

  it('closes item color groups when a tickable draw fails', () => {
    const item = { id: 'throwing-item', targetStaffId: undefined };
    const score: Score = {
      id: 'render-failing-item',
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
              voices: [
                {
                  id: 'voice-1',
                  index: 0,
                  items: [item as VoiceItem],
                },
              ],
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
          staffYOffsets: [0],
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
          staffYOffsets: [0],
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
              staffBounds: SINGLE_STAFF_BOUNDS,
            },
          ],
        },
      ],
    };
    const error = new Error('draw failed');
    mockNoteDrawWithStyle.mockImplementationOnce(() => {
      throw error;
    });

    expect(() =>
      renderScore(
        mockRecordingContext as never,
        score,
        layoutPlan,
        TEST_OPTIONS
      )
    ).toThrow(error);

    expect(mockBeginColorGroup).toHaveBeenCalledWith('throwing-item');
    expect(mockEndColorGroup).toHaveBeenCalledTimes(1);
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
          staffYOffsets: [0, 120],
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
          staffYOffsets: [0, 120],
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
              staffBounds: TWO_STAFF_BOUNDS,
            },
          ],
        },
      ],
    };

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockStaveInstances[0]?.constructorArgs).toEqual([24, 24, 152]);
    expect(mockStaveInstances[1]?.constructorArgs).toEqual([24, 144, 152]);
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

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

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

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

    expect(getConnectorTypes()).toEqual([
      mockStaveConnectorType.BRACKET,
      mockStaveConnectorType.SINGLE_LEFT,
      mockStaveConnectorType.SINGLE_RIGHT,
    ]);
  });

  it('draws only barline connectors for line multistaff groups', () => {
    const score = makeConnectorScore('line');
    const layoutPlan = makeConnectorLayoutPlan(score, [0]);

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

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
          staffYOffsets: [0],
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
          staffYOffsets: [0],
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
              staffBounds: SINGLE_STAFF_BOUNDS,
            },
          ],
        },
      ],
    };

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockStaveConnectorDraw).not.toHaveBeenCalled();
  });

  it('adds the time signature when showMeter is set on the measure', () => {
    const { score, layoutPlan } = makeShowMeterFixture({ showMeter: true });

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockStaveAddTimeSignature).toHaveBeenCalledTimes(1);
    expect(mockStaveAddTimeSignature).toHaveBeenCalledWith('4/4');
  });

  it('does not add a time signature when showMeter is absent', () => {
    const { score, layoutPlan } = makeShowMeterFixture(undefined);

    renderScore(mockRecordingContext as never, score, layoutPlan, TEST_OPTIONS);

    expect(mockStaveAddTimeSignature).not.toHaveBeenCalled();
  });

  describe('items layout', () => {
    const makeItemsLayoutFixture = () => {
      const items = [
        { id: 'note-1', type: 'note' },
        { id: 'rest-1', type: 'rest' },
        { id: 'note-2', type: 'note' },
      ] as unknown as VoiceItem[];
      const score: Score = {
        id: 'items-layout-render',
        defaults: {
          meter: { beats: 4, beatUnit: 4 },
        },
        staves: [
          {
            id: 'staff-1',
            order: 0,
            defaultClef: 'percussion',
            measures: [
              {
                id: 'measure-1',
                number: 1,
                voices: [{ id: 'voice-1', index: 0, items }],
              },
            ],
          },
        ],
      };
      const layoutPlan: ScoreLayoutPlan = {
        rendererType: 'document',
        contentSize: { width: 393, height: 116 },
        systems: [
          {
            groupId: 'staff:staff-1',
            systemIndex: 0,
            x: 24,
            y: 24,
            width: 345,
            height: 68,
            staffCount: 1,
            staffYOffsets: [0],
            measureIndices: [0],
          },
        ],
        measures: [
          {
            groupId: 'staff:staff-1',
            measureIndex: 0,
            x: 24,
            y: 24,
            width: 345,
            height: 68,
            staffYOffsets: [0],
            systemIndex: 0,
          },
        ],
        groups: [
          {
            groupId: 'staff:staff-1',
            staffIds: ['staff-1'],
            staves: score.staves,
            resolvedStatesByStaff: [
              [{ clef: 'percussion', meter: score.defaults.meter }],
            ],
            measures: [
              {
                groupId: 'staff:staff-1',
                measureIndex: 0,
                intrinsicWidth: 345,
                measureNumbers: [1],
                staffBounds: SINGLE_STAFF_BOUNDS,
              },
            ],
          },
        ],
      };

      return { score, layoutPlan };
    };

    it('collects one entry per voice item, rests included, in tick order', () => {
      const { score, layoutPlan } = makeItemsLayoutFixture();

      const itemsLayout = renderScore(
        mockRecordingContext as never,
        score,
        layoutPlan,
        TEST_OPTIONS
      );

      const ids = ['note-1', 'rest-1', 'note-2'];
      expect(Object.keys(itemsLayout.items).sort()).toEqual([...ids].sort());

      const xs = ids.map((id) => itemsLayout.items[id]!.x);
      for (let index = 1; index < xs.length; index += 1) {
        expect(xs[index]!).toBeGreaterThan(xs[index - 1]!);
      }

      for (const id of ids) {
        expect(itemsLayout.items[id]).toEqual({
          x: expect.any(Number),
          width: MOCK_NOTE_WIDTH,
          measureIndex: 0,
        });
      }
    });

    it('reports per-measure stave note bounds that bracket the first item', () => {
      const { score, layoutPlan } = makeItemsLayoutFixture();

      const itemsLayout = renderScore(
        mockRecordingContext as never,
        score,
        layoutPlan,
        TEST_OPTIONS
      );

      expect(itemsLayout.measures).toEqual([
        {
          groupId: 'staff:staff-1',
          measureIndex: 0,
          systemIndex: 0,
          x: 24,
          width: 345,
          staveNoteStartX: 34,
          staveNoteEndX: 369,
        },
      ]);

      const firstItemX = itemsLayout.items['note-1']!.x;
      const measure = itemsLayout.measures[0]!;
      expect(measure.staveNoteStartX).toBeLessThanOrEqual(firstItemX);
      expect(firstItemX).toBeLessThan(measure.staveNoteEndX);
    });

    it('mirrors the layout plan content size', () => {
      const { score, layoutPlan } = makeItemsLayoutFixture();

      const itemsLayout = renderScore(
        mockRecordingContext as never,
        score,
        layoutPlan,
        TEST_OPTIONS
      );

      expect(itemsLayout.contentSize).toEqual(layoutPlan.contentSize);
    });

    it('returns empty items for a measure with no voices', () => {
      const { score, layoutPlan } = makeItemsLayoutFixture();
      score.staves[0]!.measures[0]!.voices = [];

      const itemsLayout = renderScore(
        mockRecordingContext as never,
        score,
        layoutPlan,
        TEST_OPTIONS
      );

      expect(itemsLayout.items).toEqual({});
      expect(itemsLayout.measures).toHaveLength(1);
    });
  });
});

function makeShowMeterFixture(
  leftModifiers: { showMeter?: boolean } | undefined
): { score: Score; layoutPlan: ScoreLayoutPlan } {
  const score: Score = {
    id: 'show-meter-render',
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
            ...(leftModifiers ? { leftModifiers } : {}),
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
        staffYOffsets: [0],
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
        staffYOffsets: [0],
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
            staffBounds: SINGLE_STAFF_BOUNDS,
          },
        ],
      },
    ],
  };

  return { score, layoutPlan };
}

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
        staffYOffsets: [0, 120],
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
      staffYOffsets: [0, 120],
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
          staffBounds: TWO_STAFF_BOUNDS,
        })),
      },
    ],
  };
}
