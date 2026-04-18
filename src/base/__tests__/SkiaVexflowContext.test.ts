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
  drawPath: ReturnType<typeof jest.fn>;
  drawRect: ReturnType<typeof jest.fn>;
  drawText: ReturnType<typeof jest.fn>;
  restore: ReturnType<typeof jest.fn>;
  save: ReturnType<typeof jest.fn>;
  scale: ReturnType<typeof jest.fn>;
};

type LoadedContextModule = {
  BlendMode: { Clear: string };
  PaintStyle: { Fill: string; Stroke: string };
  SkiaVexflowContext: new (
    canvas: MockCanvas,
    fontProvider: unknown,
    defaultFont: string
  ) => any;
  StrokeCap: {
    Butt: string;
    Round: string;
    Square: string;
  };
  createSkFont: ReturnType<typeof jest.fn>;
  paints: MockPaint[];
  pathBuilders: MockPathBuilder[];
  setTextMeasurementCanvas: ReturnType<typeof jest.fn>;
  textMeasurementContext: Record<string, string>;
  TextMeasureContextMock: ReturnType<typeof jest.fn>;
  XYWHRect: ReturnType<typeof jest.fn>;
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
    drawPath: jest.fn(),
    drawRect: jest.fn(),
    drawText: jest.fn(),
    restore: jest.fn(),
    save: jest.fn(),
    scale: jest.fn(),
  };
}

