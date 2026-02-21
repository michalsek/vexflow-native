import {
  Annotation,
  AnnotationHorizontalJustify,
  AnnotationVerticalJustify,
  Articulation,
  Beam,
  Bend,
  Formatter,
  ModifierPosition,
  Stave,
  StaveNote,
  Stem,
  TabNote,
  TabStave,
  Vibrato,
  Voice,
  VexFlow,
  Metrics,
  MetricsDefaults,
} from 'vexflow';
import { type CanvasDrawContext, type VisualCase } from './types';

type AnnotationSpec = {
  text: string;
  index?: number;
  v?: AnnotationVerticalJustify;
  h?: AnnotationHorizontalJustify;
  fontSize?: number;
  italic?: boolean;
  fillStyle?: string;
};

let textMetricsConfigured = false;

function configureTextMetricsForRn() {
  if (textMetricsConfigured) {
    return;
  }
  const defaults = MetricsDefaults as any;
  defaults.Annotation = { ...(defaults.Annotation ?? {}), fontFamily: 'Arial' };
  defaults.Bend = { ...(defaults.Bend ?? {}), fontFamily: 'Arial' };
  defaults.TabNote = {
    ...(defaults.TabNote ?? {}),
    text: { ...(defaults.TabNote?.text ?? {}), fontFamily: 'Arial' },
  };
  Metrics.clear('Annotation');
  Metrics.clear('Bend');
  Metrics.clear('TabNote.text');
  textMetricsConfigured = true;
}

function addAnnotation(note: StaveNote, spec: AnnotationSpec): StaveNote;
function addAnnotation(note: TabNote, spec: AnnotationSpec): TabNote;
function addAnnotation(note: StaveNote | TabNote, spec: AnnotationSpec) {
  const annotation = new Annotation(spec.text);
  if (spec.v) annotation.setVerticalJustification(spec.v);
  annotation.setJustification(
    spec.h ?? AnnotationHorizontalJustify.CENTER_STEM
  );
  if (spec.fontSize) annotation.setFontSize(spec.fontSize);
  if (spec.italic !== false) {
    annotation.setFont('Arial', spec.fontSize ?? 12, 'normal', 'italic');
  }
  if (spec.fillStyle) annotation.setStyle({ fillStyle: spec.fillStyle });
  note.addModifier(annotation, spec.index ?? 0);
  return note;
}

function drawAnnotationBoundingBoxes(
  ctx: CanvasDrawContext,
  notes: (StaveNote | TabNote)[]
) {
  ctx.save();
  ctx.setStrokeStyle('#ef4444');
  ctx.setLineWidth(1);

  notes.forEach((note) => {
    note.getModifiersByType('Annotation').forEach((modifier) => {
      const bbox = (modifier as any).getBoundingBox?.();
      if (!bbox) {
        return;
      }
      ctx.beginPath();
      ctx.rect(bbox.getX(), bbox.getY(), bbox.getW(), bbox.getH());
      ctx.stroke();
    });
  });

  ctx.restore();
}

function drawStaveVoice(
  ctx: CanvasDrawContext,
  stave: Stave,
  notes: StaveNote[],
  options?: { keySignature?: string }
) {
  configureTextMetricsForRn();
  stave.addClef('treble');
  if (options?.keySignature) stave.addKeySignature(options.keySignature);
  stave.setContext(ctx as any).draw();
  const voice = new Voice({ numBeats: 4, beatValue: 4 })
    .setStrict(false)
    .addTickables(notes);
  new Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(ctx as any, stave);
}

function drawTabVoice(
  ctx: CanvasDrawContext,
  stave: TabStave,
  notes: TabNote[]
) {
  configureTextMetricsForRn();
  // TabNote fret markers and bend labels rely on text rendering.
  // Force a known system font for RN/Skia so text-based tab glyphs render reliably.
  ctx.setFont('Arial', 12, 'normal', 'normal');
  stave.setContext(ctx as any).draw();
  const voice = new Voice({ numBeats: 4, beatValue: 4 })
    .setStrict(false)
    .addTickables(notes);
  new Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(ctx as any, stave);
}

