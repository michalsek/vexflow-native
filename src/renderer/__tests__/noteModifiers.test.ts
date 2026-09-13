import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  Annotation as VFAnnotation,
  AnnotationVerticalJustify,
  Font,
  GhostNote,
  StaveNote,
} from 'vexflow';
import type { Modifier } from 'vexflow';

import { installVexflowReactNativeFallbacks } from '../../base/setupVexflowReactNative';
import type { Direction, Dynamic, NoteAttachment } from '../../state';
import { applyMeasureDirections, applyNoteModifiers } from '../noteModifiers';
import type { Mark } from './stubs';

const OWNER = 'owner';

function quarter() {
  return new StaveNote({ clef: 'treble', keys: ['c/5'], duration: 'q' });
}

function attachment(extra: Mark): NoteAttachment {
  return { id: `${OWNER}-${extra.type}`, ownerId: OWNER, ...extra };
}

function annotations(note: StaveNote) {
  return note.getModifiersByType('Annotation') as VFAnnotation[];
}

function justification(modifier: Modifier) {
  return (modifier as unknown as { verticalJustification: number })
    .verticalJustification;
}

beforeAll(() => {
  installVexflowReactNativeFallbacks();
});

describe('applyNoteModifiers', () => {
  it('draws a lyric below the owner in the lyric font', () => {
    const note = quarter();

    applyNoteModifiers(note, 'treble', [
      attachment({ type: 'lyric', text: 'la' }),
    ]);

    const [lyric] = annotations(note);

    expect(lyric?.getText()).toBe('la');
    expect(justification(lyric!)).toBe(AnnotationVerticalJustify.BOTTOM);
    expect(lyric?.fontInfo).toMatchObject({ size: 10, weight: 'normal' });
  });

  const placements: Array<['above' | 'below' | undefined, number]> = [
    [undefined, AnnotationVerticalJustify.BOTTOM],
    ['below', AnnotationVerticalJustify.BOTTOM],
    ['above', AnnotationVerticalJustify.TOP],
  ];

  it.each(placements)(
    'draws a dynamic as its glyph in the music font (placement %s)',
    (placement, expected) => {
      const note = quarter();

      applyNoteModifiers(note, 'treble', [
        attachment({ type: 'dynamic', dynamic: 'sfz', placement }),
      ]);

      const [dynamic] = annotations(note);

      expect(Font.convertSizeToPointValue(dynamic!.fontInfo.size)).toBe(30);
      expect(dynamic?.fontInfo.family).toContain('Bravura');
      expect(justification(dynamic!)).toBe(expected);
    }
  );

  const glyphs: Array<[Dynamic, number]> = [
    ['ppp', 0xe52a],
    ['pp', 0xe52b],
    ['p', 0xe520],
    ['mp', 0xe52c],
    ['mf', 0xe52d],
    ['f', 0xe522],
    ['ff', 0xe52f],
    ['fff', 0xe530],
    ['fp', 0xe534],
    ['sf', 0xe536],
    ['sfp', 0xe537],
    ['sfz', 0xe539],
    ['rf', 0xe53c],
    ['rfz', 0xe53d],
    ['fz', 0xe535],
    ['n', 0xe526],
  ];

  it.each(glyphs)('draws %s as its SMuFL glyph', (dynamic, codePoint) => {
    const note = quarter();

    applyNoteModifiers(note, 'treble', [
      attachment({ type: 'dynamic', dynamic }),
    ]);

    expect(annotations(note)[0]?.getText().codePointAt(0)).toBe(codePoint);
  });

  it('stacks articulations, annotations, dynamics, lyrics by verse, then grace notes regardless of input order', () => {
    const note = quarter();

    applyNoteModifiers(note, 'treble', [
      attachment({ type: 'lyric', text: 'v2', verse: 2 }),
      attachment({
        type: 'grace',
        notes: [{ pitch: { step: 'C', octave: 5 }, duration: { length: '8' } }],
      }),
      attachment({ type: 'dynamic', dynamic: 'f' }),
      attachment({ type: 'annotation', text: 'R' }),
      attachment({ type: 'articulation', articulation: 'accent' }),
      attachment({ type: 'lyric', text: 'v1', verse: 1 }),
      attachment({ type: 'lyric', text: 'v0' }),
    ]);

    expect(
      note
        .getModifiers()
        .map((modifier) =>
          modifier.getCategory() === 'Annotation'
            ? modifier.getText()
            : modifier.getCategory()
        )
    ).toEqual([
      'Articulation',
      'R',
      '\uE522',
      'v0',
      'v1',
      'v2',
      'GraceNoteGroup',
    ]);
  });

  it('engraves a chord-tone accent once at key index 0', () => {
    const note = new StaveNote({
      clef: 'treble',
      keys: ['c/5', 'e/5', 'g/5'],
      duration: 'q',
    });

    applyNoteModifiers(note, 'treble', [
      attachment({
        type: 'articulation',
        articulation: 'accent',
        pitchIndices: [1, 2],
      }),
    ]);

    const articulations = note.getModifiersByType('Articulation');

    expect(articulations).toHaveLength(1);
    expect(articulations[0]?.getIndex()).toBe(0);
  });
});

describe('applyMeasureDirections', () => {
  const DIRECTIONS: Direction[] = [
    { id: 'd1', type: 'text', text: 'Solo' },
    { id: 'd2', type: 'text', text: 'rit.', placement: 'below' },
    { id: 'd3', type: 'tempo', tempo: { bpm: 120 } },
  ];

  it('draws text directions on the first drawn item, after its own marks', () => {
    const spacer = new GhostNote('q');
    const first = quarter();
    const second = quarter();

    applyNoteModifiers(first, 'treble', [
      attachment({ type: 'annotation', text: 'R' }),
    ]);
    applyMeasureDirections([spacer, first, second], DIRECTIONS);

    expect(spacer.getModifiers()).toHaveLength(0);
    expect(second.getModifiers()).toHaveLength(0);
    expect(
      annotations(first).map((annotation) => [
        annotation.getText(),
        justification(annotation),
        annotation.fontInfo.size,
      ])
    ).toEqual([
      ['R', AnnotationVerticalJustify.BOTTOM, 10],
      ['Solo', AnnotationVerticalJustify.TOP, 11],
      ['rit.', AnnotationVerticalJustify.BOTTOM, 11],
    ]);
  });

  it('draws nothing when the voice has no drawn item', () => {
    const spacers = [new GhostNote('h'), new GhostNote('h')];

    applyMeasureDirections(spacers, DIRECTIONS);

    expect(spacers.flatMap((spacer) => spacer.getModifiers())).toHaveLength(0);
  });
});