function loadContextModule(platformOs: 'ios' | 'android' | 'web') {
  jest.resetModules();

  const BlendMode = { Clear: 'clear' };
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
  const setTextMeasurementCanvas = jest.fn();
  const textMeasurementContext = {
    tag: 'text-measurement-context',
  };
  const TextMeasureContextMock = jest.fn(() => textMeasurementContext);
  const createSkFont = jest.fn((...args: unknown[]) => ({
    kind: 'font',
    args,
  }));
  const FontManagerMock = jest.fn().mockImplementation(() => ({
    createSkFont,
  }));

  jest.doMock('@shopify/react-native-skia', () => ({
    BlendMode,
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
  jest.doMock('react-native', () => ({
    Platform: {
      OS: platformOs,
    },
  }));
  jest.doMock('vexflow', () => ({
    Element: {
      setTextMeasurementCanvas,
    },
    RenderContext: class RenderContext {},
  }));
  jest.doMock('../FontManager', () => ({
    __esModule: true,
    default: FontManagerMock,
  }));
  jest.doMock('../TextMeasureContext', () => ({
    __esModule: true,
    default: TextMeasureContextMock,
  }));

  let SkiaVexflowContext: LoadedContextModule['SkiaVexflowContext'];

  jest.isolateModules(() => {
    SkiaVexflowContext = require('../SkiaVexflowContext').default;
  });

  return {
    BlendMode,
    PaintStyle,
    SkiaVexflowContext: SkiaVexflowContext!,
    StrokeCap,
    createSkFont,
    paints,
    pathBuilders,
    setTextMeasurementCanvas,
    textMeasurementContext,
    TextMeasureContextMock,
    XYWHRect,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.resetModules();
});

describe('SkiaVexflowContext', () => {
  it('initializes paints, creates the default font, and installs the text measurement canvas on mobile', () => {
    const module = loadContextModule('ios');
    const canvas = createCanvas();
    const fontProvider = { family: 'provider' };
    const context = new module.SkiaVexflowContext(
      canvas,
      fontProvider,
      'Bravura'
    );

    expect(module.paints).toHaveLength(2);
    expect(module.paints[0]!.setStyle).toHaveBeenCalledWith(
      module.PaintStyle.Fill
    );
    expect(module.paints[1]!.setStyle).toHaveBeenCalledWith(
      module.PaintStyle.Stroke
    );
    expect(module.paints[0]!.setAntiAlias).toHaveBeenCalledWith(true);
    expect(module.paints[1]!.setAntiAlias).toHaveBeenCalledWith(true);
    expect(module.paints[0]!.setColor).toHaveBeenCalledWith('color:black');
    expect(module.paints[1]!.setColor).toHaveBeenCalledWith('color:black');
    expect(module.createSkFont).toHaveBeenCalledWith('Bravura');
    expect(context.getCurrentSkFont()).toEqual({
      kind: 'font',
      args: ['Bravura'],
    });

    expect(module.TextMeasureContextMock).toHaveBeenCalledWith(context);
    expect(module.setTextMeasurementCanvas).toHaveBeenCalledTimes(1);

    const measurementCanvas = module.setTextMeasurementCanvas.mock
      .calls[0]?.[0] as {
      getContext: (type: string) => unknown;
    };

    expect(measurementCanvas.getContext('2d')).toBe(
      module.textMeasurementContext
    );
    expect(measurementCanvas.getContext('webgl')).toBeNull();
  });

  it('does not install the text measurement canvas on web', () => {
    const module = loadContextModule('web');
    const context = new module.SkiaVexflowContext(
      createCanvas(),
      {},
      'Bravura'
    );

    expect(context).toBeDefined();
    expect(module.setTextMeasurementCanvas).not.toHaveBeenCalled();
    expect(module.TextMeasureContextMock).toHaveBeenCalledTimes(1);
  });

  it('delegates drawing and configuration calls to the canvas, path builder, and paints', () => {
    const module = loadContextModule('android');
    const canvas = createCanvas();
    const context = new module.SkiaVexflowContext(canvas, {}, 'Bravura');

    context
      .setFillStyle('red')
      .setStrokeStyle('#123456')
      .setLineWidth(4)
      .setLineCap('round')
      .scale(2, 3)
      .fillRect(1, 2, 30, 40)
      .clearRect(5, 6, 7, 8)
      .fillText('abc', 9, 10)
      .save()
      .restore();

    context.fillStyle = 'white';
    context.strokeStyle = 'black';

    expect(module.paints[0]!.setColor).toHaveBeenNthCalledWith(
      2,
      'color:#FF0000'
    );
    expect(module.paints[0]!.setColor).toHaveBeenNthCalledWith(
      3,
      'color:#FFFFFF'
    );
    expect(module.paints[1]!.setColor).toHaveBeenNthCalledWith(
      2,
      'color:#123456'
    );
    expect(module.paints[1]!.setColor).toHaveBeenNthCalledWith(
      3,
      'color:#000000'
    );
    expect(module.paints[1]!.setStrokeWidth).toHaveBeenCalledWith(4);
    expect(module.paints[1]!.setStrokeCap).toHaveBeenCalledWith(
      module.StrokeCap.Round
    );
    expect(canvas.scale).toHaveBeenCalledWith(2, 3);
    expect(module.XYWHRect).toHaveBeenNthCalledWith(1, 1, 2, 30, 40);
    expect(canvas.drawRect).toHaveBeenNthCalledWith(
      1,
      { x: 1, y: 2, width: 30, height: 40 },
      module.paints[0]
    );
    expect(module.XYWHRect).toHaveBeenNthCalledWith(2, 5, 6, 7, 8);
    expect(module.paints[2]!.setBlendMode).toHaveBeenCalledWith(
      module.BlendMode.Clear
    );
    expect(canvas.drawRect).toHaveBeenNthCalledWith(
      2,
      { x: 5, y: 6, width: 7, height: 8 },
      module.paints[2]
    );
    expect(canvas.drawText).toHaveBeenCalledWith(
      'abc',
      9,
      10,
      module.paints[0],
      context.getCurrentSkFont()
    );
    expect(canvas.save).toHaveBeenCalledTimes(1);
    expect(canvas.restore).toHaveBeenCalledTimes(1);
  });

  it('builds and draws paths, including arc conversion and lazy path creation', () => {
    const module = loadContextModule('ios');
    const canvas = createCanvas();
    const context = new module.SkiaVexflowContext(canvas, {}, 'Bravura');

    context
      .beginPath()
      .moveTo(1, 2)
      .lineTo(3, 4)
      .bezierCurveTo(5, 6, 7, 8, 9, 10)
      .quadraticCurveTo(11, 12, 13, 14)
      .rect(15, 16, 17, 18)
      .arc(20, 21, 22, Math.PI / 2, Math.PI, false)
      .closePath()
      .fill()
      .stroke();

    const pathBuilder = module.pathBuilders[0]!;

    expect(pathBuilder.moveTo).toHaveBeenCalledWith(1, 2);
    expect(pathBuilder.lineTo).toHaveBeenCalledWith(3, 4);
    expect(pathBuilder.cubicTo).toHaveBeenCalledWith(5, 6, 7, 8, 9, 10);
    expect(pathBuilder.quadTo).toHaveBeenCalledWith(11, 12, 13, 14);
    expect(module.XYWHRect).toHaveBeenNthCalledWith(1, 15, 16, 17, 18);
    expect(pathBuilder.addRect).toHaveBeenCalledWith({
      x: 15,
      y: 16,
      width: 17,
      height: 18,
    });
    expect(module.XYWHRect).toHaveBeenNthCalledWith(2, -2, -1, 44, 44);
    expect(pathBuilder.addArc).toHaveBeenCalledWith(
      { x: -2, y: -1, width: 44, height: 44 },
      90,
      90
    );
    expect(pathBuilder.close).toHaveBeenCalledTimes(1);
    expect(pathBuilder.build).toHaveBeenCalledTimes(2);
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      1,
      pathBuilder.builtPath,
      module.paints[0]
    );
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      2,
      pathBuilder.builtPath,
      module.paints[1]
    );

    context.arc(30, 40, 5, Math.PI, Math.PI / 2, true);
    context.fill();

    expect(pathBuilder.addArc).toHaveBeenNthCalledWith(
      2,
      { x: 25, y: 35, width: 10, height: 10 },
      180,
      90
    );
  });

  it('creates a path lazily when fill or stroke is called before beginPath', () => {
    const module = loadContextModule('ios');
    const canvas = createCanvas();
    const context = new module.SkiaVexflowContext(canvas, {}, 'Bravura');

    context.fill();
    context.stroke();

    expect(module.pathBuilders).toHaveLength(1);
    expect(module.pathBuilders[0]!.build).toHaveBeenCalledTimes(2);
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      1,
      module.pathBuilders[0]!.builtPath,
      module.paints[0]
    );
    expect(canvas.drawPath).toHaveBeenNthCalledWith(
      2,
      module.pathBuilders[0]!.builtPath,
      module.paints[1]
    );
  });

  it('updates the current font through setFont and the font property setter', () => {
    const module = loadContextModule('ios');
    const context = new module.SkiaVexflowContext(
      createCanvas(),
      {},
      'Bravura'
    );

    const nextFont = { kind: 'font', args: ['Academico', 12, 700, 'italic'] };
    module.createSkFont.mockReturnValueOnce(nextFont);

    expect(
      context.setFont('Academico', 12, 700, 'italic').getCurrentSkFont()
    ).toBe(nextFont);
    expect(module.createSkFont).toHaveBeenNthCalledWith(
      2,
      'Academico',
      12,
      700,
      'italic'
    );

    const propertyFont = { kind: 'font', args: ['12pt Bravura'] };
    module.createSkFont.mockReturnValueOnce(propertyFont);
    context.font = '12pt Bravura';

    expect(module.createSkFont).toHaveBeenNthCalledWith(
      3,
      '12pt Bravura',
      undefined,
      undefined,
      undefined
    );
    expect(context.getCurrentSkFont()).toBe(propertyFont);
  });

  it('logs and returns placeholder values for the currently unimplemented methods', () => {
    const module = loadContextModule('android');
    const context = new module.SkiaVexflowContext(
      createCanvas(),
      {},
      'Bravura'
    );
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(context.setFillStyle({ gradient: true })).toBe(context);
    expect(context.setBackgroundFillStyle('white')).toBe(context);
    expect(context.setShadowColor('black')).toBe(context);
    expect(context.setShadowBlur(4)).toBe(context);
    expect(context.setLineDash([1, 2, 3])).toBe(context);
    expect(context.resize(100, 200)).toBe(context);
    expect(context.openRotation(30, 40, 50)).toBe(context);
    expect(context.closeRotation()).toBe(context);
    expect(context.add({ child: true })).toBe(context);
    expect(context.measureText('test')).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(context.getFont()).toBe('');
    expect(context.fillStyle).toBe('');
    expect(context.strokeStyle).toBe('');
    expect(context.font).toBe('');

    expect(consoleSpy.mock.calls).toEqual([
      [
        'SkiaVexflowContext: Method "setFillStyle (gradient or pattern)" is not implemented yet.',
      ],
      [
        'SkiaVexflowContext: Method "setBackgroundFillStyle" is not implemented yet.',
      ],
      ['SkiaVexflowContext: Method "setShadowColor" is not implemented yet.'],
      ['SkiaVexflowContext: Method "setShadowBlur" is not implemented yet.'],
      ['SkiaVexflowContext: Method "setLineDash" is not implemented yet.'],
      ['SkiaVexflowContext: Method "resize" is not implemented yet.'],
      ['SkiaVexflowContext: Method "openRotation" is not implemented yet.'],
      ['SkiaVexflowContext: Method "closeRotation" is not implemented yet.'],
      ['SkiaVexflowContext: Method "add" is not implemented yet.'],
      ['SkiaVexflowContext: Method "measureText" is not implemented yet.'],
      ['SkiaVexflowContext: Method "getFont" is not implemented yet.'],
      ['SkiaVexflowContext: Method "get fillStyle" is not implemented yet.'],
      ['SkiaVexflowContext: Method "get strokeStyle" is not implemented yet.'],
      ['SkiaVexflowContext: Method "get font" is not implemented yet.'],
    ]);
  });

  it('keeps silent placeholder methods silent with the current configuration', () => {
    const module = loadContextModule('ios');
    const context = new module.SkiaVexflowContext(
      createCanvas(),
      {},
      'Bravura'
    );
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(context.pointerRect(1, 2, 3, 4)).toBe(context);
    expect(context.openGroup('cls', 'id')).toBe(context);
    expect(context.closeGroup()).toBe(context);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('clears the canvas with a transparent color', () => {
    const module = loadContextModule('ios');
    const canvas = createCanvas();
    const context = new module.SkiaVexflowContext(canvas, {}, 'Bravura');

    context.clear();

    expect(canvas.clear).toHaveBeenCalledWith('color:transparent');
  });
});
