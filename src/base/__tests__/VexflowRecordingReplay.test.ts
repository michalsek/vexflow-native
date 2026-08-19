import { afterEach, describe, expect, it, jest } from '@jest/globals';

type MockPaint = {
  setAntiAlias: ReturnType<typeof jest.fn>;
  setBlendMode: ReturnType<typeof jest.fn>;
  setColor: ReturnType<typeof jest.fn>;
  setImageFilter: ReturnType<typeof jest.fn>;
  setPathEffect: ReturnType<typeof jest.fn>;
  setStrokeCap: ReturnType<typeof jest.fn>;
  setStrokeWidth: ReturnType<typeof jest.fn>;
  setStyle: ReturnType<typeof jest.fn>;
};

type MockPath = {
  tag: string;
};

type MockPathBuilder = {
  addArc: ReturnType<typeof jest.fn>;
  addRect: ReturnType<typeof jest.fn>;
  build: ReturnType<typeof jest.fn>;
  close: ReturnType<typeof jest.fn>;
  cubicTo: ReturnType<typeof jest.fn>;
  lineTo: ReturnType<typeof jest.fn>;
  moveTo: ReturnType<typeof jest.fn>;
  quadTo: ReturnType<typeof jest.fn>;
  builtPath: MockPath;
};

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

function createPaint(): MockPaint {
  return {
    setAntiAlias: jest.fn(),
    setBlendMode: jest.fn(),
    setColor: jest.fn(),
    setImageFilter: jest.fn(),
    setPathEffect: jest.fn(),
    setStrokeCap: jest.fn(),
    setStrokeWidth: jest.fn(),
    setStyle: jest.fn(),
  };
}

function createPathBuilder(index: number): MockPathBuilder {
  const builtPath = {
    tag: `path-${index}`,
  };

  return {
    addArc: jest.fn(),
    addRect: jest.fn(),
    build: jest.fn(() => builtPath),
    close: jest.fn(),
    cubicTo: jest.fn(),
    lineTo: jest.fn(),
    moveTo: jest.fn(),
    quadTo: jest.fn(),
    builtPath,
  };
}

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

function loadReplayModule() {
  jest.resetModules();

  const BlendMode = { Clear: 'clear' };
  const ClipOp = { Intersect: 'intersect' };
  const PaintStyle = { Fill: 'fill', Stroke: 'stroke' };
  const StrokeCap = {
    Butt: 'butt',
    Round: 'round',
    Square: 'square',
  };
  const paints: MockPaint[] = [];
  const pathBuilders: MockPathBuilder[] = [];
  const XYWHRect = jest.fn(
    (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    })
  );
  const MakeDropShadow = jest.fn(
    (
      dx: number,
      dy: number,
      sigmaX: number,
      sigmaY: number,
      color: string
    ) => ({
      kind: 'drop-shadow',
      dx,
      dy,
      sigmaX,
      sigmaY,
      color,
    })
  );
  const MakeDash = jest.fn((intervals: number[], phase?: number) => ({
    kind: 'dash',
    intervals,
    phase,
  }));
  const createSkFont = jest.fn((...args: unknown[]) => ({
    kind: 'font',
    args,
  }));
  const SkiaColor = jest.fn((color: string) => `color:${color}`);
  const FontManagerMock = jest.fn().mockImplementation(() => ({
    createSkFont,
  }));

  jest.doMock('@shopify/react-native-skia', () => ({
    BlendMode,
    ClipOp,
    PaintStyle,
    Skia: {
      Color: SkiaColor,
      Paint: jest.fn(() => {
        const paint = createPaint();
        paints.push(paint);
        return paint;
      }),
      PathBuilder: {
        Make: jest.fn(() => {
          const builder = createPathBuilder(pathBuilders.length + 1);
          pathBuilders.push(builder);
          return builder;
        }),
      },
      ImageFilter: {
        MakeDropShadow,
      },
      PathEffect: {
        MakeDash,
      },
      XYWHRect,
    },
    StrokeCap,
  }));
  jest.doMock('../FontManager', () => ({
    __esModule: true,
    default: FontManagerMock,
  }));

  let renderVexflowRecordingCommands: (
    canvas: MockCanvas,
    commands: any[],
    fontProvider: unknown,
    defaultFont: string,
    styleOverrides?: Record<string, Record<string, unknown>>,
    replayFontManager?: unknown
  ) => void;

  jest.isolateModules(() => {
    renderVexflowRecordingCommands =
      require('../VexflowRecordingReplay').renderVexflowRecordingCommands;
  });

  return {
    BlendMode,
    ClipOp,
    createSkFont,
    FontManagerMock,
    SkiaColor,
    MakeDash,
    MakeDropShadow,
    PaintStyle,
    paints,
    pathBuilders,
    renderVexflowRecordingCommands: renderVexflowRecordingCommands!,
    StrokeCap,
    XYWHRect,
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
      fillPathBuilder.builtPath,
      module.paints[0]
    );

    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      2,
      module.pathBuilders[1]!.builtPath,
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
    expect(module.paints[0]!.setImageFilter).toHaveBeenCalledWith({
      kind: 'drop-shadow',
      dx: 0,
      dy: 0,
      sigmaX: 4,
      sigmaY: 4,
      color: 'color:#00FF00',
    });
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
    expect(module.paints[1]!.setPathEffect).toHaveBeenCalledWith({
      kind: 'dash',
      intervals: [4, 2],
      phase: undefined,
    });
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

    // Both paints glow; blur 6 -> sigma 3.
    expect(module.MakeDropShadow).toHaveBeenCalledTimes(2);
    expect(module.MakeDropShadow).toHaveBeenNthCalledWith(
      1,
      0,
      0,
      3,
      3,
      'color:#FFAA00'
    );
    expect(module.paints[0]!.setImageFilter).toHaveBeenCalledTimes(1);
    expect(module.paints[1]!.setImageFilter).toHaveBeenCalledTimes(1);
  });

  it('resets pooled-paint glow and color between commands (state at draw time)', () => {
    const module = loadReplayModule();
    type DrawSnapshot = { color: unknown; imageFilter: unknown };
    const snapshots: DrawSnapshot[] = [];
    const canvas = createCanvas();
    canvas.drawPath = jest.fn((_path: unknown, paint: MockPaint) => {
      snapshots.push({
        color: paint.setColor.mock.calls.at(-1)?.[0],
        imageFilter: paint.setImageFilter.mock.calls.at(-1)?.[0],
      });
    }) as never;

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
      imageFilter: expect.objectContaining({ kind: 'drop-shadow' }),
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
});
