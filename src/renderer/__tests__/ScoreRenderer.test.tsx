import { afterEach, describe, expect, it, jest } from '@jest/globals';

function loadScoreRendererModule() {
  jest.resetModules();

  const React = jest.requireActual<typeof import('react')>('react');
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
  const mockUseScoreRecording = jest.fn(() => ({
    commands: [],
    layoutPlan: { contentSize: { height: 0, width: 0 } },
  }));
  let viewportState = { height: 0, width: 0 };
  const mockSetViewportSize = jest.fn(
    (
      nextValue:
        | typeof viewportState
        | ((currentValue: typeof viewportState) => typeof viewportState)
    ) => {
      viewportState =
        typeof nextValue === 'function' ? nextValue(viewportState) : nextValue;
    }
  );

  jest.doMock('react', () => ({
    ...React,
    memo: jest.fn((component: unknown) => component),
    useCallback: jest.fn((factory: () => unknown) => factory),
    useEffect: jest.fn((effect: () => void) => effect()),
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useState: jest.fn(() => [viewportState, mockSetViewportSize]),
  }));

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
      flatten: (styles: unknown) =>
        Array.isArray(styles) ? Object.assign({}, ...styles) : styles,
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

  jest.doMock('../useScoreRecording', () => ({
    useScoreRecording: mockUseScoreRecording,
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
    ScoreRenderer: module.default as unknown as (props: unknown) => unknown,
    mockBeginRecording,
    mockCanvas,
    mockFinishRecordingAsPicture,
    mockPicture,
    mockPictureRecorder,
    mockRenderVexflowRecordingCommands,
    mockSetViewportSize,
    mockUseScoreRecording,
    mockXYWHRect,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.resetModules();
});

describe('ScoreRenderer picture cache helpers', () => {
  it('uses live layout size for score recording viewport', () => {
    const module = loadScoreRendererModule();
    const score = {
      id: 'score-renderer-live-layout',
      defaults: { meter: { beats: 4, beatUnit: 4 } },
      staves: [],
    };
    const fontManager = { kind: 'font-manager' };

    const initialTree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      score,
    });

    expect(module.mockUseScoreRecording).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: false,
        viewport: { x: 0, y: 0, width: 0, height: 0 },
      })
    );
    expect(module.mockPictureRecorder).not.toHaveBeenCalled();

    getScoreRendererGestureSurface(initialTree).props.onLayout({
      nativeEvent: { layout: { height: 612, width: 393 } },
    });

    expect(module.mockSetViewportSize).toHaveBeenCalledTimes(1);

    module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      score,
    });

    expect(module.mockUseScoreRecording).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        viewport: { x: 0, y: 0, width: 393, height: 612 },
      })
    );
    expect(module.mockPictureRecorder).toHaveBeenCalledTimes(1);
  });

  it('passes the resolved color scheme into score recording', () => {
    const module = loadScoreRendererModule();
    const score = {
      id: 'score-renderer-color-scheme',
      defaults: { meter: { beats: 4, beatUnit: 4 } },
      staves: [],
    };
    const fontManager = { kind: 'font-manager' };

    module.ScoreRenderer({
      colorScheme: {
        background: '#111827',
        foreground: '#F8FAFC',
        ledgerLine: '#CBD5E1',
      },
      defaultFont: 'Bravura',
      fontManager,
      score,
    });

    expect(module.mockUseScoreRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        colorScheme: {
          background: '#111827',
          foreground: '#F8FAFC',
          ledgerLine: '#CBD5E1',
        },
      })
    );
  });

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

  it('keeps document bottom scroll range tied to the live viewport height', () => {
    const module = loadScoreRendererModule();
    const viewportSize = { width: 393, height: 612 };
    const contentSize = { width: 393, height: 980 };

    expect(module.getMaxScroll('documentEven', viewportSize, contentSize)).toBe(
      368
    );
    expect(
      module.createClampedScrollOffset(
        2000,
        'document',
        viewportSize,
        contentSize
      )
    ).toBe(368);
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

function getScoreRendererGestureSurface(element: unknown): {
  props: {
    onLayout: (event: {
      nativeEvent: { layout: { height: number; width: number } };
    }) => void;
  };
} {
  const root = element as {
    props: {
      children: [
        {
          props: {
            children: {
              props: {
                onLayout: (event: {
                  nativeEvent: { layout: { height: number; width: number } };
                }) => void;
              };
            };
          };
        }
      ];
    };
  };

  return root.props.children[0].props.children;
}
