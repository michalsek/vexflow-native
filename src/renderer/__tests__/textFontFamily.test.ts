import { beforeAll, expect, it, jest } from '@jest/globals';

// Platform 'web' routes text measurement to the Element measurement canvas
// installed below instead of the Skia-backed TextMeasureContext.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { Skia } from 'react-native-skia';
import { Element } from 'vexflow';

import type { Score } from '../../state';
import { engraveScore } from '../engraveScore';
import type { ScoreRendererOptions } from '../types';
import { fakeFontProvider, measurementCanvasStub } from './stubs';

const SCORE: Score = {
  id: 'text-font',
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
          directions: [{ id: 'direction-1', type: 'text', text: 'Swing' }],
          voices: [
            {
              id: 'voice-1',
              index: 0,
              items: [
                {
                  id: 'note-1',
                  type: 'note',
                  pitch: { step: 'C', octave: 5 },
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
  attachments: [
    { id: 'sticking', ownerId: 'note-1', type: 'annotation', text: 'R' },
    { id: 'lyric', ownerId: 'note-1', type: 'lyric', text: 'la' },
  ],
};

const textFamilies = (options?: ScoreRendererOptions) =>
  Object.fromEntries(
    engraveScore({
      score: SCORE,
      defaultFont: 'Bravura',
      fontManager: fakeFontProvider as never,
      options,
      width: 500,
    }).commands.flatMap((command) =>
      command.type === 'fillText' && ['R', 'la', 'Swing'].includes(command.text)
        ? [
            [
              command.text,
              typeof command.font.font === 'object'
                ? command.font.font.family
                : command.font.font,
            ],
          ]
        : []
    )
  );

beforeAll(() => {
  Element.setTextMeasurementCanvas(measurementCanvasStub);
  jest.mocked(Skia.Font).mockReturnValue({
    measureText: () => ({ x: 0, y: -10, width: 8, height: 12 }),
  } as never);
});

it.each<[string, ScoreRendererOptions | undefined, string]>([
  ['the default family', undefined, 'Arial, Helvetica, sans-serif'],
  [
    'render.textFontFamily',
    { render: { textFontFamily: 'Inter, sans-serif' } },
    'Inter, sans-serif',
  ],
])(
  'draws annotations, lyrics and text directions in %s',
  (_name, options, family) => {
    expect(textFamilies(options)).toEqual({
      R: family,
      la: family,
      Swing: family,
    });
  }
);
