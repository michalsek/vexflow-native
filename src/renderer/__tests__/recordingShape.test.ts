import { beforeAll, describe, expect, it, jest } from '@jest/globals';

/* Structural guard for the invariants ScoreOverlayPicture rests on: a
 * per-group slice of the recording can be replayed standalone (over the base
 * picture) only while
 *   (a) the recording contains no canvas-state commands with global effect
 *       (scale / translate / clear) — grouped commands must be absolute
 *       content-space ops,
 *   (b) every groupId's commands are CONTIGUOUS in the stream, and
 *   (c) save/restore balance out inside each group slice.
 * If VexFlow or render.tsx ever start recording differently, this fails
 * instead of the overlay silently mis-drawing. */

// Platform 'web' routes VexflowRecordingContext to the Element text
// measurement canvas installed below instead of the Skia-backed
// TextMeasureContext (no Skia under jest).
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

jest.mock('@shopify/react-native-skia', () => ({
  FontWeight: { Normal: 'Normal', Bold: 'Bold' },
  FontSlant: { Upright: 'Upright', Italic: 'Italic', Oblique: 'Oblique' },
  FontWidth: { Normal: 'Normal' },
  Skia: { Font: jest.fn() },
}));

import { Element } from 'vexflow';

import VexflowRecordingContext from '../../base/VexflowRecordingContext';
import type { VexflowRecordingCommand } from '../../base/VexflowRecordingTypes';
import type { Score, VoiceItem } from '../../state';
import { insets, renderOptions, spacing } from '../constants';
import { layoutScore } from '../layout';
import { measureScore } from '../measure';
import { renderScore } from '../render';
import { createContentViewport, getRenderScale } from '../scale';

const TEST_OPTIONS = {
  insets: { ...insets },
  spacing: { ...spacing },
  render: { ...renderOptions },
};

/* Proportional text-measurement stub (same shape as the app's height-guard
 * harness) so glyph boxes are non-zero and drawing paths are realistic. */
const measurementCanvasStub = {
  getContext: (type: string) =>
    type === '2d'
      ? {
          font: '',
          measureText: (text: string) => ({
            width: text.length * 8,
            actualBoundingBoxAscent: 10,
            actualBoundingBoxDescent: 2,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: text.length * 8,
            fontBoundingBoxAscent: 10,
            fontBoundingBoxDescent: 2,
          }),
        }
      : null,
} as unknown as HTMLCanvasElement;

const fakeFontProvider = {
  countFamilies: () => 1,
  getFamilyName: () => 'Bravura',
  matchFamilyStyle: () => ({}),
};

const note = (id: string, length: '8' | 'q'): VoiceItem => ({
  id,
  type: 'note',
  pitch: { step: 'C', octave: 5 },
  duration: { length },
  voiceId: 'voice-1',
});

const TEST_SCORE: Score = {
  id: 'recording-shape-score',
  defaults: { meter: { beats: 4, beatUnit: 4 } },
  staves: [
    {
      id: 'staff-1',
      order: 0,
      defaultClef: 'percussion',
      measures: [
        {
          id: 'measure-1',
          number: 1,
          voices: [
            {
              id: 'voice-1',
              index: 0,
              items: [
                note('m1-n1', '8'),
                note('m1-n2', '8'),
                note('m1-n3', 'q'),
                note('m1-n4', 'q'),
                note('m1-n5', 'q'),
              ],
            },
          ],
        },
        {
          id: 'measure-2',
          number: 2,
          voices: [
            {
              id: 'voice-2',
              index: 0,
              items: [
                note('m2-n1', 'q'),
                note('m2-n2', 'q'),
                note('m2-n3', 'q'),
                note('m2-n4', 'q'),
              ],
            },
          ],
        },
      ],
    },
  ],
};

let commands: readonly VexflowRecordingCommand[];

beforeAll(() => {
  Element.setTextMeasurementCanvas(measurementCanvasStub);

  const scale = getRenderScale(TEST_OPTIONS);
  const viewport = createContentViewport(
    { x: 0, y: 0, width: 800, height: 600 },
    scale
  );
  const ctx = new VexflowRecordingContext(fakeFontProvider as never, 'Bravura');
  const measured = measureScore(TEST_SCORE, TEST_OPTIONS);
  const layoutPlan = layoutScore(
    TEST_SCORE,
    measured,
    TEST_OPTIONS,
    'documentEven',
    viewport
  );

  renderScore(ctx, TEST_SCORE, layoutPlan, TEST_OPTIONS);
  commands = ctx.finish();
});

describe('recording shape invariants', () => {
  it('records real drawing work with grouped voice items', () => {
    expect(commands.length).toBeGreaterThan(0);

    const groupIds = new Set(
      commands.map((command) => command.groupId).filter(Boolean)
    );
    expect(groupIds.size).toBe(9); // every note item records under its id
  });

  it('never records scale, translate, or clear commands', () => {
    const forbidden = commands.filter(
      (command) =>
        command.type === 'scale' ||
        command.type === 'translate' ||
        command.type === 'clear'
    );

    expect(forbidden).toEqual([]);
  });

  it('keeps each group slice contiguous in the command stream', () => {
    const firstIndex = new Map<string, number>();
    const lastIndex = new Map<string, number>();

    commands.forEach((command, index) => {
      if (command.groupId == null) {
        return;
      }
      if (!firstIndex.has(command.groupId)) {
        firstIndex.set(command.groupId, index);
      }
      lastIndex.set(command.groupId, index);
    });

    for (const [groupId, start] of firstIndex) {
      const end = lastIndex.get(groupId)!;

      for (let index = start; index <= end; index++) {
        expect(commands[index]?.groupId).toBe(groupId);
      }
    }
  });

  it('balances save/restore within every group slice', () => {
    const depths = new Map<string, number>();

    for (const command of commands) {
      if (command.groupId == null) {
        continue;
      }

      const depth = depths.get(command.groupId) ?? 0;

      if (command.type === 'save') {
        depths.set(command.groupId, depth + 1);
      } else if (command.type === 'restore') {
        depths.set(command.groupId, depth - 1);
        expect(depth - 1).toBeGreaterThanOrEqual(0);
      }
    }

    for (const [, depth] of depths) {
      expect(depth).toBe(0);
    }
  });
});
