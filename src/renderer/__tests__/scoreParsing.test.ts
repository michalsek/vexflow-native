import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Beam, Stem } from 'vexflow';

import type { Score, Voice, VoiceItem } from '../../state';
import { makeVFVoice } from '../scoreParsing';

const TEST_SCORE: Score = {
  id: 'score-parsing-test',
  defaults: {
    meter: {
      beats: 4,
      beatUnit: 4,
    },
  },
  staves: [],
};

function makeEighthNotes(
  voiceId: string,
  stemDirection?: 'up' | 'down'
): VoiceItem[] {
  return ['C', 'D', 'E', 'F'].map((step, index) => ({
    id: `${voiceId}-n${index + 1}`,
    type: 'note' as const,
    voiceId,
    pitch: {
      step: step as 'C' | 'D' | 'E' | 'F',
      octave: 4,
    },
    duration: {
      length: '8',
    },
    stemDirection,
  }));
}

function makeVoice(id: string, items: VoiceItem[]): Voice {
  return {
    id,
    index: 0,
    timingMode: 'soft',
    items,
  };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('makeVFVoice', () => {
  it('preserves explicit MusicXML stem directions during beam generation', () => {
    const voice = makeVoice(
      'voice-with-stems',
      makeEighthNotes('voice-with-stems', 'down')
    );

    const { notes } = makeVFVoice(
      TEST_SCORE,
      TEST_SCORE.defaults.meter,
      'treble',
      voice
    );

    expect(notes.map((note) => note.getStemDirection())).toEqual([
      Stem.DOWN,
      Stem.DOWN,
      Stem.DOWN,
      Stem.DOWN,
    ]);
  });

  it('keeps default beam generation options for voices without explicit stems', () => {
    const generateBeamsSpy = jest.spyOn(Beam, 'generateBeams');
    const voice = makeVoice(
      'voice-without-stems',
      makeEighthNotes('voice-without-stems')
    );

    makeVFVoice(TEST_SCORE, TEST_SCORE.defaults.meter, 'treble', voice);

    expect(generateBeamsSpy).toHaveBeenLastCalledWith(
      expect.any(Array),
      undefined
    );
  });
});
