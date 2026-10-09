import { afterEach, describe, expect, it, jest } from '@jest/globals';

import type * as SkiaMock from '../../__tests__/skiaMock';

type MockCanvas = {
  clear: ReturnType<typeof jest.fn>;
  clipRect: ReturnType<typeof jest.fn>;
  drawPath: ReturnType<typeof jest.fn>;
  drawRect: ReturnType<typeof jest.fn>;
  drawText: ReturnType<typeof jest.fn>;
  restore: ReturnType<typeof jest.fn>;
  save: ReturnType<typeof jest.fn>;
  scale: ReturnType<typeof jest.fn>;
  translate: ReturnType<typeof jest.fn>;
};

function createCanvas(): MockCanvas {
  return {
    clear: jest.fn(),
    clipRect: jest.fn(),
    drawPath: jest.fn(),
    drawRect: jest.fn(),
    drawText: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
  };
}

const returned = <T>(fn: jest.Mock<() => T>) =>
  fn.mock.results.map((result) => result.value as T);

function loadReplayModule() {
  jest.resetModules();

  const createSkFont = jest.fn((...args: unknown[]) => ({
    kind: 'font',
    args,
  }));
  const FontManagerMock = jest.fn().mockImplementation(() => ({
    createSkFont,
  }));

  jest.doMock('../FontManager', () => ({
    __esModule: true,
    default: FontManagerMock,
  }));

  const skia = require('react-native-skia') as typeof SkiaMock;
  const renderVexflowRecordingCommands: (
    canvas: MockCanvas,
    commands: any[],
    fontProvider: unknown,
    defaultFont: string,
    styleOverrides?: Record<string, Record<string, unknown>>,
    replayFontManager?: unknown
  ) => void =
    require('../VexflowRecordingReplay').renderVexflowRecordingCommands;

  return {
    BlendMode: skia.BlendMode,
    ClipOp: skia.ClipOp,
    createSkFont,
    FontManagerMock,
    SkiaColor: skia.Skia.Color,
    MakeDash: skia.Skia.PathEffect.MakeDash,
    MakeDropShadow: skia.Skia.ImageFilter.MakeDropShadow,
    PaintStyle: skia.PaintStyle,
    get paints() {
      return returned(skia.Skia.Paint);
    },
    get pathBuilders() {
      return returned(skia.Skia.PathBuilder.Make);
    },
    renderVexflowRecordingCommands,
    StrokeCap: skia.StrokeCap,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.resetModules();
});

