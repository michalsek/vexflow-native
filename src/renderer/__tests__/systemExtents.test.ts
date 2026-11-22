import { describe, expect, it } from '@jest/globals';

import type { VexflowRecordingCommand } from '../../base';
import { coverDrawnExtents } from '../systemExtents';

const paint = { color: '#000000' };
const font = { font: 'Bravura', size: 30 };
// Glyphs reach 20 above and 5 below the baseline.
const fontManager: Parameters<typeof coverDrawnExtents>[2] = {
  createSkFont: () => ({
    measureText: () => ({ x: 0, y: -20, width: 10, height: 25 }),
  }),
};

const BANDS = [
  { y: 100, height: 50 },
  { y: 200, height: 50 },
];

describe('coverDrawnExtents', () => {
  it.each<[string, VexflowRecordingCommand[], [number, number][]]>([
    [
      'grows a band up to the outer edge of a stroke above it',
      [
        {
          type: 'strokePath',
          paint: { ...paint, strokeWidth: 2 },
          path: [
            { type: 'moveTo', x: 0, y: 90 },
            { type: 'lineTo', x: 10, y: 120 },
          ],
        },
      ],
      [
        [89, 150],
        [200, 250],
      ],
    ],
    [
      'grows a band down to the glyph box of a text below it',
      [{ type: 'fillText', text: 'R', x: 0, y: 160, paint, font }],
      [
        [100, 165],
        [200, 250],
      ],
    ],
    [
      'gives ink between two bands to the nearer one',
      [
        {
          type: 'fillPath',
          paint,
          path: [
            { type: 'moveTo', x: 0, y: 180 },
            { type: 'quadTo', cpx: 5, cpy: 190, x: 10, y: 180 },
            { type: 'close' },
          ],
        },
        {
          type: 'fillRect',
          rect: { x: 0, y: 150, width: 4, height: 8 },
          paint,
        },
      ],
      [
        [100, 158],
        [180, 250],
      ],
    ],
  ])('%s', (_name, commands, expected) => {
    expect(
      coverDrawnExtents(BANDS, commands, fontManager).map((band) => [
        band.y,
        band.y + band.height,
      ])
    ).toEqual(expected);
  });
});
