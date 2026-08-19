import { useEffect, useMemo } from 'react';
import { Picture, type SkPicture } from '@shopify/react-native-skia';
import {
  runOnUI,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import type { VexflowRecordingCommand } from '../../base';
import { isVexflowNativeDebugEnabled } from '../../shared/debug';
import type {
  OverlayDisposalState,
  OverlayFontManagerSlot,
  OverlayProfileState,
  ScoreOverlayPictureProps,
} from './types';
import {
  createScorePictureWorklet,
  disposeOverlayPictures,
  getEmptyOverlayPicture,
  getOverlayFontManager,
  logOverlayProfile,
  nowMsWorklet,
  retireOverlayPicture,
} from './utils';

/**
 * Draws the style-overridden items on top of the static base picture. Only
 * the overridden groups' commands are re-recorded per override write — the
 * full command array never reaches the UI runtime. Overridden items are drawn
 * opaque over their base-colored twins at identical coordinates; with an
 * opaque override color the result matches an in-place recolor up to a ≤1px
 * anti-aliasing fringe of base ink at glyph edges.
 */
export default function ScoreOverlayPicture({
  contentSize,
  defaultFont,
  fontManager,
  groupIndex,
  itemStyleOverrides,
}: ScoreOverlayPictureProps) {
  const emptyPicture = useMemo(getEmptyOverlayPicture, []);
  // A FontManager instance cannot be serialized into a worklet closure, so
  // each runtime lazily constructs its own in this slot (never crossing
  // runtimes) — its SkFont caches still persist across onsets.
  const fontManagerSlot = useSharedValue<OverlayFontManagerSlot>({
    manager: null,
  });
  const disposal = useSharedValue<OverlayDisposalState>({
    prev: null,
    pending: [],
  });
  const profile = useSharedValue<OverlayProfileState>({
    windowStartMs: 0,
    maxMs: 0,
    count: 0,
  });
  // Read on JS and captured: the debug singleton lives on the JS runtime, so
  // a toggle takes effect on the overlay's next render.
  const enableProfiling = isVexflowNativeDebugEnabled();

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
      replayFontManager: getOverlayFontManager(
        fontManagerSlot,
        fontManager,
        defaultFont
      ),
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
    fontManagerSlot,
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
