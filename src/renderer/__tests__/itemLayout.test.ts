import { describe, expect, it } from '@jest/globals';

import { computeModifierBounds } from '../itemLayout';
import type { VFVoiceNote } from '../scoreParsing';

const box = (x: number, y: number, w: number, h: number) => ({
  getX: () => x,
  getY: () => y,
  getW: () => w,
  getH: () => h,
});
const modifier = (bounds: ReturnType<typeof box>) => ({
  getCategory: () => 'Articulation',
  getBoundingBox: () => bounds,
});
const note = (...modifiers: ReturnType<typeof modifier>[]) =>
  ({ getModifiers: () => modifiers } as unknown as VFVoiceNote);

describe('computeModifierBounds', () => {
  it('unions the modifier boxes, skipping unmeasurable ones', () => {
    expect(
      computeModifierBounds(
        note(
          modifier(box(10, 20, 6, 4)),
          modifier(box(0, 30, 4, 4)),
          modifier(box(NaN, 0, 1, 1))
        )
      )
    ).toEqual({ left: 0, right: 16, top: 20, bottom: 34 });
  });

  it('is undefined without modifiers', () => {
    expect(computeModifierBounds(note())).toBeUndefined();
  });
});
