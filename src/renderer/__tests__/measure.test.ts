import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Stave } from 'vexflow';

import type { Measure, Meter, Score, Step, VoiceItem } from '../../state';
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

  it('adds the time signature to measurement staves when showMeter is set', () => {
    const addTimeSignatureSpy = jest.spyOn(Stave.prototype, 'addTimeSignature');
    const score = makeSingleStaffScore({ showMeter: true });

    const measuredScore = measureScore(score, TEST_OPTIONS);

    expect(measuredScore.measures).toHaveLength(1);
    expect(addTimeSignatureSpy).toHaveBeenCalledTimes(1);
    expect(addTimeSignatureSpy).toHaveBeenCalledWith('4/4');
  });

  it('keeps measurement output unchanged when showMeter is absent', () => {
    const addTimeSignatureSpy = jest.spyOn(Stave.prototype, 'addTimeSignature');

    const withoutFlag = measureScore(makeSingleStaffScore(), TEST_OPTIONS);
    const withFalseFlag = measureScore(
      makeSingleStaffScore({ showMeter: false }),
      TEST_OPTIONS
    );

    expect(addTimeSignatureSpy).not.toHaveBeenCalled();
    expect(withFalseFlag).toEqual(withoutFlag);
  });
});

function makeSingleStaffScore(leftModifiers?: Measure['leftModifiers']): Score {
  return {
    id: 'single-staff-meter',
    defaults: {
      meter: {
        beats: 4,
        beatUnit: 4,
      },
    },
    staves: [
      {
        id: 'solo',
        order: 0,
        defaultClef: 'treble',
        measures: [
          {
            id: 'solo-m1',
            number: 1,
            ...(leftModifiers ? { leftModifiers } : {}),
            voices: [
              {
                id: 'solo-m1-v1',
                index: 0,
                items: ['C', 'D', 'E', 'F'].map((step, index) => ({
                  id: `solo-m1-v1-n${index + 1}`,
                  type: 'note' as const,
                  voiceId: 'solo-m1-v1',
                  pitch: { step: step as Step, octave: 4 },
                  duration: { length: 'q' as const },
                })),
              },
            ],
          },
        ],
      },
    ],
  };
}
