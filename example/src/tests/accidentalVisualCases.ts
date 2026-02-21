import {
  Accidental,
  Beam,
  Formatter,
  ModifierContext,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
  TickContext,
  TimeSigNote,
  VexFlow,
  Voice,
} from 'vexflow';

import { type CanvasDrawContext, type VisualCase } from './types';

type DrawNoteSpec = {
  keys: string[];
  duration: string;
  stemDirection?: number;
};

function buildNote(
  spec: DrawNoteSpec,
  accidentals: { type: string; index: number; cautionary?: boolean }[] = []
) {
  const note = new StaveNote({
    keys: spec.keys,
    duration: spec.duration,
    stemDirection: spec.stemDirection,
  });

  accidentals.forEach((item) => {
    const acc = new Accidental(item.type);
    if (item.cautionary) acc.setAsCautionary();
    note.addModifier(acc, item.index);
  });

  return note;
}

function formatAndDrawSingleVoice(
  ctx: CanvasDrawContext,
  width: number,
  notes: StaveNote[],
  options?: { keySignature?: string; x?: number; y?: number }
) {
  const stave = new Stave(
    options?.x ?? 16,
    options?.y ?? 40,
    width - 32
  ).addClef('treble');
  if (options?.keySignature) stave.addKeySignature(options.keySignature);
  stave.setContext(ctx as any).draw();

  const voice = new Voice({ numBeats: 4, beatValue: 4 })
    .setStrict(false)
    .addTickables(notes);
  new Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(ctx as any, stave);
}

