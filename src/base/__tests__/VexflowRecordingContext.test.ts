import { afterEach, describe, expect, it, jest } from '@jest/globals';

const WIDTH_SCALE = 3 / 4;

type LoadedContextModule = {
  VexflowRecordingContext: new (
    fontProvider: unknown,
    defaultFont: string
  ) => any;
  createSkFont: ReturnType<typeof jest.fn>;
  getTextMeasurementCanvas: ReturnType<typeof jest.fn>;
  installVexflowReactNativeFallbacks: ReturnType<typeof jest.fn>;
  setTextMeasurementCanvas: ReturnType<typeof jest.fn>;
  textMeasurementContext: Record<string, string>;
  TextMeasureContextMock: ReturnType<typeof jest.fn>;
};

function loadContextModule(platformOs: 'ios' | 'android' | 'web') {
  jest.resetModules();

  const setTextMeasurementCanvas = jest.fn();
  const textMeasurementContext = {
    tag: 'text-measurement-context',
  };
  const getTextMeasurementCanvas = jest.fn(() => ({
    getContext: jest.fn(() => textMeasurementContext),
  }));
  const TextMeasureContextMock = jest.fn(() => textMeasurementContext);
  const createSkFont = jest.fn((...args: unknown[]) => ({
    kind: 'font',
    args,
  }));
  const FontManagerMock = jest.fn().mockImplementation(() => ({
    createSkFont,
  }));
  const installVexflowReactNativeFallbacks = jest.fn();

  jest.doMock('react-native', () => ({
    Platform: {
      OS: platformOs,
    },
  }));
  jest.doMock('vexflow', () => ({
    Element: {
      getTextMeasurementCanvas,
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
  jest.doMock('../setupVexflowReactNative', () => ({
    installVexflowReactNativeFallbacks,
  }));

  let VexflowRecordingContext: LoadedContextModule['VexflowRecordingContext'];

  jest.isolateModules(() => {
    VexflowRecordingContext = require('../VexflowRecordingContext').default;
  });

  return {
    createSkFont,
    getTextMeasurementCanvas,
    installVexflowReactNativeFallbacks,
    setTextMeasurementCanvas,
    textMeasurementContext,
    TextMeasureContextMock,
    VexflowRecordingContext: VexflowRecordingContext!,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.resetModules();
});

describe('VexflowRecordingContext', () => {
  it('creates the default font and installs the text measurement canvas on mobile', () => {
    const module = loadContextModule('ios');
    const fontProvider = { family: 'provider' };
    const context = new module.VexflowRecordingContext(fontProvider, 'Bravura');

    expect(module.createSkFont).toHaveBeenCalledWith('Bravura');
    expect(context.getCurrentSkFont()).toEqual({
      kind: 'font',
      args: ['Bravura'],
    });
    expect(module.TextMeasureContextMock).toHaveBeenCalledWith(context);
    expect(module.installVexflowReactNativeFallbacks).toHaveBeenCalledTimes(1);
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
    const context = new module.VexflowRecordingContext({}, 'Bravura');

    expect(context).toBeDefined();
    expect(module.installVexflowReactNativeFallbacks).not.toHaveBeenCalled();
    expect(module.getTextMeasurementCanvas).toHaveBeenCalledTimes(1);
    expect(module.setTextMeasurementCanvas).not.toHaveBeenCalled();
    expect(module.TextMeasureContextMock).not.toHaveBeenCalled();
  });

  it('records drawing, transform, clipping, text, and path commands', () => {
    const module = loadContextModule('android');
    const context = new module.VexflowRecordingContext({}, 'Bravura');

    context
      .setFillStyle('red')
      .setStrokeStyle('#123456')
      .setLineWidth(4)
      .setLineCap('round')
      .scale(2, 3)
      .translate(4, 5)
      .fillRect(1, 2, 30, 40)
      .clearRect(5, 6, 7, 8)
      .clipRect(9, 10, 11, 12)
      .beginPath()
      .moveTo(1, 2)
      .lineTo(3, 4)
      .bezierCurveTo(5, 6, 7, 8, 9, 10)
      .quadraticCurveTo(11, 12, 13, 14)
      .rect(15, 16, 17, 18)
      .arc(20, 21, 22, Math.PI / 2, Math.PI, false)
      .closePath()
      .fill()
      .stroke()
      .setFont('Academico', 12, 700, 'italic')
      .fillText('abc', 9, 10)
      .save()
      .restore();

    expect(context.finish()).toEqual([
      { type: 'scale', x: 2, y: 3 },
      { type: 'translate', x: 4, y: 5 },
      {
        type: 'fillRect',
        rect: { x: 1, y: 2, width: 30, height: 40 },
        paint: { color: '#FF0000' },
      },
      {
        type: 'clearRect',
        rect: { x: 5, y: 6, width: 7, height: 8 },
      },
      {
        type: 'clipRect',
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
            rect: { x: -2, y: -1, width: 44, height: 44 },
            startDegrees: 90,
            sweepDegrees: 90,
          },
          { type: 'close' },
        ],
        paint: { color: '#FF0000' },
      },
      {
        type: 'strokePath',
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
            rect: { x: -2, y: -1, width: 44, height: 44 },
            startDegrees: 90,
            sweepDegrees: 90,
          },
          { type: 'close' },
        ],
        paint: {
          color: '#123456',
          strokeCap: 'round',
          strokeWidth: 4 * WIDTH_SCALE,
        },
      },
      {
        type: 'fillText',
        text: 'abc',
        x: 9,
        y: 10,
        paint: { color: '#FF0000' },
        font: {
          font: 'Academico',
          size: 12,
          weight: 700,
          style: 'italic',
        },
      },
      { type: 'save' },
      { type: 'restore' },
    ]);
  });

  it('records a transparent clear command', () => {
    const module = loadContextModule('ios');
    const context = new module.VexflowRecordingContext({}, 'Bravura');

    context.clear();

    expect(context.finish()).toEqual([
      {
        type: 'clear',
        color: 'transparent',
      },
    ]);
  });

  it('returns cloned command definitions and rejects mutation after finish', () => {
    const module = loadContextModule('ios');
    const context = new module.VexflowRecordingContext({}, 'Bravura');

    context.fillRect(1, 2, 3, 4);

    const firstFinish = context.finish() as any[];
    firstFinish[0].rect.x = 100;

    expect(context.finish()).toEqual([
      {
        type: 'fillRect',
        rect: { x: 1, y: 2, width: 3, height: 4 },
        paint: { color: '#000000' },
      },
    ]);
    expect(() => context.fillRect(5, 6, 7, 8)).toThrow(
      'VexflowRecordingContext: Cannot record commands after finish() has been called.'
    );
  });

  it('logs and returns placeholder values for the currently unimplemented methods', () => {
    const module = loadContextModule('android');
    const context = new module.VexflowRecordingContext({}, 'Bravura');
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
        'VexflowRecordingContext: Method "setFillStyle (gradient or pattern)" is not implemented yet.',
      ],
      [
        'VexflowRecordingContext: Method "setBackgroundFillStyle" is not implemented yet.',
      ],
      [
        'VexflowRecordingContext: Method "setShadowColor" is not implemented yet.',
      ],
      [
        'VexflowRecordingContext: Method "setShadowBlur" is not implemented yet.',
      ],
      ['VexflowRecordingContext: Method "setLineDash" is not implemented yet.'],
      ['VexflowRecordingContext: Method "resize" is not implemented yet.'],
      [
        'VexflowRecordingContext: Method "openRotation" is not implemented yet.',
      ],
      [
        'VexflowRecordingContext: Method "closeRotation" is not implemented yet.',
      ],
      ['VexflowRecordingContext: Method "add" is not implemented yet.'],
      ['VexflowRecordingContext: Method "measureText" is not implemented yet.'],
      ['VexflowRecordingContext: Method "getFont" is not implemented yet.'],
      [
        'VexflowRecordingContext: Method "get fillStyle" is not implemented yet.',
      ],
      [
        'VexflowRecordingContext: Method "get strokeStyle" is not implemented yet.',
      ],
      ['VexflowRecordingContext: Method "get font" is not implemented yet.'],
    ]);
  });

  it('keeps silent placeholder methods silent with the current configuration', () => {
    const module = loadContextModule('ios');
    const context = new module.VexflowRecordingContext({}, 'Bravura');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    expect(context.pointerRect(1, 2, 3, 4)).toBe(context);
    expect(context.openGroup('cls', 'id')).toBe(context);
    expect(context.closeGroup()).toBe(context);

    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
