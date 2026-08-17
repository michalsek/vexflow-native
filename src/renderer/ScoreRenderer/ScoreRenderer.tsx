import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Canvas,
  Group,
  Picture,
  Skia,
  type SkPicture,
  type SkTypefaceFontProvider,
  type Transforms3d,
  useCanvasRef,
} from '@shopify/react-native-skia';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  runOnUI,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import type { VexflowRecordingCommand } from '../../base';
import type { VexflowRecordingGroupIndex } from '../../base/VexflowRecordingIndex';
import { renderVexflowRecordingCommands } from '../../base/VexflowRecordingReplay';
import { resolveScoreColorScheme } from '../colorScheme';
import { insets, renderOptions, spacing } from '../constants';
import { getRenderScale, toViewSize } from '../scale';
import type {
  RendererSize,
  RendererType,
  ScoreItemStyleOverrides,
  ScoreOptions,
  ScoreRendererOptions,
  ScoreRendererProps,
  Viewport,
} from '../types';
import { useScoreRecording } from '../useScoreRecording';
import { createVisibleViewport } from '../viewport';
import ScorePlayhead, { resolvePlayheadStyle } from './ScorePlayhead';
import ScoreScrollbar from './ScoreScrollbar';
import { getMaxScroll, getScrollAxis, useScoreScroll } from './useScoreScroll';