function placementNotes(): StaveNote[] {
  const annotation = (
    text: string,
    fontSize: number,
    vj: AnnotationVerticalJustify
  ) => new Annotation(text).setFontSize(fontSize).setVerticalJustification(vj);

  return [
    new StaveNote({ keys: ['e/4'], duration: 'q', stemDirection: Stem.DOWN })
      .addModifier(
        new Articulation('a.').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(
        new Articulation('a-').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(annotation('v1', 10, AnnotationVerticalJustify.TOP), 0)
      .addModifier(annotation('v2', 10, AnnotationVerticalJustify.TOP), 0),
    new StaveNote({ keys: ['b/4'], duration: 'q', stemDirection: Stem.DOWN })
      .addModifier(
        new Articulation('a.').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(
        new Articulation('a-').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(annotation('v1', 10, AnnotationVerticalJustify.TOP), 0)
      .addModifier(annotation('v2', 10, AnnotationVerticalJustify.TOP), 0),
    new StaveNote({ keys: ['c/5'], duration: 'q', stemDirection: Stem.DOWN })
      .addModifier(
        new Articulation('a.').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(
        new Articulation('a-').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(annotation('v1', 10, AnnotationVerticalJustify.TOP), 0)
      .addModifier(annotation('v2', 10, AnnotationVerticalJustify.TOP), 0),
    new StaveNote({ keys: ['f/4'], duration: 'q' })
      .addModifier(annotation('v1', 14, AnnotationVerticalJustify.TOP), 0)
      .addModifier(annotation('v2', 14, AnnotationVerticalJustify.TOP), 0),
    new StaveNote({ keys: ['f/4'], duration: 'q', stemDirection: Stem.DOWN })
      .addModifier(
        new Articulation('am').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(
        new Articulation('a.').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(
        new Articulation('a-').setPosition(ModifierPosition.ABOVE),
        0
      )
      .addModifier(annotation('v1', 10, AnnotationVerticalJustify.TOP), 0)
      .addModifier(annotation('v2', 20, AnnotationVerticalJustify.TOP), 0),
    new StaveNote({ keys: ['f/5'], duration: 'q' })
      .addModifier(annotation('v1', 11, AnnotationVerticalJustify.TOP), 0)
      .addModifier(annotation('v2', 11, AnnotationVerticalJustify.TOP), 0),
    new StaveNote({ keys: ['f/5'], duration: 'q' })
      .addModifier(annotation('v1', 11, AnnotationVerticalJustify.TOP), 0)
      .addModifier(annotation('v2', 20, AnnotationVerticalJustify.TOP), 0),
    new StaveNote({ keys: ['f/4'], duration: 'q' })
      .addModifier(annotation('v1', 12, AnnotationVerticalJustify.BOTTOM), 0)
      .addModifier(annotation('v2', 12, AnnotationVerticalJustify.BOTTOM), 0),
    new StaveNote({ keys: ['f/5'], duration: 'q' })
      .addModifier(
        new Articulation('a.').setPosition(ModifierPosition.BELOW),
        0
      )
      .addModifier(annotation('v1', 11, AnnotationVerticalJustify.BOTTOM), 0)
      .addModifier(annotation('v2', 20, AnnotationVerticalJustify.BOTTOM), 0),
    new StaveNote({ keys: ['f/5'], duration: 'q', stemDirection: Stem.DOWN })
      .addModifier(
        new Articulation('am').setPosition(ModifierPosition.BELOW),
        0
      )
      .addModifier(annotation('v1', 10, AnnotationVerticalJustify.BOTTOM), 0)
      .addModifier(annotation('v2', 20, AnnotationVerticalJustify.BOTTOM), 0),
    new StaveNote({ keys: ['f/4'], duration: 'q', stemDirection: Stem.DOWN })
      .addModifier(annotation('v1', 10, AnnotationVerticalJustify.BOTTOM), 0)
      .addModifier(annotation('v2', 20, AnnotationVerticalJustify.BOTTOM), 0),
    new StaveNote({ keys: ['f/5'], duration: 'w' })
      .addModifier(
        new Articulation('a@u').setPosition(ModifierPosition.BELOW),
        0
      )
      .addModifier(annotation('v1', 11, AnnotationVerticalJustify.BOTTOM), 0)
      .addModifier(annotation('v2', 16, AnnotationVerticalJustify.BOTTOM), 0),
  ];
}

export const ANNOTATION_VISUAL_CASES: VisualCase[] = [
  {
    id: 'annotation-bounding-box',
    title: 'Annotation - Bounding Box',
    canvasWidth: 1150,
    canvasHeight: 280,
    draw: ({ ctx, width }) => {
      const notes = placementNotes();
      const stave = new Stave(10, 50, width - 20);
      drawStaveVoice(ctx, stave, notes);
      drawAnnotationBoundingBoxes(ctx, notes);
    },
  },
  {
    id: 'annotation-placement',
    title: 'Annotation - Placement',
    canvasWidth: 1150,
    canvasHeight: 280,
    draw: ({ ctx, width }) => {
      const notes = placementNotes();
      drawStaveVoice(ctx, new Stave(10, 50, width - 20), notes);
    },
  },
  {
    id: 'annotation-lyrics',
    title: 'Annotation - Lyrics',
    description: 'RN visual port of lyric placement under notes',
    canvasWidth: 450,
    canvasHeight: 420,
    draw: ({ ctx, width }) => {
      const row = (y: number, words: string[], fontSize: number) => {
        const notes = [
          new StaveNote({ keys: ['c/4', 'f/4'], duration: '2' }),
          new StaveNote({ keys: ['c/4', 'a/4'], duration: '8' }),
          new StaveNote({ keys: ['c/4', 'a/4'], duration: '8' }),
        ];

        words.forEach((word, i) => {
          const verse0 = new Annotation(word)
            .setFontSize(fontSize)
            .setFont('sans-serif', fontSize, 'normal', 'normal')
            .setPosition(ModifierPosition.BELOW)
            .setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
            .setJustification(AnnotationHorizontalJustify.CENTER);
          // Render one lyric line per note in the visual harness.
          notes[i]?.addModifier(verse0, 0);
        });

        drawStaveVoice(ctx, new Stave(44, y, width - 60), notes);
      };

      row(30, ['Handily', 'and', 'me'], 12);
      row(120, ['Pears', 'lead', 'the'], 14);
      row(210, ['Sing', 'what', 'you'], 16);
    },
  },
  {
    id: 'annotation-simple',
    title: 'Annotation - Simple',
    canvasWidth: 520,
    beforeDraw: ({ ctx }) => {
      ctx.setFont('Arial', 10, 'normal', 'normal');
    },
    draw: ({ ctx, width }) => {
      const noteA = new TabNote({
        positions: [
          { str: 2, fret: 10 },
          { str: 4, fret: 9 },
        ],
        duration: 'h',
      }).addModifier(new Annotation('mf'), 0);

      const noteB = new TabNote({
        positions: [{ str: 2, fret: 10 }],
        duration: 'h',
      }).addModifier(
        new Bend([{ type: Bend.UP, text: 'Full' }]).setTap('T'),
        0
      );

      drawTabVoice(ctx, new TabStave(10, 10, width - 20).addTabGlyph(), [
        noteA,
        noteB,
      ]);
    },
  },
  {
    id: 'annotation-styled',
    title: 'Annotation - Styled',
    canvasWidth: 900,
    draw: ({ ctx, width }) => {
      const notes = [
        addAnnotation(new StaveNote({ keys: ['c/4', 'e/4'], duration: 'h' }), {
          text: 'quiet',
          index: 0,
          fillStyle: '#16a34a',
        }),
        addAnnotation(
          new StaveNote({ keys: ['c/4', 'e/4', 'c/5'], duration: 'h' }),
          {
            text: 'Allegro',
            index: 2,
            fillStyle: '#2563eb',
          }
        ),
      ];
      drawStaveVoice(ctx, new Stave(16, 30, width - 32), notes);
    },
  },
  {
    id: 'annotation-standard',
    title: 'Annotation - Standard Notation Annotation',
    canvasWidth: 900,
    draw: ({ ctx, width }) => {
      const notes = [
        addAnnotation(new StaveNote({ keys: ['c/4', 'e/4'], duration: 'h' }), {
          text: 'quiet',
          index: 0,
        }),
        addAnnotation(
          new StaveNote({ keys: ['c/4', 'e/4', 'c/5'], duration: 'h' }),
          {
            text: 'Allegro',
            index: 2,
          }
        ),
      ];
      drawStaveVoice(ctx, new Stave(16, 30, width - 32), notes);
    },
  },
  {
    id: 'annotation-harmonics',
    title: 'Annotation - Harmonics',
    canvasWidth: 520,
    beforeDraw: ({ ctx }) => {
      ctx.setFont('Arial', 10, 'normal', 'normal');
    },
    draw: ({ ctx, width }) => {
      const noteA = new TabNote({
        positions: [
          { str: 2, fret: 12 },
          { str: 3, fret: 12 },
        ],
        duration: 'h',
      }).addModifier(new Annotation('Harm.'), 0);

      const noteB = new TabNote({
        positions: [{ str: 2, fret: 9 }],
        duration: 'h',
      })
        .addModifier(
          new Annotation('(8va)').setFont('Arial', 12, 'normal', 'italic'),
          0
        )
        .addModifier(new Annotation('A.H.'), 0);

      drawTabVoice(ctx, new TabStave(10, 10, width - 20).addClef('tab'), [
        noteA,
        noteB,
      ]);
    },
  },
  {
    id: 'annotation-fingerpicking',
    title: 'Annotation - Fingerpicking',
    canvasWidth: 520,
    beforeDraw: ({ ctx }) => {
      ctx.setFont('Arial', 12, 'normal', 'normal');
    },
    draw: ({ ctx, width }) => {
      const annotateTop = (note: TabNote, text: string, yShift = 0) =>
        note.addModifier(
          new Annotation(text)
            .setFont('Arial', 12, 'normal', 'italic')
            .setVerticalJustification(AnnotationVerticalJustify.TOP)
            .setJustification(AnnotationHorizontalJustify.CENTER_STEM)
            .setYShift(yShift),
          0
        );

      const notes = [
        new TabNote({
          positions: [
            { str: 1, fret: 0 },
            { str: 2, fret: 1 },
            { str: 3, fret: 2 },
            { str: 4, fret: 2 },
            { str: 5, fret: 0 },
          ],
          duration: 'h',
        }).addModifier(new Vibrato().setVibratoWidth(40), 0),
        annotateTop(
          new TabNote({ positions: [{ str: 6, fret: 9 }], duration: '8' }),
          'p',
          0
        ),
        annotateTop(
          new TabNote({ positions: [{ str: 3, fret: 9 }], duration: '8' }),
          'i'
        ),
        annotateTop(
          new TabNote({ positions: [{ str: 2, fret: 9 }], duration: '8' }),
          'm'
        ),
        annotateTop(
          new TabNote({ positions: [{ str: 1, fret: 9 }], duration: '8' }),
          'a'
        ),
      ];

      drawTabVoice(ctx, new TabStave(10, 10, width - 20).addClef('tab'), notes);
    },
  },
  {
    id: 'annotation-bottom',
    title: 'Annotation - Bottom Annotation',
    canvasWidth: 850,
    draw: ({ ctx, width }) => {
      const mk = (key: string, text: string) =>
        new StaveNote({ keys: [key], duration: 'w' }).addModifier(
          new Annotation(text).setVerticalJustification(
            AnnotationVerticalJustify.BOTTOM
          ),
          0
        );
      drawStaveVoice(ctx, new Stave(16, 30, width - 32), [
        mk('f/4', 'F'),
        mk('a/4', 'A'),
        mk('c/5', 'C'),
        mk('e/5', 'E'),
      ]);
    },
  },
  {
    id: 'annotation-bottom-beam',
    title: 'Annotation - Bottom Annotations with Beams',
    canvasWidth: 850,
    draw: ({ ctx, width }) => {
      const bottomBeamKeys = ['a/3', 'g/3', 'c/4', 'd/4'] as const;
      const notes = ['good', 'even', 'under', 'beam'].map((word, i) =>
        new StaveNote({
          keys: [bottomBeamKeys[i] ?? bottomBeamKeys[0]],
          duration: '8',
        }).addModifier(
          new Annotation(word).setVerticalJustification(
            AnnotationVerticalJustify.BOTTOM
          ),
          0
        )
      );
      const stave = new Stave(16, 30, width - 32).addClef('treble');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
      new Beam(notes.slice(1)).setContext(ctx as any).draw();
    },
  },
  {
    id: 'annotation-justification-up',
    title: 'Annotation - Test Justification Annotation Stem Up',
    canvasWidth: 900,
    canvasHeight: 760,
    draw: ({ ctx, width }) => {
      for (let v = 1; v <= 4; v++) {
        const mk = (keys: string[], duration: string, h: number) =>
          new StaveNote({ keys, duration }).addModifier(
            new Annotation('Text')
              .setFontSize(12)
              .setJustification(h)
              .setVerticalJustification(v as AnnotationVerticalJustify),
            0
          );
        const notes = [
          mk(['c/3'], 'q', 1),
          mk(['c/4'], 'q', 2),
          mk(['c/4', 'e/4', 'c/5'], 'q', 3),
          mk(['c/6'], 'q', 4),
        ];
        drawStaveVoice(
          ctx,
          new Stave(16, (v - 1) * 170 + 30, width - 32),
          notes
        );
      }
    },
  },
  {
    id: 'annotation-justification-down',
    title: 'Annotation - Test Justification Annotation Stem Down',
    canvasWidth: 900,
    canvasHeight: 760,
    draw: ({ ctx, width }) => {
      for (let v = 1; v <= 4; v++) {
        const mk = (keys: string[], duration: string, h: number) =>
          new StaveNote({ keys, duration, stemDirection: -1 }).addModifier(
            new Annotation('Text')
              .setFontSize(12)
              .setJustification(h)
              .setVerticalJustification(v as AnnotationVerticalJustify),
            0
          );
        const notes = [
          mk(['c/3'], 'q', 1),
          mk(['c/4', 'e/4', 'c/5'], 'q', 2),
          mk(['c/5'], 'q', 3),
          mk(['c/6'], 'q', 4),
        ];
        drawStaveVoice(
          ctx,
          new Stave(16, (v - 1) * 170 + 30, width - 32),
          notes
        );
      }
    },
  },
  {
    id: 'annotation-tabnotes',
    title: 'Annotation - TabNote Annotations',
    canvasWidth: 550,
    canvasHeight: 280,
    beforeDraw: ({ ctx }) => {
      const family = 'Arial';
      const size = 54;
      const weight = 'normal';
      const style = 'normal';
      ctx.setFont(family, size, weight, style);
    },
    draw: ({ ctx, width }) => {
      const stave = new TabStave(10, 10, width - 20);
      stave.setContext(ctx);
      stave.drawWithStyle();

      const specs = [
        {
          positions: [
            { str: 3, fret: 6 },
            { str: 4, fret: 25 },
          ],
          duration: '8',
        },
        {
          positions: [
            { str: 2, fret: 10 },
            { str: 5, fret: 12 },
          ],
          duration: '8',
        },
        {
          positions: [
            { str: 1, fret: 6 },
            { str: 3, fret: 5 },
          ],
          duration: '8',
        },
        {
          positions: [
            { str: 1, fret: 6 },
            { str: 3, fret: 5 },
          ],
          duration: '8',
        },
      ];

      const notes1 = specs.map((noteSpec) => {
        const note = new TabNote(noteSpec);
        note.renderOptions.drawStem = true;
        return note;
      });

      const notes2 = specs.map((noteSpec) => {
        const note = new TabNote(noteSpec);
        note.renderOptions.drawStem = true;
        note.setStemDirection(-1);
        return note;
      });

      const notes3 = specs.map((noteSpec) => new TabNote(noteSpec));

      notes1[0]!.addModifier(
        new Annotation('Text').setJustification(1).setVerticalJustification(1)
      ); // U
      notes1[1]!.addModifier(
        new Annotation('Text').setJustification(2).setVerticalJustification(2)
      ); // D
      notes1[2]!.addModifier(
        new Annotation('Text').setJustification(3).setVerticalJustification(3)
      ); // U
      notes1[3]!.addModifier(
        new Annotation('Text').setJustification(4).setVerticalJustification(4)
      ); // D

      notes2[0]!.addModifier(
        new Annotation('Text').setJustification(3).setVerticalJustification(1)
      ); // U
      notes2[1]!.addModifier(
        new Annotation('Text').setJustification(3).setVerticalJustification(2)
      ); // D
      notes2[2]!.addModifier(
        new Annotation('Text').setJustification(3).setVerticalJustification(3)
      ); // U
      notes2[3]!.addModifier(
        new Annotation('Text').setJustification(3).setVerticalJustification(4)
      ); // D

      notes3[0]!.addModifier(
        new Annotation('Text').setVerticalJustification(1)
      ); // U
      notes3[1]!.addModifier(
        new Annotation('Text').setVerticalJustification(2)
      ); // D
      notes3[2]!.addModifier(
        new Annotation('Text').setVerticalJustification(3)
      ); // U
      notes3[3]!.addModifier(
        new Annotation('Text').setVerticalJustification(4)
      ); // D

      const voice = new Voice(VexFlow.TIME4_4).setMode(Voice.Mode.SOFT);

      voice.addTickables(notes1);
      voice.addTickables(notes2);
      voice.addTickables(notes3);
      // Alternatively, you could add all the notes in one big array with spread syntax.
      // voice.addTickables([...notes1, ...notes2, ...notes3]);

      new Formatter()
        .joinVoices([voice])
        .formatToStave([voice], stave, { stave });

      voice.draw(ctx, stave);
    },
  },
];
