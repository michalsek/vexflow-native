import { beforeAll, describe, expect, it, jest } from '@jest/globals';

// Platform 'web' routes text measurement to the Element measurement canvas
// installed below instead of the Skia-backed TextMeasureContext.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('react', () => ({
  ...(jest.requireActual('react') as object),
  useMemo: (factory: () => unknown) => factory(),
}));

import { Skia } from 'react-native-skia';
import { Element } from 'vexflow';

import type { Score, VoiceItem } from '../../state';
import { resolveScoreColorScheme } from '../colorScheme';
import { engraveScore } from '../engraveScore';
import { withDefaultOptions } from '../ScoreRenderer/utils';
import type { ScoreRendererOptions } from '../types';
import { useScoreRecording } from '../useScoreRecording';
import { fakeFontProvider, measurementCanvasStub } from './stubs';

const MEASURE_COUNT = 8;
const WIDTH = 500;

const SCORE: Score = {
  id: 'engrave-score',
  defaults: { meter: { beats: 4, beatUnit: 4 } },
  staves: [
    {
      id: 'staff-1',
      order: 0,
      defaultClef: 'treble',
      measures: Array.from({ length: MEASURE_COUNT }, (_, measureIndex) => ({
        id: `measure-${measureIndex}`,
        number: measureIndex + 1,
        voices: [
          {
            id: `voice-${measureIndex}`,
            index: 0,
            items: Array.from(
              { length: 4 },
              (_item, itemIndex): VoiceItem => ({
                id: `m${measureIndex}-n${itemIndex}`,
                type: 'note',
                pitch: { step: 'C', octave: 5 },
                duration: { length: 'q' },
                voiceId: `voice-${measureIndex}`,
              })
            ),
          },
        ],
      })),
    },
  ],
};

const engrave = (options?: ScoreRendererOptions) =>
  engraveScore({
    score: SCORE,
    defaultFont: 'Bravura',
    fontManager: fakeFontProvider as never,
    options,
    width: WIDTH,
  });

beforeAll(() => {
  Element.setTextMeasurementCanvas(measurementCanvasStub);
  jest.mocked(Skia.Font).mockReturnValue({
    measureText: () => ({ x: 0, y: -10, width: 8, height: 12 }),
  } as never);
});

describe('engraveScore', () => {
  it.each<[string, ScoreRendererOptions]>([
    ['the defaults', {}],
    [
      'a render scale and page spacing',
      {
        render: { scale: 0.5 },
        spacing: { firstSystemIndent: 40, clefOnEachSystem: true },
      },
    ],
  ])('returns what the mounted renderer records with %s', (_name, options) => {
    const engraving = engrave(options);
    const recording = useScoreRecording({
      score: SCORE,
      defaultFont: 'Bravura',
      fontManager: fakeFontProvider as never,
      colorScheme: resolveScoreColorScheme(undefined),
      options: withDefaultOptions(options),
      rendererType: 'document',
      viewport: { x: 0, y: 0, width: WIDTH, height: 700 },
    });

    expect(engraving.commands.length).toBeGreaterThan(0);
    expect(engraving.commands).toEqual(recording.commands);
    expect(engraving.itemsLayout).toEqual(recording.itemsLayout);
    expect(engraving.contentSize).toEqual(recording.layoutPlan.contentSize);
  });

  it('reports every system with a band that covers its layout band', () => {
    const { systems, itemsLayout } = engrave();

    expect(systems.length).toBeGreaterThan(1);
    expect(systems.flatMap((system) => system.measureIndices)).toEqual(
      Array.from({ length: MEASURE_COUNT }, (_, index) => index)
    );
    systems.forEach((system) => {
      const measure = itemsLayout.measures.find(
        ({ systemIndex }) => systemIndex === system.systemIndex
      )!;

      expect(system.y).toBeLessThanOrEqual(measure.y);
      expect(system.y + system.height).toBeGreaterThanOrEqual(
        measure.y + measure.height
      );
    });
  });

  it('draws the clef at every system start with clefOnEachSystem', () => {
    const noteStartInsets = (options?: ScoreRendererOptions) => {
      const { systems, itemsLayout } = engrave(options);

      return systems.slice(1).map((system) => {
        const measure = itemsLayout.measures.find(
          ({ measureIndex }) => measureIndex === system.measureIndices[0]
        )!;

        return measure.staveNoteStartX - measure.x;
      });
    };
    const bare = Math.max(...noteStartInsets());

    noteStartInsets({ spacing: { clefOnEachSystem: true } }).forEach((inset) =>
      expect(inset).toBeGreaterThan(bare)
    );
  });
});
