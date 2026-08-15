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
  const mockRRectXY = jest.fn(
    (rect: Record<string, number>, rx: number, ry: number) => ({
      rect,
      rx,
      ry,
    })
  );
  const mockRenderVexflowRecordingCommands = jest.fn();
  const mockUseDerivedValue = jest.fn((factory: () => unknown) => ({
    value: factory(),
  }));
  const mockUseScoreRecording = jest.fn(() => ({
    commands: [],
    layoutPlan: { contentSize: { height: 0, width: 0 } },
    itemsLayout: {
      items: {},
      measures: [],
      contentSize: { height: 0, width: 0 },
    } as import('../types').ScoreItemsLayout,
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

  /* Deps-aware useEffect and slot-stable useRef mocks, close enough to React
   * to verify effect dependency contracts. */
  const effectPrevDeps: Array<readonly unknown[] | undefined> = [];
  let pendingEffects: Array<{
    index: number;
    effect: () => void;
    deps?: readonly unknown[];
  }> = [];
  let effectCursor = 0;
  const mockUseEffect = jest.fn(
    (effect: () => void, deps?: readonly unknown[]) => {
      pendingEffects.push({ index: effectCursor, effect, deps });
      effectCursor += 1;
    }
  );
  const refSlots: Array<{ current: unknown }> = [];
  let refCursor = 0;
  const mockUseRef = jest.fn((initialValue: unknown) => {
    const index = refCursor;
    refCursor += 1;
    refSlots[index] ??= { current: initialValue };
    return refSlots[index];
  });
  const flushEffects = () => {
    const queue = pendingEffects;
    pendingEffects = [];

    for (const { index, effect, deps } of queue) {
      const previousDeps = effectPrevDeps[index];
      const shouldRun =
        !deps ||
        !previousDeps ||
        deps.length !== previousDeps.length ||
        deps.some((dep, depIndex) => !Object.is(dep, previousDeps[depIndex]));

      if (shouldRun) {
        effectPrevDeps[index] = deps;
        effect();
      }
    }
  };

  jest.doMock('react', () => ({
    ...React,
    memo: jest.fn((component: unknown) => component),
    useCallback: jest.fn((factory: () => unknown) => factory),
    useEffect: mockUseEffect,
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useRef: mockUseRef,
    useState: jest.fn(() => [viewportState, mockSetViewportSize]),
  }));

  jest.doMock('@shopify/react-native-skia', () => ({
    Canvas: 'Canvas',
    Group: 'Group',
    Picture: 'Picture',
    RoundedRect: 'RoundedRect',
    Skia: {
      PictureRecorder: mockPictureRecorder,
      RRectXY: mockRRectXY,
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
    useDerivedValue: mockUseDerivedValue,
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

  /* Renders ScoreRenderer with hook cursors reset per render and queued
   * effects flushed afterwards. */
  const ScoreRendererImpl = module.default as unknown as (
    props: unknown
  ) => unknown;
  const renderScoreRenderer = (props: unknown) => {
    effectCursor = 0;
    refCursor = 0;
    const tree = ScoreRendererImpl(props);
    flushEffects();
    return tree;
  };

  return {
    clampOffset: module.clampOffset,
    createClampedScrollOffset: module.createClampedScrollOffset,
    createPictureTransform: module.createPictureTransform,
    createPlayheadRect: module.createPlayheadRect,
    createScorePicture: module.createScorePicture,
    resolvePlayheadStyle: module.resolvePlayheadStyle,
    getMaxScroll: module.getMaxScroll,
    getScrollbarMetrics: module.getScrollbarMetrics,
    getScrollOffsetFromThumbOffset: module.getScrollOffsetFromThumbOffset,
    getThumbOffsetFromScrollOffset: module.getThumbOffsetFromScrollOffset,
    ScoreRenderer: renderScoreRenderer,
    mockBeginRecording,
    mockCanvas,
    mockFinishRecordingAsPicture,
    mockPicture,
    mockPictureRecorder,
    mockRenderVexflowRecordingCommands,
    mockRRectXY,
    mockSetViewportSize,
    mockUseDerivedValue,
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
      'Bravura',
      undefined
    );
    expect(module.mockFinishRecordingAsPicture).toHaveBeenCalledTimes(1);
  });

  it('passes item style overrides into score picture replay', () => {
    const module = loadScoreRendererModule();
    const commands = [{ type: 'save' }] as const;
    const fontManager = { kind: 'font-manager' };
    const styleOverrides = {
      'item-1': { color: '#22C55E', shadowColor: '#22C55E', shadowBlur: 6 },
    };

    module.createScorePicture({
      contentSize: { width: 320, height: 180 },
      defaultFont: 'Bravura',
      fontManager: fontManager as never,
      recordedCommands: commands as never,
      styleOverrides,
    });

    expect(module.mockRenderVexflowRecordingCommands).toHaveBeenCalledWith(
      module.mockCanvas,
      commands,
      fontManager,
      'Bravura',
      styleOverrides
    );
  });

  it('uses the animated picture branch when item style overrides are provided', () => {
    const module = loadScoreRendererModule();
    const score = {
      id: 'score-renderer-animated-overrides',
      defaults: { meter: { beats: 4, beatUnit: 4 } },
      staves: [],
    };
    const fontManager = { kind: 'font-manager' };
    const itemStyleOverrides = {
      value: { 'item-1': { fillColor: '#22C55E' } },
    };

    const initialTree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      itemStyleOverrides,
      score,
    });

    expect(
      findElementByTypeName(initialTree, 'AnimatedScorePicture')
    ).toBeUndefined();
    expect(module.mockPictureRecorder).not.toHaveBeenCalled();

    getScoreRendererGestureSurface(initialTree).props.onLayout({
      nativeEvent: { layout: { height: 612, width: 393 } },
    });

    const tree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      itemStyleOverrides,
      score,
    });
    const animatedPicture = findElementByTypeName(tree, 'AnimatedScorePicture');
    expect(animatedPicture?.props.itemStyleOverrides).toBe(itemStyleOverrides);
    expect(module.mockPictureRecorder).not.toHaveBeenCalled();
  });

  it('fires onItemsLayout with the recorded geometry once the viewport has size', () => {
    const module = loadScoreRendererModule();
    const itemsLayout = makeItemsLayoutFixture();
    module.mockUseScoreRecording.mockReturnValue({
      commands: [],
      layoutPlan: { contentSize: { width: 393, height: 116 } },
      itemsLayout,
    });
    const onItemsLayout = jest.fn();
    const score = {
      id: 'score-renderer-items-layout',
      defaults: { meter: { beats: 4, beatUnit: 4 } },
      staves: [],
    };
    const fontManager = { kind: 'font-manager' };

    const initialTree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      onItemsLayout,
      score,
    });

    // The zero-size viewport guard keeps the callback silent before layout.
    expect(onItemsLayout).not.toHaveBeenCalled();

    getScoreRendererGestureSurface(initialTree).props.onLayout({
      nativeEvent: { layout: { height: 116, width: 393 } },
    });

    module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      onItemsLayout,
      score,
    });

    expect(onItemsLayout).toHaveBeenCalledTimes(1);
    expect(onItemsLayout).toHaveBeenCalledWith(itemsLayout);
  });

  it('delivers geometry once per recording pass even when the callback identity changes every render', () => {
    const module = loadScoreRendererModule();
    const itemsLayout = makeItemsLayoutFixture();
    module.mockUseScoreRecording.mockReturnValue({
      commands: [],
      layoutPlan: { contentSize: { width: 393, height: 116 } },
      itemsLayout,
    });
    const received = jest.fn();
    const score = {
      id: 'score-renderer-inline-callback',
      defaults: { meter: { beats: 4, beatUnit: 4 } },
      staves: [],
    };
    const fontManager = { kind: 'font-manager' };
    // A parent passing a new inline callback on every render — the shape that
    // would loop if the delivery effect depended on the callback identity.
    const renderWithInlineCallback = (tag: number) =>
      module.ScoreRenderer({
        defaultFont: 'Bravura',
        fontManager,
        onItemsLayout: (layout: unknown) => received(tag, layout),
        score,
      });

    const initialTree = renderWithInlineCallback(1);
    getScoreRendererGestureSurface(initialTree).props.onLayout({
      nativeEvent: { layout: { height: 116, width: 393 } },
    });
    renderWithInlineCallback(2);

    // One delivery per recording pass, through the latest callback.
    expect(received).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledWith(2, itemsLayout);

    // A new callback identity alone must not re-deliver.
    renderWithInlineCallback(3);
    expect(received).toHaveBeenCalledTimes(1);

    // A new recording pass delivers exactly once more.
    const nextItemsLayout = makeItemsLayoutFixture();
    module.mockUseScoreRecording.mockReturnValue({
      commands: [],
      layoutPlan: { contentSize: { width: 393, height: 116 } },
      itemsLayout: nextItemsLayout,
    });
    renderWithInlineCallback(4);
    expect(received).toHaveBeenCalledTimes(2);
    expect(received).toHaveBeenLastCalledWith(4, nextItemsLayout);
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

  it('appends the render scale after the scroll translate (content scaled first)', () => {
    const module = loadScoreRendererModule();

    // View content 200 minus viewport 80 clamps the offset to 120; the
    // trailing scale entry applies before the translate.
    expect(
      module.createPictureTransform(
        500,
        'document',
        { width: 100, height: 80 },
        { width: 100, height: 200 },
        0.5
      )
    ).toEqual([{ translateX: 0 }, { translateY: -120 }, { scale: 0.5 }]);
    expect(
      module.createPictureTransform(
        25,
        'infiniteScore',
        { width: 100, height: 80 },
        { width: 300, height: 80 },
        0.5
      )
    ).toEqual([{ translateX: -25 }, { translateY: 0 }, { scale: 0.5 }]);
    // Scale 1 keeps the pre-scale transform shape byte-identical.
    expect(
      module.createPictureTransform(
        40,
        'document',
        { width: 100, height: 80 },
        { width: 300, height: 200 },
        1
      )
    ).toEqual([{ translateX: 0 }, { translateY: -40 }]);
  });

  it('records the picture at content-space size while scrolling in view space', () => {
    const module = loadScoreRendererModule();
    // At scale 0.5 the view content size is 400x700 — vertically scrollable
    // inside a 393x612 viewport.
    module.mockUseScoreRecording.mockReturnValue({
      commands: [],
      layoutPlan: { contentSize: { width: 800, height: 1400 } },
      itemsLayout: {
        items: {},
        measures: [],
        contentSize: { width: 400, height: 700 },
      } as import('../types').ScoreItemsLayout,
    });
    const score = {
      id: 'score-renderer-scaled',
      defaults: { meter: { beats: 4, beatUnit: 4 } },
      staves: [],
    };
    const fontManager = { kind: 'font-manager' };
    const props = {
      defaultFont: 'Bravura',
      fontManager,
      options: { render: { scale: 0.5 } },
      score,
    };

    const initialTree = module.ScoreRenderer(props);
    getScoreRendererGestureSurface(initialTree).props.onLayout({
      nativeEvent: { layout: { height: 612, width: 393 } },
    });
    module.ScoreRenderer(props);

    // Picture recorded with the CONTENT-space cull rect.
    expect(module.mockBeginRecording).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 800,
      height: 1400,
    });

    // The picture transform derived value composes the view-space scroll
    // translate with the render scale.
    const transformValues = module.mockUseDerivedValue.mock.results
      .map((result) => (result.value as { value: unknown }).value)
      .filter((value) => Array.isArray(value));
    expect(transformValues).toContainEqual([
      { translateX: 0 },
      { translateY: 0 },
      { scale: 0.5 },
    ]);
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

describe('ScoreRenderer controlled scroll and scroll geometry', () => {
  const score = {
    id: 'score-renderer-controlled-scroll',
    defaults: { meter: { beats: 4, beatUnit: 4 } },
    staves: [],
  };
  const fontManager = { kind: 'font-manager' };

  it('drives the picture transform from an external scroll offset value', () => {
    const module = loadScoreRendererModule();
    module.mockUseScoreRecording.mockReturnValue({
      commands: [],
      layoutPlan: { contentSize: { width: 900, height: 116 } },
      itemsLayout: makeItemsLayoutFixture(),
    });
    const scrollOffset = { value: 25 };

    const initialTree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      rendererType: 'infiniteScore',
      score,
      scrollOffset,
    });
    getScoreRendererGestureSurface(initialTree).props.onLayout({
      nativeEvent: { layout: { height: 116, width: 393 } },
    });
    const tree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      rendererType: 'infiniteScore',
      score,
      scrollOffset,
    });

    const clipGroup = (
      tree as { props: { children: unknown[] } }
    ).props.children.find(Boolean) as never;
    const transformGroup = findElementByProp(clipGroup, 'transform');
    expect(
      (transformGroup?.props.transform as { value: unknown }).value
    ).toEqual([{ translateX: -25 }, { translateY: 0 }]);
  });

  it('fires onScrollGeometry with the scroll envelope and re-fires only when it changes', () => {
    const module = loadScoreRendererModule();
    module.mockUseScoreRecording.mockReturnValue({
      commands: [],
      layoutPlan: { contentSize: { width: 900, height: 116 } },
      itemsLayout: makeItemsLayoutFixture(),
    });
    const onScrollGeometry = jest.fn();
    const render = () =>
      module.ScoreRenderer({
        defaultFont: 'Bravura',
        fontManager,
        onScrollGeometry,
        rendererType: 'infiniteScore',
        score,
      });

    const initialTree = render();
    // Zero-size viewport keeps the callback silent, like onItemsLayout.
    expect(onScrollGeometry).not.toHaveBeenCalled();

    getScoreRendererGestureSurface(initialTree).props.onLayout({
      nativeEvent: { layout: { height: 116, width: 393 } },
    });
    render();

    expect(onScrollGeometry).toHaveBeenCalledTimes(1);
    expect(onScrollGeometry).toHaveBeenCalledWith({
      axis: 'horizontal',
      viewportSize: { width: 393, height: 116 },
      contentSize: { width: 900, height: 116 },
      maxScroll: 900 - 393,
    });

    // Unchanged geometry does not re-fire.
    render();
    expect(onScrollGeometry).toHaveBeenCalledTimes(1);
  });
});