function drawAccidentalBoundingBoxes(
  ctx: CanvasDrawContext,
  notes: StaveNote[]
) {
  ctx.save();
  ctx.setStrokeStyle('#ef4444');
  ctx.setLineWidth(1);

  notes.forEach((note) => {
    note.getModifiersByType('Accidental').forEach((modifier) => {
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

function genAccidentals(): string[] {
  const accs = [
    '#',
    '##',
    'b',
    'bb',
    'n',
    '{',
    '}',
    'db',
    'd',
    '++',
    '+',
    '+-',
  ];
  accs.push('bs', 'bss', 'o', 'k', 'bbs', '++-', 'ashs', 'afhf');
  for (let u = 0xe260; u <= 0xe269; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe270; u <= 0xe27b; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe280; u <= 0xe285; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe290; u <= 0xe29c; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe2a0; u <= 0xe2a5; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe2b0; u <= 0xe2b7; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe2c0; u <= 0xe2fb; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe300; u <= 0xe30f; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe310; u <= 0xe335; u++) {
    if (u === 0xe31a || u === 0xe31b || u === 0xe31e || u === 0xe31f) continue;
    accs.push(String.fromCodePoint(u));
  }
  for (let u = 0xe340; u <= 0xe367; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe370; u <= 0xe387; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe390; u <= 0xe3ad; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe3b0; u <= 0xe3ef; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe3f0; u <= 0xe3f3; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe3f4; u <= 0xe3f7; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe420; u <= 0xe435; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe440; u <= 0xe447; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe450; u <= 0xe457; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe460; u <= 0xe461; u++) accs.push(String.fromCodePoint(u));
  for (let u = 0xe470; u <= 0xe48f; u++) accs.push(String.fromCodePoint(u));
  return accs;
}

export const ACCIDENTAL_VISUAL_CASES: VisualCase[] = [
  {
    id: 'accidentals-simple-tests',
    title: 'Accidentals - Simple Tests',
    description: 'Visualized from autoAccidentalWorking() sequences',
    // canvasWidth: 1000,
    canvasHeight: 280,
    draw: ({ ctx, width }) => {
      const make = (keys: string[]) =>
        keys.map((key) => buildNote({ keys: [key], duration: '4' }));

      const notesA = make([
        'bb/4',
        'bb/4',
        'g#/4',
        'g/4',
        'b/4',
        'b/4',
        'a#/4',
        'g#/4',
      ]);
      const notesB = make([
        'e#/4',
        'cb/4',
        'fb/4',
        'b#/4',
        'b#/4',
        'cb/5',
        'fb/5',
        'e#/4',
      ]);
      const notesC = make([
        'c/4',
        'cb/4',
        'cb/4',
        'c#/4',
        'c#/4',
        'cbb/4',
        'cbb/4',
        'c##/4',
        'c##/4',
        'c/4',
        'c/4',
      ]);

      const staveA = new Stave(16, 20, width - 32)
        .addClef('treble')
        .addKeySignature('F');
      staveA.setContext(ctx as any).draw();
      const voiceA = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notesA);
      Accidental.applyAccidentals([voiceA], 'F');
      new Formatter().joinVoices([voiceA]).formatToStave([voiceA], staveA);
      voiceA.draw(ctx as any, staveA);

      const staveB = new Stave(16, 95, width - 32)
        .addClef('treble')
        .addKeySignature('A');
      staveB.setContext(ctx as any).draw();
      const voiceB = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notesB);
      Accidental.applyAccidentals([voiceB], 'A');
      new Formatter().joinVoices([voiceB]).formatToStave([voiceB], staveB);
      voiceB.draw(ctx as any, staveB);

      const staveC = new Stave(16, 170, width - 32)
        .addClef('treble')
        .addKeySignature('C');
      staveC.setContext(ctx as any).draw();
      const voiceC = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notesC);
      Accidental.applyAccidentals([voiceC], 'C');
      new Formatter().joinVoices([voiceC]).formatToStave([voiceC], staveC);
      voiceC.draw(ctx as any, staveC);
    },
  },
  {
    id: 'bounding-box',
    title: 'Bounding Box',
    canvasWidth: 500,
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote({ keys: ['c/4', 'e/4', 'a/4'], duration: '1' }, [
          { type: 'b', index: 0 },
          { type: '#', index: 1 },
        ]),
        buildNote(
          {
            keys: ['e/4', 'f/4', 'a/4', 'c/5', 'e/5', 'g/5', 'd/4'],
            duration: '2',
          },
          [
            { type: '##', index: 6 },
            { type: 'n', index: 0 },
            { type: 'bb', index: 1 },
            { type: 'b', index: 2 },
            { type: '#', index: 3 },
            { type: 'n', index: 4 },
            { type: 'bb', index: 5 },
          ]
        ),
        buildNote(
          {
            keys: ['g/5', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'e/5'],
            duration: '16',
          },
          [
            { type: 'n', index: 1 },
            { type: '#', index: 2 },
            { type: '#', index: 3 },
            { type: 'b', index: 4 },
            { type: 'bb', index: 5 },
            { type: '##', index: 6 },
            { type: '#', index: 0 },
          ]
        ),
        buildNote(
          { keys: ['a/3', 'c/4', 'e/4', 'b/4', 'd/5', 'g/5'], duration: '1' },
          [
            { type: '#', index: 0 },
            { type: '##', index: 1, cautionary: true },
            { type: '#', index: 2, cautionary: true },
            { type: 'b', index: 3 },
            { type: 'bb', index: 4, cautionary: true },
            { type: 'b', index: 5, cautionary: true },
          ]
        ),
      ];
      formatAndDrawSingleVoice(ctx, width, notes);
      drawAccidentalBoundingBoxes(ctx, notes);
    },
  },
  {
    id: 'accidental-padding',
    title: 'Accidental Padding',
    description: 'RN-safe approximation (without dot/beam helper internals)',
    canvasWidth: 700,
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote({ keys: ['e##/5'], duration: '8' }, [
          { type: '##', index: 0 },
        ]),
        buildNote({ keys: ['Bb/4', 'Bn/4'], duration: '16' }, [
          { type: 'b', index: 0 },
          { type: 'n', index: 0 },
        ]),
        buildNote({ keys: ['f/3'], duration: '8' }),
        buildNote({ keys: ['a/3'], duration: '16' }),
        buildNote({ keys: ['e/4', 'g/4'], duration: '16' }, [
          { type: 'bb', index: 0 },
          { type: 'bb', index: 1 },
        ]),
        buildNote({ keys: ['d/4'], duration: '16' }),
        buildNote({ keys: ['e/4', 'g/4'], duration: '16' }, [
          { type: '#', index: 0 },
          { type: '#', index: 1 },
        ]),
        buildNote({ keys: ['g/4'], duration: '32' }),
        buildNote({ keys: ['a/4'], duration: '32' }),
        buildNote({ keys: ['g/4'], duration: '16' }),
        buildNote({ keys: ['Db/4', 'Dn/4'], duration: 'q' }, [
          { type: 'b', index: 0 },
          { type: 'n', index: 0 },
        ]),
      ];

      const stave = new Stave(16, 40, width - 32).addClef('treble');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      new Formatter({ softmaxFactor: 100 })
        .joinVoices([voice])
        .formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'basic',
    title: 'Basic',
    canvasWidth: 400,
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote({ keys: ['c/4', 'e/4', 'a/4'], duration: '1' }, [
          { type: 'b', index: 0 },
          { type: '#', index: 1 },
        ]),
        buildNote(
          {
            keys: ['e/4', 'f/4', 'a/4', 'c/5', 'e/5', 'g/5', 'd/4'],
            duration: '2',
          },
          [
            { type: '##', index: 6 },
            { type: 'n', index: 0 },
            { type: 'bb', index: 1 },
            { type: 'b', index: 2 },
            { type: '#', index: 3 },
            { type: 'n', index: 4 },
            { type: 'bb', index: 5 },
          ]
        ),
        buildNote(
          {
            keys: ['g/5', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'e/5'],
            duration: '16',
          },
          [
            { type: 'n', index: 1 },
            { type: '#', index: 2 },
            { type: '#', index: 3 },
            { type: 'b', index: 4 },
            { type: 'bb', index: 5 },
            { type: '##', index: 6 },
            { type: '#', index: 0 },
          ]
        ),
        buildNote(
          { keys: ['a/3', 'c/4', 'e/4', 'b/4', 'd/5', 'g/5'], duration: '1' },
          [
            { type: '#', index: 0 },
            { type: '##', index: 1, cautionary: true },
            { type: '#', index: 2, cautionary: true },
            { type: 'b', index: 3 },
            { type: 'bb', index: 4, cautionary: true },
            { type: 'b', index: 5, cautionary: true },
          ]
        ),
      ];
      formatAndDrawSingleVoice(ctx, width, notes);
    },
  },
  {
    id: 'stem-down',
    title: 'Stem Down',
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote(
          { keys: ['c/4', 'e/4', 'a/4'], duration: 'w', stemDirection: -1 },
          [
            { type: 'b', index: 0 },
            { type: '#', index: 1 },
          ]
        ),
        buildNote(
          {
            keys: ['d/4', 'e/4', 'f/4', 'a/4', 'c/5', 'e/5', 'g/5'],
            duration: '2',
            stemDirection: -1,
          },
          [
            { type: '##', index: 0 },
            { type: 'n', index: 1 },
            { type: 'bb', index: 2 },
            { type: 'b', index: 3 },
            { type: '#', index: 4 },
            { type: 'n', index: 5 },
            { type: 'bb', index: 6 },
          ]
        ),
        buildNote(
          {
            keys: ['f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'e/5', 'g/5'],
            duration: '16',
            stemDirection: -1,
          },
          [
            { type: 'n', index: 0 },
            { type: '#', index: 1 },
            { type: '#', index: 2 },
            { type: 'b', index: 3 },
            { type: 'bb', index: 4 },
            { type: '##', index: 5 },
            { type: '#', index: 6 },
          ]
        ),
      ];
      formatAndDrawSingleVoice(ctx, width, notes);
    },
  },
  {
    id: 'cautionary-accidental',
    title: 'Cautionary Accidental',
    canvasWidth: 1200,
    canvasHeight: 900,
    draw: ({ ctx, width }) => {
      const accids = genAccidentals().filter(
        (item) => item !== '{' && item !== '}'
      );
      const staveCount = 12;
      const notesPerStave = 22;
      const rowHeight = 70;

      for (let row = 0; row < staveCount; row++) {
        const y = 20 + row * rowHeight;
        const stave = new Stave(16, y, width - 32).addClef('treble');
        stave.setContext(ctx as any).draw();

        const rowAccids = accids.slice(
          row * notesPerStave,
          (row + 1) * notesPerStave
        );
        if (!rowAccids.length) continue;

        const notes = rowAccids.map((accid) =>
          buildNote({ keys: ['a/4'], duration: '4', stemDirection: Stem.UP }, [
            { type: accid, index: 0, cautionary: true },
          ])
        );
        const voice = new Voice({ numBeats: 4, beatValue: 4 })
          .setStrict(false)
          .addTickables(notes);
        new Formatter().joinVoices([voice]).formatToStave([voice], stave);
        voice.draw(ctx as any, stave);
      }
    },
  },
  {
    id: 'special-cases',
    title: 'Accidental Arrangement Special Cases',
    canvasWidth: 500,
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote({ keys: ['f/4', 'd/5'], duration: '1' }, [
          { type: '#', index: 0 },
          { type: 'b', index: 1 },
        ]),
        buildNote({ keys: ['c/4', 'g/4'], duration: '2' }, [
          { type: '##', index: 0 },
          { type: '##', index: 1 },
        ]),
        buildNote({ keys: ['b/3', 'd/4', 'f/4'], duration: '16' }, [
          { type: '#', index: 0 },
          { type: '#', index: 1 },
          { type: '##', index: 2 },
        ]),
        buildNote({ keys: ['g/4', 'a/4', 'c/5', 'e/5'], duration: '16' }, [
          { type: 'b', index: 0 },
          { type: 'b', index: 1 },
          { type: 'n', index: 3 },
        ]),
        buildNote({ keys: ['e/4', 'g/4', 'b/4', 'c/5'], duration: '4' }, [
          { type: 'b', index: 0, cautionary: true },
          { type: 'b', index: 1, cautionary: true },
          { type: 'bb', index: 2 },
          { type: 'b', index: 3 },
        ]),
        buildNote(
          { keys: ['b/3', 'e/4', 'a/4', 'd/5', 'g/5'], duration: '8' },
          [
            { type: 'bb', index: 0 },
            { type: 'b', index: 1, cautionary: true },
            { type: 'n', index: 2, cautionary: true },
            { type: '#', index: 3 },
            { type: 'n', index: 4, cautionary: true },
          ]
        ),
      ];
      formatAndDrawSingleVoice(ctx, width, notes);
    },
  },
  {
    id: 'multi-voice',
    title: 'Multi Voice',
    canvasWidth: 500,
    canvasHeight: 240,
    draw: ({ ctx, width }) => {
      const stave = new Stave(16, 50, width - 32).addClef('treble');
      stave.setContext(ctx as any).draw();

      const drawPair = (note1: StaveNote, note2: StaveNote, x: number) => {
        const modifierContext = new ModifierContext();
        note1.addToModifierContext(modifierContext);
        note2.addToModifierContext(modifierContext);
        new TickContext()
          .addTickable(note1)
          .addTickable(note2)
          .preFormat()
          .setX(x);
        note1
          .setStave(stave)
          .setContext(ctx as any)
          .draw();
        note2
          .setStave(stave)
          .setContext(ctx as any)
          .draw();
      };

      drawPair(
        buildNote(
          { keys: ['c/4', 'e/4', 'a/4'], duration: '2', stemDirection: -1 },
          [
            { type: 'b', index: 0 },
            { type: 'n', index: 1 },
            { type: '#', index: 2 },
          ]
        ),
        buildNote(
          { keys: ['d/5', 'a/5', 'b/5'], duration: '2', stemDirection: 1 },
          [
            { type: 'b', index: 0 },
            { type: 'bb', index: 1 },
            { type: '##', index: 2 },
          ]
        ),
        120
      );

      drawPair(
        buildNote(
          { keys: ['c/4', 'e/4', 'c/5'], duration: '2', stemDirection: -1 },
          [
            { type: 'b', index: 0 },
            { type: 'n', index: 1 },
            { type: '#', index: 2 },
          ]
        ),
        buildNote(
          { keys: ['d/5', 'a/5', 'b/5'], duration: '4', stemDirection: 1 },
          [{ type: 'b', index: 0 }]
        ),
        300
      );

      drawPair(
        buildNote(
          { keys: ['d/4', 'c/5', 'd/5'], duration: '2', stemDirection: -1 },
          [
            { type: 'b', index: 0 },
            { type: 'n', index: 1 },
            { type: '#', index: 2 },
          ]
        ),
        buildNote(
          { keys: ['d/5', 'a/5', 'b/5'], duration: '4', stemDirection: 1 },
          [{ type: 'b', index: 0 }]
        ),
        500
      );
    },
  },
  {
    id: 'microtonal',
    title: 'Microtonal',
    canvasWidth: 900,
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote({ keys: ['c/4', 'e/4', 'a/4'], duration: '1' }, [
          { type: 'db', index: 0 },
          { type: 'd', index: 1 },
        ]),
        buildNote(
          {
            keys: ['d/4', 'e/4', 'f/4', 'a/4', 'c/5', 'e/5', 'g/5'],
            duration: '2',
          },
          [
            { type: 'bbs', index: 0 },
            { type: '++', index: 1 },
            { type: '+', index: 2 },
            { type: 'd', index: 3 },
            { type: 'db', index: 4 },
            { type: '+', index: 5 },
            { type: '##', index: 6 },
          ]
        ),
        buildNote(
          {
            keys: ['f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'e/5', 'g/5'],
            duration: '16',
          },
          [
            { type: '++', index: 0 },
            { type: 'bbs', index: 1 },
            { type: '+', index: 2 },
            { type: 'b', index: 3 },
            { type: 'db', index: 4 },
            { type: '##', index: 5 },
            { type: '#', index: 6 },
          ]
        ),
        buildNote(
          { keys: ['a/3', 'c/4', 'e/4', 'b/4', 'd/5', 'g/5'], duration: '1' },
          [
            { type: '#', index: 0 },
            { type: 'db', index: 1, cautionary: true },
            { type: 'bbs', index: 2, cautionary: true },
            { type: 'b', index: 3 },
            { type: '++', index: 4, cautionary: true },
            { type: 'd', index: 5, cautionary: true },
          ]
        ),
        buildNote(
          { keys: ['f/4', 'g/4', 'a/4', 'b/4', 'd/5', 'g/5'], duration: '16' },
          [
            { type: '++-', index: 0 },
            { type: '+-', index: 1 },
            { type: 'bs', index: 2 },
            { type: 'bss', index: 3 },
            { type: 'afhf', index: 4 },
            { type: 'ashs', index: 5 },
          ]
        ),
      ];
      formatAndDrawSingleVoice(ctx, width, notes);
    },
  },
  {
    id: 'microtonal-iranian',
    title: 'Microtonal (Iranian)',
    canvasWidth: 900,
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote({ keys: ['c/4', 'e/4', 'a/4'], duration: '1' }, [
          { type: 'k', index: 0 },
          { type: 'o', index: 1 },
        ]),
        buildNote(
          {
            keys: ['d/4', 'e/4', 'f/4', 'a/4', 'c/5', 'e/5', 'g/5'],
            duration: '2',
          },
          [
            { type: 'b', index: 0 },
            { type: 'k', index: 1 },
            { type: 'n', index: 2 },
            { type: 'o', index: 3 },
            { type: '#', index: 4 },
            { type: 'bb', index: 5 },
            { type: '##', index: 6 },
          ]
        ),
        buildNote(
          {
            keys: ['f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'e/5', 'g/5'],
            duration: '16',
          },
          [
            { type: 'o', index: 0 },
            { type: 'k', index: 1 },
            { type: 'n', index: 2 },
            { type: 'b', index: 3 },
            { type: 'bb', index: 4 },
            { type: '##', index: 5 },
            { type: '#', index: 6 },
          ]
        ),
        buildNote(
          { keys: ['a/3', 'c/4', 'e/4', 'b/4', 'd/5', 'g/5'], duration: '1' },
          [
            { type: '#', index: 0 },
            { type: 'o', index: 1, cautionary: true },
            { type: 'n', index: 2, cautionary: true },
            { type: 'b', index: 3 },
            { type: 'k', index: 4, cautionary: true },
          ]
        ),
        buildNote({ keys: ['f/4', 'g/4', 'a/4', 'b/4'], duration: '16' }, [
          { type: 'k', index: 0 },
          { type: 'k', index: 1 },
          { type: 'k', index: 2 },
          { type: 'k', index: 3 },
        ]),
      ];
      formatAndDrawSingleVoice(ctx, width, notes);
    },
  },
  {
    id: 'sagittal',
    title: 'Sagittal',
    canvasWidth: 1000,
    draw: ({ ctx, width }) => {
      const {
        accSagittal11LargeDiesisDown,
        accSagittal11MediumDiesisUp,
        accSagittal35LargeDiesisDown,
        accSagittal5CommaDown,
        accSagittal7CommaDown,
        accSagittalFlat7CDown,
      } = VexFlow.Glyphs as any;

      const notes = [
        buildNote({ keys: ['d/4', 'f/4', 'b/4', 'b/4'], duration: '4' }, [
          { type: accSagittal11MediumDiesisUp, index: 1 },
          { type: accSagittal5CommaDown, index: 2 },
          { type: 'b', index: 3 },
          { type: accSagittal7CommaDown, index: 3 },
        ]),
        buildNote({ keys: ['d/4', 'f/4', 'a/4', 'b/4'], duration: '4' }, [
          { type: accSagittal35LargeDiesisDown, index: 2 },
        ]),
        buildNote({ keys: ['c/4', 'e/4', 'g/4', 'c/5'], duration: '8' }, [
          { type: accSagittal5CommaDown, index: 1 },
        ]),
        buildNote({ keys: ['c/4', 'e/4', 'g/4', 'b/4'], duration: '8' }, [
          { type: 'b', index: 1 },
          { type: accSagittal7CommaDown, index: 1 },
          { type: accSagittal11LargeDiesisDown, index: 3 },
        ]),
        buildNote({ keys: ['d/4', 'f/4', 'b/4', 'b/4'], duration: '4' }, [
          { type: accSagittal11MediumDiesisUp, index: 1 },
          { type: accSagittal5CommaDown, index: 2 },
          { type: accSagittalFlat7CDown, index: 3 },
        ]),
        buildNote({ keys: ['d/4', 'f/4', 'a/4', 'b/4'], duration: '4' }, [
          { type: accSagittal35LargeDiesisDown, index: 2 },
        ]),
        buildNote({ keys: ['c/4', 'e/4', 'g/4', 'c/5'], duration: '8' }, [
          { type: accSagittal5CommaDown, index: 1 },
        ]),
        buildNote({ keys: ['c/4', 'e/4', 'g/4', 'b/4'], duration: '8' }, [
          { type: accSagittalFlat7CDown, index: 1 },
          { type: accSagittal11LargeDiesisDown, index: 3 },
        ]),
      ];

      const stave = new Stave(16, 40, width - 32).addClef('treble');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);

      new Beam(notes.slice(2, 4)).setContext(ctx as any).draw();
      new Beam(notes.slice(6, 8)).setContext(ctx as any).draw();

      new StaveTie({
        firstNote: notes[0],
        lastNote: notes[1],
        firstIndexes: [0, 1],
        lastIndexes: [0, 1],
      })
        .setContext(ctx as any)
        .draw();
      new StaveTie({
        firstNote: notes[0],
        lastNote: notes[1],
        firstIndexes: [3],
        lastIndexes: [3],
      })
        .setDirection(Stem.DOWN)
        .setContext(ctx as any)
        .draw();
      new StaveTie({
        firstNote: notes[4],
        lastNote: notes[5],
        firstIndexes: [0, 1],
        lastIndexes: [0, 1],
      })
        .setContext(ctx as any)
        .draw();
      new StaveTie({
        firstNote: notes[4],
        lastNote: notes[5],
        firstIndexes: [3],
        lastIndexes: [3],
      })
        .setDirection(Stem.DOWN)
        .setContext(ctx as any)
        .draw();
    },
  },
  {
    id: 'accidentals-0',
    title: 'Accidentals',
    canvasWidth: 1100,
    draw: ({ ctx, width }) => {
      const stave = new Stave(16, 40, width - 32).addClef('treble');
      stave.setContext(ctx as any).draw();

      const notes = [
        buildNote({ keys: ['c/4', 'c/5'], duration: '4' }),
        buildNote({ keys: ['c#/4', 'c#/5'], duration: '4' }),
        buildNote({ keys: ['c#/4', 'c#/5'], duration: '4' }),
        buildNote({ keys: ['c##/4', 'c##/5'], duration: '4' }),
        buildNote({ keys: ['c##/4', 'c##/5'], duration: '4' }),
        buildNote({ keys: ['c/4', 'c/5'], duration: '4' }),
        buildNote({ keys: ['cn/4', 'cn/5'], duration: '4' }),
        buildNote({ keys: ['cbb/4', 'cbb/5'], duration: '4' }),
        buildNote({ keys: ['cbb/4', 'cbb/5'], duration: '4' }),
        buildNote({ keys: ['cb/4', 'cb/5'], duration: '4' }),
        buildNote({ keys: ['cb/4', 'cb/5'], duration: '4' }),
        buildNote({ keys: ['c/4', 'c/5'], duration: '4' }),
      ];

      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickable(new TimeSigNote('12/4').setStave(stave))
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'C');
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-c-major-in-ab',
    title: 'Accidentals - C major scale in Ab',
    canvasWidth: 850,
    draw: ({ ctx, width }) => {
      const notes = [
        'c/4',
        'd/4',
        'e/4',
        'f/4',
        'g/4',
        'a/4',
        'b/4',
        'c/5',
      ].map((pitch) => buildNote({ keys: [pitch], duration: '4' }));
      formatAndDrawSingleVoice(ctx, width, notes, { keySignature: 'Ab' });
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'Ab');
    },
  },
  {
    id: 'accidentals-no-accidentals',
    title: 'Accidentals - No Accidentals Necessary',
    canvasWidth: 850,
    draw: ({ ctx, width }) => {
      const notes = [
        'a/4',
        'b/4',
        'c#/5',
        'd/5',
        'e/5',
        'f#/5',
        'g#/5',
        'a/5',
      ].map((pitch) => buildNote({ keys: [pitch], duration: '4' }));
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('A');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'A');
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-no-accidentals-easyscore',
    title: 'Accidentals - No Accidentals Necessary (EasyScore)',
    canvasWidth: 850,
    draw: ({ ctx, width }) => {
      const notes = [
        'a/4',
        'b/4',
        'c#/5',
        'd/5',
        'e/5',
        'f#/5',
        'g#/5',
        'a/5',
      ].map((pitch) =>
        buildNote({ keys: [pitch], duration: '4', stemDirection: Stem.UP })
      );
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('A');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'A');
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-multivoice-inline',
    title: 'Accidentals - Multi Voice Inline',
    canvasWidth: 900,
    draw: ({ ctx, width }) => {
      const notes0 = [
        'c/4',
        'd/4',
        'e/4',
        'f/4',
        'g/4',
        'a/4',
        'b/4',
        'c/5',
      ].map((pitch) =>
        buildNote({ keys: [pitch], duration: '4', stemDirection: -1 })
      );
      const notes1 = [
        'c/5',
        'd/5',
        'e/5',
        'f/5',
        'g/5',
        'a/5',
        'b/5',
        'c/6',
      ].map((pitch) => buildNote({ keys: [pitch], duration: '4' }));
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('Ab');
      stave.setContext(ctx as any).draw();
      const voice0 = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes0);
      const voice1 = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes1);
      Accidental.applyAccidentals([voice0, voice1], 'Ab');
      new Formatter()
        .joinVoices([voice0, voice1])
        .formatToStave([voice0, voice1], stave);
      voice0.draw(ctx as any, stave);
      voice1.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-multivoice-offset',
    title: 'Accidentals - Multi Voice Offset',
    canvasWidth: 1000,
    draw: ({ ctx, width }) => {
      const notes0 = [
        'c/4',
        'd/4',
        'e/4',
        'f/4',
        'g/4',
        'a/4',
        'b/4',
        'c/5',
      ].map((pitch) =>
        buildNote({ keys: [pitch], duration: '4', stemDirection: -1 })
      );
      const notes1 = [
        'c/5',
        'c/5',
        'd/5',
        'e/5',
        'f/5',
        'g/5',
        'a/5',
        'b/5',
        'c/6',
      ].map((pitch, index) =>
        buildNote({ keys: [pitch], duration: index === 0 ? '8' : '4' })
      );
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('Cb');
      stave.setContext(ctx as any).draw();
      const voice0 = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes0);
      const voice1 = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes1);
      Accidental.applyAccidentals([voice0, voice1], 'Cb');
      new Formatter()
        .joinVoices([voice0, voice1])
        .formatToStave([voice0, voice1], stave);
      voice0.draw(ctx as any, stave);
      voice1.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-key-c-single-octave',
    title: 'Accidentals - Key C, Single Octave',
    canvasWidth: 1000,
    draw: ({ ctx, width }) => {
      const notes = [
        'c/4',
        'c#/4',
        'c#/4',
        'c/4',
        'c/4',
        'cb/4',
        'cb/4',
        'c/4',
        'c/4',
      ].map((pitch) =>
        buildNote({ keys: [pitch], duration: '4', stemDirection: -1 })
      );
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('C');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'C');
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-key-c-two-octaves',
    title: 'Accidentals - Key C, Two Octaves',
    canvasWidth: 1500,
    draw: ({ ctx, width }) => {
      const notes = [
        'c/4',
        'c/5',
        'c#/4',
        'c#/5',
        'c#/4',
        'c#/5',
        'c/4',
        'c/5',
        'c/4',
        'c/5',
        'cb/4',
        'cb/5',
        'cb/4',
        'cb/5',
        'c/4',
        'c/5',
        'c/4',
        'c/5',
      ].map((pitch) =>
        buildNote({ keys: [pitch], duration: '4', stemDirection: -1 })
      );
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('C');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'C');
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-key-csharp-single-octave',
    title: 'Accidentals - Key C#, Single Octave',
    canvasWidth: 1000,
    draw: ({ ctx, width }) => {
      const notes = [
        'c/4',
        'c#/4',
        'c#/4',
        'c/4',
        'c/4',
        'cb/4',
        'cb/4',
        'c/4',
        'c/4',
      ].map((pitch) =>
        buildNote({ keys: [pitch], duration: '4', stemDirection: -1 })
      );
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('C#');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'C#');
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'accidentals-key-csharp-two-octaves',
    title: 'Accidentals - Key C#, Two Octaves',
    canvasWidth: 1500,
    draw: ({ ctx, width }) => {
      const notes = [
        'c/4',
        'c/5',
        'c#/4',
        'c#/5',
        'c#/4',
        'c#/5',
        'c/4',
        'c/5',
        'c/4',
        'c/5',
        'cb/4',
        'cb/5',
        'cb/4',
        'cb/5',
        'c/4',
        'c/5',
        'c/4',
        'c/5',
      ].map((pitch) =>
        buildNote({ keys: [pitch], duration: '4', stemDirection: -1 })
      );
      const stave = new Stave(16, 40, width - 32)
        .addClef('treble')
        .addKeySignature('C#');
      stave.setContext(ctx as any).draw();
      const voice = new Voice({ numBeats: 4, beatValue: 4 })
        .setStrict(false)
        .addTickables(notes);
      Accidental.applyAccidentals([voice], 'C#');
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(ctx as any, stave);
    },
  },
  {
    id: 'factory-api',
    title: 'Factory API',
    canvasWidth: 900,
    draw: ({ ctx, width }) => {
      const notes = [
        buildNote({ keys: ['c/4', 'e/4', 'a/4'], duration: 'w' }, [
          { type: 'b', index: 0 },
          { type: '#', index: 1 },
        ]),
        buildNote(
          {
            keys: ['d/4', 'e/4', 'f/4', 'a/4', 'c/5', 'e/5', 'g/5'],
            duration: 'h',
          },
          [
            { type: '##', index: 0 },
            { type: 'n', index: 1 },
            { type: 'bb', index: 2 },
            { type: 'b', index: 3 },
            { type: '#', index: 4 },
            { type: 'n', index: 5 },
            { type: 'bb', index: 6 },
          ]
        ),
        buildNote(
          {
            keys: ['f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'e/5', 'g/5'],
            duration: '16',
          },
          [
            { type: 'n', index: 0 },
            { type: '#', index: 1 },
            { type: '#', index: 2 },
            { type: 'b', index: 3 },
            { type: 'bb', index: 4 },
            { type: '##', index: 5 },
            { type: '#', index: 6 },
          ]
        ),
        buildNote(
          { keys: ['a/3', 'c/4', 'e/4', 'b/4', 'd/5', 'g/5'], duration: 'w' },
          [
            { type: '#', index: 0 },
            { type: '##', index: 1, cautionary: true },
            { type: '#', index: 2, cautionary: true },
            { type: 'b', index: 3 },
            { type: 'bb', index: 4, cautionary: true },
            { type: 'b', index: 5, cautionary: true },
          ]
        ),
      ];
      formatAndDrawSingleVoice(ctx, width, notes);
    },
  },
];
