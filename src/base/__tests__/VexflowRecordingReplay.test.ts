import { afterEach, describe, expect, it, jest } from '@jest/globals';

type MockPaint = {
  setAntiAlias: ReturnType<typeof jest.fn>;
  setBlendMode: ReturnType<typeof jest.fn>;
  setColor: ReturnType<typeof jest.fn>;
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
  const createSkFont = jest.fn((...args: unknown[]) => ({
    kind: 'font',
    args,
  }));
  const FontManagerMock = jest.fn().mockImplementation(() => ({
    createSkFont,
  }));

  jest.doMock('@shopify/react-native-skia', () => ({
    BlendMode,
    ClipOp,
    PaintStyle,
    Skia: {
      Color: (color: string) => `color:${color}`,
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
    defaultFont: string
  ) => void;

  jest.isolateModules(() => {
    renderVexflowRecordingCommands =
      require('../VexflowRecordingReplay').renderVexflowRecordingCommands;
  });

  return {
    BlendMode,
    ClipOp,
    createSkFont,
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
      module.paints[1]
    );
    expect(module.paints[1]!.setBlendMode).toHaveBeenCalledWith(
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
      module.paints[2]
    );

    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      2,
      module.pathBuilders[1]!.builtPath,
      module.paints[3]
    );
    expect(module.paints[3]!.setStyle).toHaveBeenCalledWith(
      module.PaintStyle.Stroke
    );
    expect(module.paints[3]!.setStrokeCap).toHaveBeenCalledWith(
      module.StrokeCap.Round
    );
    expect(module.paints[3]!.setStrokeWidth).toHaveBeenCalledWith(3);
    expect(canvas.drawText).toHaveBeenCalledWith(
      'abc',
      32,
      33,
      module.paints[4],
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
  });
});
