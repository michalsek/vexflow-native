import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BarlineType, Stave } from 'vexflow';

import type { Barline, KeySignature } from '../../state';
import {
  applyMeasureModifiers,
  keySignatureToVFSpec,
  resolveMeasureModifiers,
} from '../measureModifiers';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

const RESOLVED_STATE = {
  clef: 'treble' as const,
  meter: { beats: 3, beatUnit: 4 },
  keySignature: { tonic: 'D' as const },
};

describe('resolveMeasureModifiers', () => {
  it.each([
    [{}, 0, [true, false, false, 'single', 'single']],
    [{}, 1, [false, false, false, 'single', 'single']],
    [
      {
        leftModifiers: {
          showClef: false,
          showMeter: true,
          showKeySignature: true,
          startBarline: 'repeat-begin' as const,
        },
        rightModifiers: { endBarline: 'final' as const },
      },
      0,
      [false, true, true, 'repeat-begin', 'final'],
    ],
    [
      { leftModifiers: { showClef: true } },
      3,
      [true, false, false, 'single', 'single'],
    ],
  ])('resolves %j at index %i', (measure, measureIndex, expected) => {
    const resolved = resolveMeasureModifiers(measure, measureIndex);

    expect([
      resolved.showClef,
      resolved.showMeter,
      resolved.showKeySignature,
      resolved.startBarline,
      resolved.endBarline,
    ]).toEqual(expected);
  });
});

describe('applyMeasureModifiers', () => {
  const apply = (
    overrides: Partial<ReturnType<typeof resolveMeasureModifiers>>,
    clef: 'treble' | 'percussion' = 'treble'
  ) => {
    const stave = new Stave(0, 0, 300);
    const spies = {
      addClef: jest.spyOn(stave, 'addClef'),
      addKeySignature: jest.spyOn(stave, 'addKeySignature'),
      addTimeSignature: jest.spyOn(stave, 'addTimeSignature'),
      setBegBarType: jest.spyOn(stave, 'setBegBarType'),
      setEndBarType: jest.spyOn(stave, 'setEndBarType'),
    };

    applyMeasureModifiers(
      stave,
      { ...resolveMeasureModifiers({}, 1), ...overrides },
      { ...RESOLVED_STATE, clef }
    );

    return spies;
  };

  it.each<[Barline, BarlineType]>([
    ['single', BarlineType.SINGLE],
    ['double', BarlineType.SINGLE],
    ['end', BarlineType.SINGLE],
    ['final', BarlineType.SINGLE],
    ['repeat-begin', BarlineType.REPEAT_BEGIN],
    ['repeat-end', BarlineType.SINGLE],
  ])('maps start barline %s', (startBarline, expected) => {
    expect(apply({ startBarline }).setBegBarType).toHaveBeenCalledWith(
      expected
    );
  });

  it.each<[Barline, BarlineType]>([
    ['single', BarlineType.SINGLE],
    ['double', BarlineType.DOUBLE],
    ['end', BarlineType.END],
    ['final', BarlineType.END],
    ['repeat-begin', BarlineType.SINGLE],
    ['repeat-end', BarlineType.REPEAT_END],
  ])('maps end barline %s', (endBarline, expected) => {
    expect(apply({ endBarline }).setEndBarType).toHaveBeenCalledWith(expected);
  });

  it('adds clef, key and time signature when shown', () => {
    const spies = apply({
      showClef: true,
      showKeySignature: true,
      showMeter: true,
    });

    expect(spies.addClef).toHaveBeenCalledWith('treble');
    expect(spies.addKeySignature).toHaveBeenCalledWith('D');
    expect(spies.addTimeSignature).toHaveBeenCalledWith('3/4');
  });

  it('skips the key signature on a percussion clef', () => {
    expect(
      apply({ showKeySignature: true }, 'percussion').addKeySignature
    ).not.toHaveBeenCalled();
  });
});

describe('keySignatureToVFSpec', () => {
  it.each<[KeySignature, string]>([
    [{ tonic: 'C' }, 'C'],
    [{ tonic: 'F', accidental: '#' }, 'F#'],
    [{ tonic: 'C', accidental: 'b' }, 'Cb'],
    [{ tonic: 'A', mode: 'minor' }, 'C'],
    [{ tonic: 'D', mode: 'dorian' }, 'C'],
    [{ tonic: 'E', mode: 'phrygian' }, 'C'],
    [{ tonic: 'F', mode: 'lydian' }, 'C'],
    [{ tonic: 'G', mode: 'mixolydian' }, 'C'],
    [{ tonic: 'B', mode: 'locrian' }, 'C'],
    [{ tonic: 'G', accidental: '#', mode: 'major' }, 'Ab'],
    [{ tonic: 'A', accidental: '#', mode: 'major' }, 'Bb'],
    [{ tonic: 'F', accidental: 'b', mode: 'locrian' }, 'F'],
  ])('maps %j to %s', (keySignature, expected) => {
    expect(keySignatureToVFSpec(keySignature)).toBe(expected);
  });
});