describe('ScorePlayhead', () => {
  const score = {
    id: 'score-renderer-playhead',
    defaults: { meter: { beats: 4, beatUnit: 4 } },
    staves: [],
  };
  const fontManager = { kind: 'font-manager' };

  it('renders the playhead overlay only when the prop is provided', () => {
    const module = loadScoreRendererModule();

    const bareTree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      score,
    });
    expect(findElementByTypeName(bareTree, 'ScorePlayhead')).toBeUndefined();

    const playhead = { value: { x: 120, y: 20, height: 80 } };
    const tree = module.ScoreRenderer({
      defaultFont: 'Bravura',
      fontManager,
      playhead,
      score,
    });
    const overlay = findElementByTypeName(tree, 'ScorePlayhead');
    expect(overlay?.props.playhead).toBe(playhead);
  });

  it('resolves style defaults from the color scheme foreground', () => {
    const module = loadScoreRendererModule();

    expect(module.resolvePlayheadStyle(undefined, '#123456')).toEqual({
      color: '#123456',
      width: 2,
      borderRadius: 1,
      opacity: 0.9,
    });
    expect(
      module.resolvePlayheadStyle(
        { color: '#FF0000', width: 4, opacity: 0.5 },
        '#123456'
      )
    ).toEqual({ color: '#FF0000', width: 4, borderRadius: 2, opacity: 0.5 });
  });

  it('maps a playhead state to an on-screen rect per scroll axis', () => {
    const module = loadScoreRendererModule();
    const viewport = { width: 393, height: 116 };
    const content = { width: 900, height: 400 };
    const state = { x: 120, y: 20, height: 80 };

    // Horizontal: the scroll offset shifts x, the width centers on state.x.
    expect(
      module.createPlayheadRect(
        state,
        30,
        'infiniteScore',
        viewport,
        content,
        2,
        1
      )
    ).toEqual({
      rect: { x: 120 - 1 - 30, y: 20, width: 2, height: 80 },
      rx: 1,
      ry: 1,
    });

    // Vertical: the scroll offset shifts y instead.
    expect(
      module.createPlayheadRect(
        state,
        30,
        'documentEven',
        viewport,
        content,
        2,
        1
      )
    ).toEqual({
      rect: { x: 120 - 1, y: 20 - 30, width: 2, height: 80 },
      rx: 1,
      ry: 1,
    });

    // Null hides by collapsing to a zero rect.
    expect(
      module.createPlayheadRect(
        null,
        30,
        'infiniteScore',
        viewport,
        content,
        2,
        1
      )
    ).toEqual({ rect: { x: 0, y: 0, width: 0, height: 0 }, rx: 0, ry: 0 });
  });
});