describe('renderVexflowRecordingCommands', () => {
  it('replays recording commands onto a real Skia canvas', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();
    const commands = [
      { type: 'clear', color: 'transparent' },
      { type: 'save' },
      { type: 'scale', x: 2, y: 3 },
      { type: 'translate', x: 4, y: 5 },
      {
        type: 'clipRect',
        rect: { x: 1, y: 2, width: 3, height: 4 },
      },
      {
        type: 'fillRect',
        rect: { x: 5, y: 6, width: 7, height: 8 },
        paint: { color: '#FF0000' },
      },
      {
        type: 'clearRect',
        rect: { x: 9, y: 10, width: 11, height: 12 },
      },
      {
        type: 'fillPath',
        path: [
          { type: 'moveTo', x: 1, y: 2 },
          { type: 'lineTo', x: 3, y: 4 },
          {
            type: 'cubicTo',
            cp1x: 5,
            cp1y: 6,
            cp2x: 7,
            cp2y: 8,
            x: 9,
            y: 10,
          },
          { type: 'quadTo', cpx: 11, cpy: 12, x: 13, y: 14 },
          {
            type: 'addRect',
            rect: { x: 15, y: 16, width: 17, height: 18 },
          },
          {
            type: 'addArc',
            rect: { x: 19, y: 20, width: 21, height: 22 },
            startDegrees: 90,
            sweepDegrees: 180,
          },
          { type: 'close' },
        ],
        paint: { color: '#00FF00' },
      },
      {
        type: 'strokePath',
        path: [{ type: 'moveTo', x: 30, y: 31 }],
        paint: { color: '#123456', strokeCap: 'round', strokeWidth: 3 },
      },
      {
        type: 'fillText',
        text: 'abc',
        x: 32,
        y: 33,
        paint: { color: '#0000FF' },
        font: { font: 'Academico', size: 12, weight: 700, style: 'italic' },
      },
      { type: 'restore' },
    ];

    module.renderVexflowRecordingCommands(canvas, commands, {}, 'Bravura');

    expect(canvas.clear).toHaveBeenCalledWith('color:transparent');
    expect(canvas.save).toHaveBeenCalledTimes(1);
    expect(canvas.scale).toHaveBeenCalledWith(2, 3);
    expect(canvas.translate).toHaveBeenCalledWith(4, 5);
    expect(canvas.clipRect).toHaveBeenCalledWith(
      { x: 1, y: 2, width: 3, height: 4 },
      module.ClipOp.Intersect,
      true
    );
    expect(canvas.drawRect).toHaveBeenNthCalledWith(
      1,
      { x: 5, y: 6, width: 7, height: 8 },
      module.paints[0]
    );
    expect(module.paints[0]!.setStyle).toHaveBeenCalledWith(
      module.PaintStyle.Fill
    );
    expect(module.paints[0]!.setColor).toHaveBeenCalledWith('color:#FF0000');
    expect(canvas.drawRect).toHaveBeenNthCalledWith(
      2,
      { x: 9, y: 10, width: 11, height: 12 },
      module.paints[2]
    );
    expect(module.paints[2]!.setBlendMode).toHaveBeenCalledWith(
      module.BlendMode.Clear
    );

    // One pooled builder serves every path command of the replay.
    expect(module.pathBuilders).toHaveLength(1);
    const fillPathBuilder = module.pathBuilders[0]!;
    expect(fillPathBuilder.moveTo).toHaveBeenCalledWith(1, 2);
    expect(fillPathBuilder.lineTo).toHaveBeenCalledWith(3, 4);
    expect(fillPathBuilder.cubicTo).toHaveBeenCalledWith(5, 6, 7, 8, 9, 10);
    expect(fillPathBuilder.quadTo).toHaveBeenCalledWith(11, 12, 13, 14);
    expect(fillPathBuilder.addRect).toHaveBeenCalledWith({
      x: 15,
      y: 16,
      width: 17,
      height: 18,
    });
    expect(fillPathBuilder.addArc).toHaveBeenCalledWith(
      { x: 19, y: 20, width: 21, height: 22 },
      90,
      180
    );
    expect(fillPathBuilder.close).toHaveBeenCalledTimes(1);
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      1,
      fillPathBuilder.detach.mock.results[0]?.value,
      module.paints[0]
    );

    expect(fillPathBuilder.moveTo).toHaveBeenLastCalledWith(30, 31);
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      2,
      fillPathBuilder.detach.mock.results[1]?.value,
      module.paints[1]
    );
    expect(module.paints[1]!.setStyle).toHaveBeenCalledWith(
      module.PaintStyle.Stroke
    );
    expect(module.paints[1]!.setStrokeCap).toHaveBeenCalledWith(
      module.StrokeCap.Round
    );
    expect(module.paints[1]!.setStrokeWidth).toHaveBeenCalledWith(3);
    expect(canvas.drawText).toHaveBeenCalledWith(
      'abc',
      32,
      33,
      module.paints[0],
      {
        kind: 'font',
        args: ['Academico', 12, 700, 'italic'],
      }
    );
    expect(module.createSkFont).toHaveBeenCalledWith(
      'Academico',
      12,
      700,
      'italic'
    );
    expect(canvas.restore).toHaveBeenCalledTimes(1);

    // Faithful replay (no overrides, no recorded shadow/dash): pooled paints
    // only ever reset the optional state, never set a real glow or dash.
    for (const paint of module.paints) {
      for (const call of paint.setImageFilter.mock.calls) {
        expect(call[0]).toBeNull();
      }
      for (const call of paint.setPathEffect.mock.calls) {
        expect(call[0]).toBeNull();
      }
    }
    expect(module.MakeDropShadow).not.toHaveBeenCalled();
    expect(module.MakeDash).not.toHaveBeenCalled();
  });

  it('replays a recorded glow as a centred drop-shadow image filter (sigma = blur / 2)', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'fillPath',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000', shadowColor: '#00FF00', shadowBlur: 8 },
        },
      ],
      {},
      'Bravura'
    );

    // blur 8 -> sigma 4, centred (dx = dy = 0), tinted with the recorded colour.
    expect(module.MakeDropShadow).toHaveBeenCalledWith(
      0,
      0,
      4,
      4,
      'color:#00FF00'
    );
    expect(module.paints[0]!.setImageFilter).toHaveBeenCalledWith(
      module.MakeDropShadow.mock.results[0]?.value
    );
  });

  it('replays a recorded line dash as a stroke-only dash path effect', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'strokePath',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000', strokeWidth: 2, lineDash: [4, 2] },
        },
      ],
      {},
      'Bravura'
    );

    expect(module.MakeDash).toHaveBeenCalledWith([4, 2]);
    // paints[1] is the pooled stroke paint; dash is stroke-only.
    expect(module.paints[1]!.setPathEffect).toHaveBeenCalledWith(
      module.MakeDash.mock.results[0]?.value
    );
  });

  it('applies separate fill and stroke colour overrides to a tagged group', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'fillPath',
          groupId: 'note-1',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000' },
        },
        {
          type: 'strokePath',
          groupId: 'note-1',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000', strokeWidth: 2 },
        },
      ],
      {},
      'Bravura',
      { 'note-1': { fillColor: '#00FF00', strokeColor: '#FF0000' } }
    );

    // Fill paint -> fillColor; stroke paint -> strokeColor.
    expect(module.paints[0]!.setColor).toHaveBeenCalledWith('color:#00FF00');
    expect(module.paints[1]!.setColor).toHaveBeenCalledWith('color:#FF0000');
  });

  it('uses the shorthand `color` for both fill and stroke when the specific field is absent', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'fillPath',
          groupId: 'note-1',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000' },
        },
        {
          type: 'strokePath',
          groupId: 'note-1',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000', strokeWidth: 2 },
        },
      ],
      {},
      'Bravura',
      { 'note-1': { color: '#3366FF' } }
    );

    expect(module.paints[0]!.setColor).toHaveBeenCalledWith('color:#3366FF');
    expect(module.paints[1]!.setColor).toHaveBeenCalledWith('color:#3366FF');
  });

  it('applies an override glow to both the fill and the stroke of a tagged note', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'fillPath',
          groupId: 'note-1',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000' },
        },
        {
          type: 'strokePath',
          groupId: 'note-1',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000', strokeWidth: 2 },
        },
      ],
      {},
      'Bravura',
      { 'note-1': { shadowColor: '#FFAA00', shadowBlur: 6 } }
    );

    // Both paints glow; blur 6 -> sigma 3. Same glow, so one shared filter.
    expect(module.MakeDropShadow).toHaveBeenCalledTimes(1);
    expect(module.MakeDropShadow).toHaveBeenCalledWith(
      0,
      0,
      3,
      3,
      'color:#FFAA00'
    );
    const glow = module.MakeDropShadow.mock.results[0]?.value;
    expect(module.paints[0]!.setImageFilter).toHaveBeenCalledWith(glow);
    expect(module.paints[1]!.setImageFilter).toHaveBeenCalledWith(glow);
  });

  it('resets pooled-paint glow and color between commands (state at draw time)', () => {
    const module = loadReplayModule();
    type DrawSnapshot = { color: unknown; imageFilter: unknown };
    const snapshots: DrawSnapshot[] = [];
    const canvas = createCanvas();
    canvas.drawPath = jest.fn(
      (_path: unknown, paint: (typeof module.paints)[number]) => {
        snapshots.push({
          color: paint.setColor.mock.calls.at(-1)?.[0],
          imageFilter: paint.setImageFilter.mock.calls.at(-1)?.[0],
        });
      }
    ) as never;

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'fillPath',
          groupId: 'note-glow',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#111111', shadowColor: '#00FF00', shadowBlur: 6 },
        },
        {
          type: 'fillPath',
          path: [{ type: 'moveTo', x: 1, y: 1 }],
          paint: { color: '#222222' },
        },
      ],
      {},
      'Bravura'
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toEqual({
      color: 'color:#111111',
      imageFilter: expect.objectContaining({ __typename__: 'ImageFilter' }),
    });
    // The second draw sees its own color and a cleared filter — nothing
    // bleeds from the glowing command before it.
    expect(snapshots[1]).toEqual({
      color: 'color:#222222',
      imageFilter: null,
    });
  });

  it('parses each distinct color once per replay', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();
    const paint = { color: '#111111' };
    const commands = [
      { type: 'fillRect', rect: { x: 0, y: 0, width: 1, height: 1 }, paint },
      { type: 'fillRect', rect: { x: 1, y: 0, width: 1, height: 1 }, paint },
      {
        type: 'fillRect',
        rect: { x: 2, y: 0, width: 1, height: 1 },
        paint: { color: '#222222' },
      },
    ];

    module.renderVexflowRecordingCommands(
      canvas as never,
      commands as never,
      { kind: 'provider' },
      'Bravura'
    );

    expect(module.SkiaColor).toHaveBeenCalledTimes(2);
    expect(module.SkiaColor).toHaveBeenCalledWith('#111111');
    expect(module.SkiaColor).toHaveBeenCalledWith('#222222');
  });

  it('reuses a supplied FontManager instead of constructing one per replay', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();
    const suppliedCreateSkFont = jest.fn(() => ({ kind: 'supplied-font' }));
    const supplied = { createSkFont: suppliedCreateSkFont };
    const commands = [
      {
        type: 'fillText',
        text: 'x',
        x: 0,
        y: 0,
        paint: { color: '#111111' },
        font: { font: 'Bravura' },
      },
    ];

    module.renderVexflowRecordingCommands(
      canvas as never,
      commands as never,
      { kind: 'provider' },
      'Bravura',
      undefined,
      supplied
    );

    expect(module.FontManagerMock).not.toHaveBeenCalled();
    expect(suppliedCreateSkFont).toHaveBeenCalledTimes(1);

    module.renderVexflowRecordingCommands(
      canvas as never,
      commands as never,
      { kind: 'provider' },
      'Bravura'
    );

    expect(module.FontManagerMock).toHaveBeenCalledTimes(1);
  });

  it('never restyles an untagged command even when overrides are supplied', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'fillPath',
          // no groupId — staff chrome
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000' },
        },
      ],
      {},
      'Bravura',
      { 'note-1': { color: '#FF0000', shadowColor: '#FF0000' } }
    );

    expect(module.paints[0]!.setColor).toHaveBeenCalledWith('color:#000000');
    // The pooled paint only resets the filter; no glow is ever constructed.
    for (const call of module.paints[0]!.setImageFilter.mock.calls) {
      expect(call[0]).toBeNull();
    }
    expect(module.MakeDropShadow).not.toHaveBeenCalled();
  });

  it('disposes each drawn path and every pooled Skia object when the replay ends', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();
    const disposedAtDraw: boolean[] = [];
    canvas.drawPath = jest.fn((path: { dispose: jest.Mock }) => {
      disposedAtDraw.push(path.dispose.mock.calls.length > 0);
    }) as never;

    module.renderVexflowRecordingCommands(
      canvas,
      [
        {
          type: 'fillPath',
          path: [{ type: 'moveTo', x: 0, y: 0 }],
          paint: { color: '#000000', shadowColor: '#00FF00', shadowBlur: 4 },
        },
        {
          type: 'strokePath',
          path: [{ type: 'moveTo', x: 1, y: 1 }],
          paint: { color: '#000000', lineDash: [4, 2] },
        },
        {
          type: 'clearRect',
          rect: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
      {},
      'Bravura'
    );

    // Each path is still alive when drawn and freed right after.
    expect(disposedAtDraw).toEqual([false, false]);
    for (const result of module.pathBuilders[0]!.detach.mock.results) {
      expect(
        (result.value as { dispose: jest.Mock }).dispose
      ).toHaveBeenCalledTimes(1);
    }

    // fill + stroke + clear paints, the builder, the glow and the dash.
    const pooled = [
      ...module.paints,
      ...module.pathBuilders,
      ...returned(module.MakeDropShadow),
      ...returned(module.MakeDash),
    ] as { dispose: jest.Mock }[];
    expect(pooled).toHaveLength(6);
    for (const object of pooled) {
      expect(object.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it('disposes pooled Skia objects even when a command throws', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();
    canvas.save = jest.fn(() => {
      throw new Error('canvas lost');
    }) as never;

    expect(() =>
      module.renderVexflowRecordingCommands(
        canvas,
        [{ type: 'save' }],
        {},
        'Bravura'
      )
    ).toThrow('canvas lost');

    for (const object of [...module.paints, ...module.pathBuilders]) {
      expect(object.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it('creates each distinct glow and dash once per replay', () => {
    const module = loadReplayModule();
    const canvas = createCanvas();
    const glowing = { color: '#000000', shadowColor: '#00FF00', shadowBlur: 4 };
    const dashed = { color: '#000000', lineDash: [4, 2] };
    const path = [{ type: 'moveTo', x: 0, y: 0 }];

    module.renderVexflowRecordingCommands(
      canvas,
      [
        { type: 'fillPath', path, paint: glowing },
        { type: 'fillPath', path, paint: glowing },
        { type: 'fillPath', path, paint: { ...glowing, shadowBlur: 8 } },
        { type: 'strokePath', path, paint: dashed },
        { type: 'strokePath', path, paint: { ...dashed, lineDash: [4, 2] } },
        { type: 'strokePath', path, paint: { ...dashed, lineDash: [1, 1] } },
      ],
      {},
      'Bravura'
    );

    expect(module.MakeDropShadow).toHaveBeenCalledTimes(2);
    expect(module.MakeDash).toHaveBeenCalledTimes(2);
  });
});
