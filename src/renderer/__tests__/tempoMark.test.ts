import { beforeAll, expect, it, jest } from '@jest/globals';

// Platform 'web' routes text measurement to the Element measurement canvas
// installed below instead of the Skia-backed TextMeasureContext.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { Skia } from 'react-native-skia';
import { Element } from 'vexflow';

import type { Score, Tempo } from '../../state';
import { engraveScore } from '../engraveScore';
import { fakeFontProvider, measurementCanvasStub } from './stubs';

const QUARTER = '\uECA5';
const HALF = '\uECA3';
const DOT = '\uECB7';

const scoreWithTempo = (tempo: Tempo): Score => ({
  id: 'tempo-mark',
  defaults: { meter: { beats: 4, beatUnit: 4 } },
  staves: [
    {
      id: 'staff-1',
      order: 0,
      defaultClef: 'treble',
      measures: [
        {
          id: 'measure-1',
          number: 1,
          directions: [
            { id: 'tempo-1', type: 'tempo', tempo },
            { id: 'tempo-2', type: 'tempo', tempo: { bpm: 60 } },
          ],
          voices: [
            {
              id: 'voice-1',
              index: 0,
              items: [
                {
                  id: 'note-1',
                  type: 'note',
                  pitch: { step: 'A', octave: 5 },
                  duration: { length: 'w' },
                  voiceId: 'voice-1',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

beforeAll(() => {
  Element.setTextMeasurementCanvas(measurementCanvasStub);
  jest.mocked(Skia.Font).mockReturnValue({
    measureText: () => ({ x: 0, y: -10, width: 8, height: 12 }),
  } as never);
});

it.each<[string, Tempo, Array<[string, string]>]>([
  [
    'a quarter by default',
    { bpm: 120 },
    [
      [QUARTER, 'Bravura,Academico'],
      ['=', 'Arial, Helvetica, sans-serif'],
      ['120', 'Arial, Helvetica, sans-serif'],
    ],
  ],
  [
    'a dotted beat unit with its dot',
    { bpm: 92, beatUnit: { length: 'q', dots: 1 } },
    [
      [QUARTER, 'Bravura,Academico'],
      [DOT, 'Bravura,Academico'],
      ['=', 'Arial, Helvetica, sans-serif'],
      ['92', 'Arial, Helvetica, sans-serif'],
    ],
  ],
  [
    'the text before the note',
    { bpm: 60, beatUnit: { length: 'h' }, text: 'Largo' },
    [
      ['Largo', 'Arial, Helvetica, sans-serif'],
      [HALF, 'Bravura,Academico'],
      ['=', 'Arial, Helvetica, sans-serif'],
      ['60', 'Arial, Helvetica, sans-serif'],
    ],
  ],
])(
  'draws the first tempo direction above the stave as %s',
  (_name, tempo, expectedTexts) => {
    const { commands, itemsLayout } = engraveScore({
      score: scoreWithTempo(tempo),
      defaultFont: 'Bravura',
      fontManager: fakeFontProvider as never,
      width: 500,
    });
    const measure = itemsLayout.measures[0]!;
    const [mark, ...otherMarks] = itemsLayout.tempoMarks ?? [];
    const markTexts = commands.flatMap((command) =>
      command.type === 'fillText' && command.groupId === 'tempo-1'
        ? [
            [
              command.text,
              typeof command.font.font === 'object'
                ? command.font.font.family
                : command.font.font,
            ],
          ]
        : []
    );

    expect(otherMarks).toEqual([]);
    expect(markTexts).toEqual(expectedTexts);
    expect(mark).toMatchObject({
      directionId: 'tempo-1',
      staffId: 'staff-1',
      measureIndex: 0,
      systemIndex: 0,
      bounds: { left: measure.staveNoteStartX },
    });
    expect(mark!.bounds.bottom).toBeLessThan(measure.staveLineTopY);
    expect(mark!.bounds.top).toBeGreaterThanOrEqual(measure.y);
    expect(mark!.bpmBounds.left).toBeGreaterThan(mark!.bounds.left);
    expect(mark!.bpmBounds.right).toBe(mark!.bounds.right);
    expect(mark!.bpmBounds.top).toBeGreaterThanOrEqual(mark!.bounds.top);
    expect(mark!.bpmBounds.bottom).toBeLessThanOrEqual(mark!.bounds.bottom);
  }
);