/** Fresh single-staff geometry fixture — a new object per call so tests can
 * distinguish "same recording pass" (same identity) from a new pass. */
function makeItemsLayoutFixture(): import('../types').ScoreItemsLayout {
  return {
    items: { 'item-1': { x: 60, width: 12, headCenterX: 65, measureIndex: 0 } },
    measures: [
      {
        groupId: 'staff:staff-1',
        staffId: 'staff-1',
        measureIndex: 0,
        systemIndex: 0,
        x: 24,
        width: 345,
        staveNoteStartX: 34,
        staveNoteEndX: 369,
        y: 18,
        height: 92,
        staveLineTopY: 30,
        staveLineBottomY: 70,
      },
    ],
    contentSize: { width: 393, height: 116 },
  };
}

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

function findElementByProp(
  element: unknown,
  propName: string
): { props: Record<string, unknown> } | undefined {
  if (!element || typeof element !== 'object') {
    return undefined;
  }

  const reactElement = element as { props?: Record<string, unknown> };

  if (reactElement.props && reactElement.props[propName] !== undefined) {
    return reactElement as { props: Record<string, unknown> };
  }

  const children = reactElement.props?.children;

  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findElementByProp(child, propName);

    if (match) {
      return match;
    }
  }

  return undefined;
}

function findElementByTypeName(
  element: unknown,
  typeName: string
): { props: Record<string, unknown> } | undefined {
  if (!element || typeof element !== 'object') {
    return undefined;
  }

  const reactElement = element as {
    props?: { children?: unknown };
    type?: { name?: string } | string;
  };

  if (
    typeof reactElement.type === 'function' &&
    reactElement.type.name === typeName
  ) {
    return reactElement as { props: Record<string, unknown> };
  }

  const { children } = reactElement.props ?? {};

  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findElementByTypeName(child, typeName);

      if (match) {
        return match;
      }
    }

    return undefined;
  }

  return findElementByTypeName(children, typeName);
}
