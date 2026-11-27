import { beforeAll, describe, expect, it, jest } from '@jest/globals';

// Platform 'web' routes text measurement to the Element measurement canvas
// installed below instead of the Skia-backed TextMeasureContext.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { createHash } from 'crypto';

import { Skia } from 'react-native-skia';
import { Element } from 'vexflow';

import type { Score, VoiceItem } from '../../state';
import { engraveScore } from '../engraveScore';
import type { ScoreRendererOptions } from '../types';
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

// Recorded on the release before these options (2.1.0) with this score, width
// and the stubbed text metrics.
const DEFAULT_ENGRAVING = {
  commandCount: 347,
  sha256: '7d9fc82b2923d2425d7074c68709900a00bfe2e51904e388000b88ca0aef65df',
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
  it('engraves the defaults exactly as before the page spacing options', () => {
    const {
      commands,
      contentSize,
      itemsLayout: { tempoMarks, ...itemsLayout },
    } = engrave();
    const rounded = JSON.stringify(
      { commands, contentSize, itemsLayout },
      (_key, value) =>
        typeof value === 'number' ? Math.round(value * 1000) / 1000 : value
    );

    expect(commands).toHaveLength(DEFAULT_ENGRAVING.commandCount);
    expect(createHash('sha256').update(rounded).digest('hex')).toBe(
      DEFAULT_ENGRAVING.sha256
    );
    expect(tempoMarks).toEqual([]);
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
