import { afterEach, describe, expect, it, jest } from '@jest/globals';

function loadScoreRendererModule() {
  jest.resetModules();

  const mockCanvas = { kind: 'canvas' };
  const mockPicture = { kind: 'picture' };
  const mockBeginRecording = jest.fn(() => mockCanvas);
  const mockFinishRecordingAsPicture = jest.fn(() => mockPicture);
  const mockPictureRecorder = jest.fn(() => ({
    beginRecording: mockBeginRecording,
    finishRecordingAsPicture: mockFinishRecordingAsPicture,
  }));
  const mockXYWHRect = jest.fn(
    (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    })
  );
  const mockRenderVexflowRecordingCommands = jest.fn();

  jest.doMock('@shopify/react-native-skia', () => ({
    Canvas: 'Canvas',
    Group: 'Group',
    Picture: 'Picture',
    Skia: {
      PictureRecorder: mockPictureRecorder,
      XYWHRect: mockXYWHRect,
    },
    useCanvasRef: jest.fn(() => ({ current: null })),
    useCanvasSize: jest.fn(() => ({ size: { height: 0, width: 0 } })),
  }));

  jest.doMock('react-native', () => ({
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
    View: 'View',
  }));

  const mockPanGesture = {
    enabled: jest.fn(() => mockPanGesture),
    minDistance: jest.fn(() => mockPanGesture),
    onEnd: jest.fn(() => mockPanGesture),
    onStart: jest.fn(() => mockPanGesture),
    onUpdate: jest.fn(() => mockPanGesture),
  };

  jest.doMock('react-native-gesture-handler', () => ({
    Gesture: {
      Pan: jest.fn(() => mockPanGesture),
    },
    GestureDetector: 'GestureDetector',
  }));

  jest.doMock('react-native-reanimated', () => ({
    __esModule: true,
    default: {
      View: 'AnimatedView',
    },
    cancelAnimation: jest.fn(),
    useAnimatedReaction: jest.fn(),
    useAnimatedStyle: jest.fn((factory: () => unknown) => factory()),
    useDerivedValue: jest.fn((factory: () => unknown) => ({
      value: factory(),
    })),
    useSharedValue: jest.fn((value: unknown) => ({ value })),
    withDecay: jest.fn((config: unknown) => config),
  }));

  jest.doMock('../../base/VexflowRecordingReplay', () => ({
    renderVexflowRecordingCommands: mockRenderVexflowRecordingCommands,
  }));

  const module =
    require('../ScoreRenderer') as typeof import('../ScoreRenderer');

  return {
    clampOffset: module.clampOffset,
    createClampedScrollOffset: module.createClampedScrollOffset,
    createPictureTransform: module.createPictureTransform,
    createScorePicture: module.createScorePicture,
    getMaxScroll: module.getMaxScroll,
    getScrollbarMetrics: module.getScrollbarMetrics,
    getScrollOffsetFromThumbOffset: module.getScrollOffsetFromThumbOffset,
    getThumbOffsetFromScrollOffset: module.getThumbOffsetFromScrollOffset,
    mockBeginRecording,
    mockCanvas,
    mockFinishRecordingAsPicture,
    mockPicture,
    mockPictureRecorder,
    mockRenderVexflowRecordingCommands,
    mockXYWHRect,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.resetModules();
});

describe('ScoreRenderer picture cache helpers', () => {
  it('records a picture for the full content size', () => {
    const module = loadScoreRendererModule();
    const commands = [{ type: 'save' }] as const;
    const fontManager = { kind: 'font-manager' };

    const picture = module.createScorePicture({
      contentSize: { width: 320, height: 180 },
      defaultFont: 'Bravura',
      fontManager: fontManager as never,
      recordedCommands: commands as never,
    });

    expect(picture).toBe(module.mockPicture);
    expect(module.mockPictureRecorder).toHaveBeenCalledTimes(1);
    expect(module.mockXYWHRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(module.mockBeginRecording).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    });
    expect(module.mockRenderVexflowRecordingCommands).toHaveBeenCalledWith(
      module.mockCanvas,
      commands,
      fontManager,
      'Bravura'
    );
    expect(module.mockFinishRecordingAsPicture).toHaveBeenCalledTimes(1);
  });

  it('updates scroll transforms without replaying recording commands', () => {
    const module = loadScoreRendererModule();

    module.createScorePicture({
      contentSize: { width: 300, height: 200 },
      defaultFont: 'Bravura',
      fontManager: {} as never,
      recordedCommands: [] as never,
    });
    module.mockRenderVexflowRecordingCommands.mockClear();

    expect(
      module.createPictureTransform(
        40,
        'document',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: 0 }, { translateY: -40 }]);
    expect(
      module.createPictureTransform(
        500,
        'documentEven',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: 0 }, { translateY: -120 }]);
    expect(
      module.createPictureTransform(
        25,
        'infiniteScore',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: -25 }, { translateY: 0 }]);
    expect(
      module.createPictureTransform(
        -10,
        'infiniteScore',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: 0 }, { translateY: 0 }]);
    expect(module.mockRenderVexflowRecordingCommands).not.toHaveBeenCalled();
  });
});

describe('ScoreRenderer scroll helpers', () => {
  it('uses vertical max scroll for document renderers', () => {
    const module = loadScoreRendererModule();

    expect(
      module.getMaxScroll(
        'document',
        { width: 200, height: 100 },
        { width: 1200, height: 340 }
      )
    ).toBe(240);
    expect(
      module.getMaxScroll(
        'documentEven',
        { width: 200, height: 100 },
        { width: 1200, height: 90 }
      )
    ).toBe(0);
  });

  it('uses horizontal max scroll for infinite score rendering', () => {
    const module = loadScoreRendererModule();

    expect(
      module.getMaxScroll(
        'infiniteScore',
        { width: 200, height: 100 },
        { width: 640, height: 1200 }
      )
    ).toBe(440);
  });

  it('clamps scroll offsets after content or viewport changes', () => {
    const module = loadScoreRendererModule();

    expect(
      module.createClampedScrollOffset(
        500,
        'document',
        { width: 200, height: 100 },
        { width: 200, height: 260 }
      )
    ).toBe(160);
    expect(
      module.createClampedScrollOffset(
        -20,
        'infiniteScore',
        { width: 200, height: 100 },
        { width: 640, height: 100 }
      )
    ).toBe(0);
  });

  it('maps scrollbar thumb offsets to scroll offsets', () => {
    const module = loadScoreRendererModule();
    const metrics = module.getScrollbarMetrics(
      'horizontal',
      { width: 200, height: 100 },
      { width: 800, height: 100 },
      120
    );

    expect(metrics).toEqual({
      maxScroll: 600,
      maxThumbOffset: 90,
      thumbExtent: 30,
    });
    expect(module.getThumbOffsetFromScrollOffset(300, metrics)).toBe(45);
    expect(module.getScrollOffsetFromThumbOffset(45, metrics)).toBe(300);
  });
});
