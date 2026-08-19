import type {
  SkPicture,
  SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import type { VexflowRecordingCommand } from '../../base';
import type FontManager from '../../base/FontManager';
import type { VexflowRecordingGroupIndex } from '../../base/VexflowRecordingIndex';
import type {
  RendererSize,
  ScoreItemStyleOverrides,
  ScoreRendererProps,
  ScrollAxis,
} from '../types';

export type { ScrollAxis } from '../types';

export type ScoreScrollState = {
  axis: ScrollAxis;
  contentSize: SharedValue<RendererSize>;
  panGesture: GestureType;
  scrollOffset: SharedValue<number>;
  viewportSize: SharedValue<RendererSize>;
};

export interface CreateScorePictureParams {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  recordedCommands: readonly VexflowRecordingCommand[];
  replayFontManager?: FontManager;
  styleOverrides?: ScoreItemStyleOverrides;
}

export interface ScoreOverlayPictureProps {
  contentSize: RendererSize;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  groupIndex: VexflowRecordingGroupIndex;
  itemStyleOverrides: NonNullable<ScoreRendererProps['itemStyleOverrides']>;
}

export interface OverlayDisposalState {
  /** The last real (non-empty) overlay picture the mapper returned. */
  prev: SkPicture | null;
  /** Superseded pictures awaiting disposal, oldest first. */
  pending: SkPicture[];
}

export interface OverlayFontManagerSlot {
  manager: FontManager | null;
}

export interface OverlayProfileState {
  windowStartMs: number;
  maxMs: number;
  count: number;
}