const EMPTY_OPTIONS: ScoreRendererOptions = {};
const EMPTY_SIZE: RendererSize = { width: 0, height: 0 };

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  colorScheme,
  itemStyleOverrides,
  options: userOptions = EMPTY_OPTIONS,
  scrollEnabled = true,
  showScrollbars = true,
  scrollOffset: externalScrollOffset,
  playhead,
  playheadStyle,
  onScrollGeometry,
  onItemsLayout,
}) => {
  const options = useMemo(() => withDefaultOptions(userOptions), [userOptions]);
  const resolvedColorScheme = useMemo(
    () => resolveScoreColorScheme(colorScheme),
    [colorScheme]
  );
  const backgroundStyle = useMemo(
    () => ({ backgroundColor: resolvedColorScheme.background }),
    [resolvedColorScheme.background]
  );
  const canvasStyle = useMemo(
    () => StyleSheet.flatten([styles.canvas, backgroundStyle]),
    [backgroundStyle]
  );
  const effectiveRendererType = rendererType ?? 'document';

  const canvasRef = useCanvasRef();
  const [viewportSize, setViewportSize] = useState<RendererSize>(EMPTY_SIZE);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;

    setViewportSize((currentSize) => {
      if (currentSize.width === width && currentSize.height === height) {
        return currentSize;
      }

      return { width, height };
    });
  }, []);
  const hasViewportSize = viewportSize.width > 0 && viewportSize.height > 0;
  const viewport = useMemo(
    () => ({
      x: 0,
      y: 0,
      width: viewportSize.width,
      height: viewportSize.height,
    }),
    [viewportSize.height, viewportSize.width]
  );
  const {
    commands: recordedCommands,
    groupIndex,
    layoutPlan,
    itemsLayout,
  } = useScoreRecording({
    defaultFont,
    enabled: hasViewportSize,
    fontManager,
    colorScheme: resolvedColorScheme,
    options,
    rendererType: effectiveRendererType,
    score,
    viewport,
  });
  // Scrolling and overflow checks need the view-space content size, not the
  // content-space size that bounds the recorded picture.
  const scale = getRenderScale(options);
  const contentSize = layoutPlan.contentSize;
  const viewContentSize = useMemo(
    () => toViewSize(contentSize, scale),
    [contentSize, scale]
  );

  // Deliver geometry once per recording pass. The callback lives in a ref so
  // a new inline callback identity neither re-fires the effect nor loops when
  // the callback sets parent state.
  const onItemsLayoutRef = useRef(onItemsLayout);
  useEffect(() => {
    onItemsLayoutRef.current = onItemsLayout;
  });
  useEffect(() => {
    if (!hasViewportSize) {
      return;
    }

    onItemsLayoutRef.current?.(itemsLayout);
  }, [itemsLayout, hasViewportSize]);
  const scrollState = useScoreScroll({
    contentSize: viewContentSize,
    externalScrollOffset,
    rendererType: effectiveRendererType,
    scrollEnabled,
    viewportSize,
  });
  const hasScrollableOverflow =
    getMaxScroll(effectiveRendererType, viewportSize, viewContentSize) > 0;

  // Announce the scroll envelope like onItemsLayout: latest callback in a
  // ref, effect keyed only on the geometry it reports.
  const onScrollGeometryRef = useRef(onScrollGeometry);
  useEffect(() => {
    onScrollGeometryRef.current = onScrollGeometry;
  });
  useEffect(() => {
    if (!hasViewportSize) {
      return;
    }

    onScrollGeometryRef.current?.({
      axis: getScrollAxis(effectiveRendererType),
      viewportSize,
      contentSize: viewContentSize,
      maxScroll: getMaxScroll(
        effectiveRendererType,
        viewportSize,
        viewContentSize
      ),
    });
  }, [effectiveRendererType, hasViewportSize, viewContentSize, viewportSize]);

  const resolvedPlayheadStyle = useMemo(
    () => resolvePlayheadStyle(playheadStyle, resolvedColorScheme.foreground),
    [playheadStyle, resolvedColorScheme.foreground]
  );

  const viewportClip = useMemo(
    () => Skia.XYWHRect(0, 0, viewportSize.width, viewportSize.height),
    [viewportSize.height, viewportSize.width]
  );

  // The unstyled base picture is recorded once per recording pass, even when
  // itemStyleOverrides is provided: overridden items are drawn OVER their
  // base-colored twins by ScoreOverlayPicture, so override writes never
  // re-record the full score.
  const picture = useMemo(() => {
    if (!hasViewportSize) {
      return undefined;
    }

    return createScorePicture({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands,
    });
  }, [
    contentSize,
    defaultFont,
    fontManager,
    hasViewportSize,
    recordedCommands,
  ]);
  useEffect(() => {
    if (!picture) {
      return;
    }

    // Cleanup runs after the commit that swapped in the successor picture (or
    // on unmount); the render thread holds its own ref while a frame is in
    // flight, so releasing the JS ref here is safe.
    return () => picture.dispose();
  }, [picture]);

  // Destructure so the worklet below doesn't capture the whole scrollState —
  // the PanGesture inside it is not serializable and would crash the worklet.
  const { scrollOffset } = scrollState;
  const pictureTransform = useDerivedValue(() => {
    return createPictureTransform(
      scrollOffset.value,
      effectiveRendererType,
      { width: viewportSize.width, height: viewportSize.height },
      viewContentSize,
      scale
    );
  }, [
    effectiveRendererType,
    scale,
    scrollOffset,
    viewContentSize,
    viewportSize.height,
    viewportSize.width,
  ]);

  return (
    <View style={[styles.container, backgroundStyle]}>
      <GestureDetector gesture={scrollState.panGesture}>
        <View
          style={[styles.gestureSurface, backgroundStyle]}
          onLayout={handleLayout}
        >
          <Canvas style={canvasStyle} ref={canvasRef}>
            <Group clip={viewportClip}>
              <Group transform={pictureTransform}>
                {picture ? <Picture picture={picture} /> : null}
                {itemStyleOverrides && hasViewportSize ? (
                  <ScoreOverlayPicture
                    contentSize={contentSize}
                    defaultFont={defaultFont}
                    fontManager={fontManager}
                    groupIndex={groupIndex}
                    itemStyleOverrides={itemStyleOverrides}
                  />
                ) : null}
              </Group>
              {playhead ? (
                <ScorePlayhead
                  playhead={playhead}
                  scrollOffset={scrollState.scrollOffset}
                  rendererType={effectiveRendererType}
                  viewportSize={scrollState.viewportSize}
                  contentSize={scrollState.contentSize}
                  style={resolvedPlayheadStyle}
                />
              ) : null}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {showScrollbars && hasScrollableOverflow ? (
        <ScoreScrollbar
          axis={scrollState.axis}
          contentSize={scrollState.contentSize}
          enabled={scrollEnabled}
          scrollOffset={scrollState.scrollOffset}
          style={
            scrollState.axis === 'horizontal'
              ? styles.horizontalScrollbar
              : styles.verticalScrollbar
          }
          viewportSize={scrollState.viewportSize}
        />
      ) : null}
    </View>
  );
};

