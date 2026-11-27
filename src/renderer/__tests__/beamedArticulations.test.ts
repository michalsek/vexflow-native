import { beforeAll, describe, expect, it, jest } from '@jest/globals';

// Platform 'web' routes text measurement to the Element measurement canvas
// installed below instead of the Skia-backed TextMeasureContext.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { Skia } from 'react-native-skia';
import { Element } from 'vexflow';
import type { StaveNote } from 'vexflow';

import type {
  Articulation,
  DurationValue,
  Pitch,
  Score,
  StemDirection,
} from '../../state';
import { engraveScore } from '../engraveScore';
import type { ScoreItemBounds } from '../types';
import { fakeFontProvider, measurementCanvasStub } from './stubs';

const HI_HAT: Pitch = { step: 'G', octave: 5, notehead: 'x' };
const SNARE: Pitch = { step: 'C', octave: 5 };
const KICK: Pitch = { step: 'F', octave: 4 };

/** One beamed beat, `[pitches, articulation?]` per note. */
type Beat = Array<[Pitch[], Articulation?]>;

interface Case {
  beat: Beat;
  length: DurationValue['length'];
  stem: StemDirection;
  placement?: 'below';
}

/** The beat, then rests to fill a 4/4 bar on a percussion staff. */
function scoreOf({ beat, length, stem, placement }: Case): Score {
  return {
    id: 'beamed-articulations',
    defaults: { meter: { beats: 4, beatUnit: 4 } },
    attachments: beat.flatMap(([, articulation], index) =>
      articulation
        ? [
            {
              id: `a${index}`,
              ownerId: `n${index}`,
              type: 'articulation' as const,
              articulation,
              placement,
            },
          ]
        : []
    ),
    staves: [
      {
        id: 'drums',
        order: 0,
        defaultClef: 'percussion',
        measures: [
          {
            id: 'm',
            number: 1,
            voices: [
              {
                id: 'v',
                index: 0,
                items: [
                  ...beat.map(([pitches], index) => ({
                    id: `n${index}`,
                    type: 'chord' as const,
                    pitches,
                    duration: { length },
                    voiceId: 'v',
                    stemDirection: stem,
                  })),
                  {
                    id: 'r1',
                    type: 'rest',
                    voiceId: 'v',
                    duration: { length: 'q' },
                  },
                  {
                    id: 'r2',
                    type: 'rest',
                    voiceId: 'v',
                    duration: { length: 'h' },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

beforeAll(() => {
  Element.setTextMeasurementCanvas(measurementCanvasStub);
  jest.mocked(Skia.Font).mockReturnValue({
    measureText: () => ({ x: 0, y: -10, width: 8, height: 12 }),
  } as never);
});

const CASES: Array<[string, Case]> = [
  [
    'accented snare 8ths, stems up, nothing above',
    {
      beat: [
        [[SNARE], 'accent'],
        [[SNARE], 'accent'],
      ],
      length: '8',
      stem: 'up',
    },
  ],
  [
    'accented snare 16ths under a beam the hi-hat raises',
    {
      beat: [[[HI_HAT]], [[SNARE], 'accent'], [[HI_HAT]], [[SNARE], 'accent']],
      length: '16',
      stem: 'up',
    },
  ],
  [
    'accented hi-hat+snare chords beside accented snare-only notes',
    {
      beat: [
        [[HI_HAT, SNARE], 'accent'],
        [[SNARE], 'accent'],
        [[HI_HAT, SNARE], 'accent'],
        [[SNARE], 'accent'],
      ],
      length: '16',
      stem: 'up',
    },
  ],
  [
    'staccato, tenuto and marcato under a beam the hi-hat raises',
    {
      beat: [
        [[HI_HAT]],
        [[SNARE], 'staccato'],
        [[SNARE], 'tenuto'],
        [[SNARE], 'marcato'],
      ],
      length: '16',
      stem: 'up',
    },
  ],
  [
    'accents below snare 16ths, stems down, under a beam the kick lowers',
    {
      beat: [[[KICK]], [[SNARE], 'accent'], [[KICK]], [[SNARE], 'accent']],
      length: '16',
      stem: 'down',
      placement: 'below',
    },
  ],
  [
    'accents above snare 16ths, stems down',
    {
      beat: [[[KICK]], [[SNARE], 'accent'], [[KICK]], [[SNARE], 'accent']],
      length: '16',
      stem: 'down',
    },
  ],
];

describe('articulations on beamed notes', () => {
  it.each(CASES)('%s: clear of the stem and beam', (_name, testCase) => {
    const drawn: Array<{ note: StaveNote; bounds?: ScoreItemBounds }> = [];

    engraveScore({
      score: scoreOf(testCase),
      defaultFont: 'Bravura',
      fontManager: fakeFontProvider as never,
      width: 500,
      onDrawItem: (_ctx, item, note, layout) => {
        if (item.type === 'chord') {
          drawn.push({ note, bounds: layout.modifierBounds });
        }
      },
    });

    // Stems are read after the engraving, once beams have set them.
    const overlaps = drawn.flatMap(({ note, bounds }, index) => {
      if (!bounds) {
        return [];
      }

      const { topY, baseY } = note.getStemExtents();
      const ys = [topY, baseY, ...note.getYs()];
      const noteTop = Math.min(...ys);
      const noteBottom = Math.max(...ys);

      return bounds.bottom > noteTop && bounds.top < noteBottom
        ? [{ index, bounds, noteTop, noteBottom }]
        : [];
    });

    expect(overlaps).toEqual([]);
  });
});
