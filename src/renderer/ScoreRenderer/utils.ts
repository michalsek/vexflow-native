import {
  Skia,
  type SkPicture,
  type SkTypefaceFontProvider,
  type Transforms3d,
} from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import FontManager from '../../base/FontManager';
import { renderVexflowRecordingCommands } from '../../base/VexflowRecordingReplay';
import { isVexflowNativeDebugEnabled } from '../../shared/debug';
import { insets, renderOptions, spacing } from '../constants';
import type {
  RendererSize,
  RendererType,
  ScoreOptions,
  ScoreRendererOptions,
  Viewport,
} from '../types';
import { createVisibleViewport } from '../viewport';
import type {
  CreateScorePictureParams,
  OverlayDisposalState,
  OverlayFontManagerSlot,
  OverlayProfileState,
} from './types';

// The reanimated plugin rewrites 'worklet' function declarations into
// non-hoisted assignments, so nowMsWorklet must precede the worklets below
// that call it.
export function nowMsWorklet(): number {
  'worklet';

  return globalThis.performance?.now?.() ?? 0;
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

export function withDefaultOptions(
  options: ScoreRendererOptions
): ScoreOptions {
  return {
    insets: { ...insets, ...(options.insets || {}) },
    spacing: { ...spacing, ...(options.spacing || {}) },
    render: { ...renderOptions, ...(options.render || {}) },
  };
}

export function createScorePicture({
  contentSize,
  defaultFont,
  fontManager,
  recordedCommands,
  replayFontManager,
  styleOverrides,
}: CreateScorePictureParams) {
  try {
    const start = nowMs();
    const picture = createScorePictureWorklet({
      contentSize,
      defaultFont,
      fontManager,
      recordedCommands,
      replayFontManager,
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

export function createScorePictureWorklet({
  contentSize,
  defaultFont,
  fontManager,
  recordedCommands,
  replayFontManager,
  styleOverrides,
}: CreateScorePictureParams): SkPicture {
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
    styleOverrides,
    replayFontManager
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

/**
 * Runtime-local lazy FontManager: worklets cannot copy a class instance into
 * a closure, so each runtime constructs its own on first use and keeps it in
 * the slot (slot contents never cross runtimes; only the initial `null` is
 * serialized).
 */
export function getOverlayFontManager(
  slot: SharedValue<OverlayFontManagerSlot>,
  fontProvider: SkTypefaceFontProvider,
  defaultFont: string
): FontManager {
  'worklet';

  const state = slot.value;

  return (state.manager ??= new FontManager(fontProvider, defaultFont));
}

let emptyOverlayPicture: SkPicture | null = null;

/**
 * Shared blank picture returned while no override matches. One per app,
 * never disposed — PictureProps.picture is non-nullable and declarative Skia
 * can't unmount from the UI thread, so an "empty" frame needs a real picture.
 */
export function getEmptyOverlayPicture(): SkPicture {
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
export function retireOverlayPicture(
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

export function disposeOverlayPictures(
  disposal: SharedValue<OverlayDisposalState>
) {
  'worklet';

  const state = disposal.value;

  for (const pending of state.pending) {
    pending.dispose();
  }
  state.pending.length = 0;

  state.prev?.dispose();
  state.prev = null;
}

/** Throttled (≤1/s) UI-thread record timing; debug flag only. */
export function logOverlayProfile(
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

function logScorePictureProfile({
  commandCount,
  contentSize,
  durationMs,
}: {
  commandCount: number;
  contentSize: RendererSize;
  durationMs: number;
}) {
  if (!isVexflowNativeDebugEnabled()) {
    return;
  }

  console.info('[ScoreRenderer] picture profile', {
    contentSize,
    commandCount,
    durationMs: roundMs(durationMs),
  });
}