export default memo(ScoreRenderer);

function nowMsWorklet(): number {
  'worklet';

  return globalThis.performance?.now?.() ?? 0;
}

interface OverlayDisposalState {
  /** The last real (non-empty) overlay picture the mapper returned. */
  prev: SkPicture | null;
  /** Superseded pictures awaiting disposal, oldest first. */
  pending: SkPicture[];
}

interface OverlayProfileState {
  windowStartMs: number;
  maxMs: number;
  count: number;
}

/**
 * Draws the style-overridden items on top of the static base picture. Only
 * the overridden groups' commands are re-recorded per override write — the
 * full command array never reaches the UI runtime. Overridden items are drawn
 * opaque over their base-colored twins at identical coordinates; with an
 * opaque override color the result matches an in-place recolor up to a ≤1px
 * anti-aliasing fringe of base ink at glyph edges.
 */
function ScoreOverlayPicture({
  contentSize,
  defaultFont,
  fontManager,
  groupIndex,
  itemStyleOverrides,
}: {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  groupIndex: VexflowRecordingGroupIndex;
  itemStyleOverrides: NonNullable<ScoreRendererProps['itemStyleOverrides']>;
}) {
  const emptyPicture = useMemo(getEmptyOverlayPicture, []);
  const disposal = useSharedValue<OverlayDisposalState>({
    prev: null,
    pending: [],
  });
  const profile = useSharedValue<OverlayProfileState>({
    windowStartMs: 0,
    maxMs: 0,
    count: 0,
  });
  // Computed on JS and captured: __DEV__ is not guaranteed to exist on the
  // worklet runtime.
  const enableProfiling = isDevBuild();

  const picture = useDerivedValue<SkPicture>(() => {
    const overrides = itemStyleOverrides.value;

    let commands: VexflowRecordingCommand[] | null = null;
    for (const groupId in overrides) {
      const group = groupIndex[groupId];
      if (group != null) {
        (commands ??= []).push(...group);
      }
    }

    if (commands == null) {
      retireOverlayPicture(disposal, null);
      return emptyPicture;
    }

    const start = enableProfiling ? nowMsWorklet() : 0;
    const next = createScorePictureWorklet({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands: commands,
      styleOverrides: overrides,
    });

    if (enableProfiling) {
      logOverlayProfile(profile, commands.length, nowMsWorklet() - start);
    }

    retireOverlayPicture(disposal, next);
    return next;
  }, [
    contentSize,
    defaultFont,
    disposal,
    emptyPicture,
    enableProfiling,
    fontManager,
    groupIndex,
    itemStyleOverrides,
    profile,
  ]);

  useEffect(() => {
    return () => {
      runOnUI(disposeOverlayPictures)(disposal);
    };
  }, [disposal]);

  return <Picture picture={picture} />;
}

let emptyOverlayPicture: SkPicture | null = null;

/**
 * Shared blank picture returned while no override matches. One per app,
 * never disposed — PictureProps.picture is non-nullable and declarative Skia
 * can't unmount from the UI thread, so an "empty" frame needs a real picture.
 */
function getEmptyOverlayPicture(): SkPicture {
  if (emptyOverlayPicture == null) {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    emptyOverlayPicture = recorder.finishRecordingAsPicture();
  }

  return emptyOverlayPicture;
}

/**
 * Two-generation deferred disposal: the retiring picture may still be
 * referenced by the committed Picture node or a frame in flight, so only
 * pictures two supersessions old are disposed. The shared blank picture never
 * enters the ring (`next === null` marks an empty frame).
 */
function retireOverlayPicture(
  disposal: SharedValue<OverlayDisposalState>,
  next: SkPicture | null
) {
  'worklet';

  if (typeof _WORKLET === 'undefined' || !_WORKLET) {
    // The mapper's seed run happens on JS against a copy of the state; writes
    // here would never be seen by the UI runtime, so skip tracking entirely
    // (leaks at most one picture per mapper re-creation).
    return;
  }

  const state = disposal.value;

  if (state.prev != null) {
    state.pending.push(state.prev);

    while (state.pending.length > 2) {
      state.pending.shift()?.dispose();
    }
  }

  state.prev = next;
}

