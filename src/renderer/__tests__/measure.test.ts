import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { Meter, Score, Step, VoiceItem } from '../../state';
import { insets, renderOptions, spacing } from '../constants';
import { measureScore } from '../measure';
import type { ScoreOptions } from '../types';

const TEST_OPTIONS: ScoreOptions = {
  insets: { ...insets },
  spacing: { ...spacing },
  render: { ...renderOptions },
};

const COMPOUND_METER: Meter = {
  beats: 6,
  beatUnit: 8,
  beamGroups: [
    { num: 3, den: 8 },
    { num: 3, den: 8 },
  ],
};

function makeEighthNotes(voiceId: string, octave: number): VoiceItem[] {
  const steps: Step[] = ['C', 'D', 'E', 'F', 'G', 'A'];

  return steps.map((step, index) => ({
    id: `${voiceId}-n${index + 1}`,
    type: 'note',
    voiceId,
    pitch: {
      step,
      octave,
    },
    duration: {
      length: '8',
    },
  }));
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('measureScore', () => {
  it('carries meter state forward between measures in grouped staves', () => {
    const score: Score = {
      id: 'carry-forward-meter',
      defaults: {
        meter: {
          beats: 4,
          beatUnit: 4,
        },
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
              state: { meter: COMPOUND_METER },
              voices: [
                {
                  id: 'top-m1-v1',
                  index: 0,
                  items: makeEighthNotes('top-m1-v1', 5),
                },
              ],
            },
            {
              id: 'top-m2',
              number: 2,
              voices: [
                {
                  id: 'top-m2-v1',
                  index: 0,
                  items: makeEighthNotes('top-m2-v1', 5),
                },
              ],
            },
          ],
        },
        {
          id: 'bottom',
          order: 1,
          defaultClef: 'bass',
          measures: [
            {
              id: 'bottom-m1',
              number: 1,
              state: { meter: COMPOUND_METER },
              voices: [
                {
                  id: 'bottom-m1-v1',
                  index: 0,
                  items: makeEighthNotes('bottom-m1-v1', 3),
                },
              ],
            },
            {
              id: 'bottom-m2',
              number: 2,
              voices: [
                {
                  id: 'bottom-m2-v1',
                  index: 0,
                  items: makeEighthNotes('bottom-m2-v1', 3),
                },
              ],
            },
          ],
        },
      ],
    };

    const measuredScore = measureScore(score, TEST_OPTIONS);

    expect(measuredScore.measures).toHaveLength(2);
    expect(measuredScore.measures[1]).toMatchObject({
      groupId: 'piano',
      measureIndex: 1,
      measureNumbers: [2, 2],
    });
  });
});