function disposeOverlayPictures(disposal: SharedValue<OverlayDisposalState>) {
  'worklet';

  const state = disposal.value;

  for (const pending of state.pending) {
    pending.dispose();
  }
  state.pending.length = 0;

  state.prev?.dispose();
  state.prev = null;
}

/** Throttled (≤1/s) UI-thread record timing; dev builds only. */
function logOverlayProfile(
  profile: SharedValue<OverlayProfileState>,
  commandCount: number,
  durationMs: number
) {
  'worklet';

  const stats = profile.value;
  stats.count += 1;

  if (durationMs > stats.maxMs) {
    stats.maxMs = durationMs;
  }

  const now = nowMsWorklet();

  if (now - stats.windowStartMs < 1000) {
    return;
  }

  console.info('[ScoreRenderer] overlay profile', {
    commandCount,
    maxMs: Math.round(stats.maxMs * 10) / 10,
    count: stats.count,
  });

  stats.windowStartMs = now;
  stats.maxMs = 0;
  stats.count = 0;
}

export function createScorePicture({
  contentSize,
  defaultFont,
  fontManager,
  recordedCommands,
  styleOverrides,
}: {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  recordedCommands: readonly VexflowRecordingCommand[];
  styleOverrides?: ScoreItemStyleOverrides;
}) {
  try {
    const start = nowMs();
    const picture = createScorePictureWorklet({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands,
      styleOverrides,
    });

    logScorePictureProfile({
      commandCount: recordedCommands.length,
      contentSize,
      durationMs: nowMs() - start,
    });

    return picture;
  } catch (error) {
    console.error('ScoreRenderer picture render failed', error);
    throw error;
  }
}

function createScorePictureWorklet({
  contentSize,
  defaultFont,
  fontManager,
  recordedCommands,
  styleOverrides,
}: {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  recordedCommands: readonly VexflowRecordingCommand[];
  styleOverrides?: ScoreItemStyleOverrides;
}): SkPicture {
  'worklet';

  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(0, 0, contentSize.width, contentSize.height)
  );

  renderVexflowRecordingCommands(
    canvas,
    recordedCommands,
    fontManager,
    defaultFont,
    styleOverrides
  );

  return recorder.finishRecordingAsPicture();
}

/**
 * Maps the content-space picture into the view. Skia applies the transform
 * array right-to-left, so the trailing scale entry runs first and the
 * translate entries then shift by the view-space scroll offset; `contentSize`
 * must be the view-space content size.
 */
export function createPictureTransform(
  scrollOffset: number,
  rendererType: RendererType,
  viewport: Viewport,
  contentSize: RendererSize,
  scale: number = 1
): Transforms3d {
  'worklet';

  const visibleViewport = createVisibleViewport(
    scrollOffset,
    rendererType,
    viewport,
    contentSize
  );

  const transform: Transforms3d = [
    {
      translateX: visibleViewport.x === 0 ? 0 : -visibleViewport.x,
    },
    {
      translateY: visibleViewport.y === 0 ? 0 : -visibleViewport.y,
    },
  ];

  if (scale !== 1) {
    transform.push({ scale });
  }

  return transform;
}

function withDefaultOptions(options: ScoreRendererOptions): ScoreOptions {
  return {
    insets: { ...insets, ...(options.insets || {}) },
    spacing: { ...spacing, ...(options.spacing || {}) },
    render: { ...renderOptions, ...(options.render || {}) },
  };
}

function logScorePictureProfile({
  commandCount,
  contentSize,
  durationMs,
}: {
  commandCount: number;
  contentSize: RendererSize;
  durationMs: number;
}) {
  if (!isDevBuild()) {
    return;
  }

  console.info('[ScoreRenderer] picture profile', {
    contentSize,
    commandCount,
    durationMs: roundMs(durationMs),
  });
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function isDevBuild(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return false;
  }

  return typeof __DEV__ === 'undefined' ? false : __DEV__;
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  gestureSurface: {
    flex: 1,
  },
  horizontalScrollbar: {
    bottom: 12,
    height: 6,
    left: 12,
    right: 12,
  },
  verticalScrollbar: {
    bottom: 20,
    right: 2,
    top: 4,
    width: 6,
  },
});
