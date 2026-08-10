import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';

import type { VexflowStyleOverride } from '../base';
import type { Score } from '../state';
import type { ScoreColorScheme } from './colorScheme';

export type RendererType = 'infiniteScore' | 'document' | 'documentEven';
export type ScoreItemStyleOverride = VexflowStyleOverride;
export type ScoreItemStyleOverrides = Record<string, ScoreItemStyleOverride>;

export interface ScoreRendererProps {
  score: Score;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  colorScheme?: ScoreColorScheme;
  itemStyleOverrides?: SharedValue<ScoreItemStyleOverrides>;
  rendererType?: RendererType;
  options?: Partial<ScoreOptions>;
  scrollEnabled?: boolean;
  showScrollbars?: boolean;
  /**
   * Fired after every recording pass with the final formatted geometry of the
   * rendered score (per-item tick x/width plus per-measure stave note bounds).
   *
   * Coordinates are content-space canvas points. For the `document` and
   * `documentEven` renderer types content-space x equals view-local x (the
   * render path never translates or scales horizontally), so the values can be
   * compared 1:1 with layout coordinates of sibling views. `infiniteScore`
   * consumers must subtract their horizontal scroll offset themselves.
   */
  onItemsLayout?: (layout: ScoreItemsLayout) => void;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ScoreInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ScoreSpacing {
  staffGap: number;
  minIntrinsicSizeMultiplier: number;
}

export interface RenderOptions {
  pixelRatio: number;
  scale: number;
  debug: boolean;
}

export interface ScoreOptions {
  spacing: ScoreSpacing;
  insets: ScoreInsets;
  render: RenderOptions;
}

/** Final formatted geometry of one rendered voice item (note, chord or rest). */
export interface ScoreItemLayout {
  /** Absolute canvas x of the item's tick (includes stave noteStartX + padding). */
  x: number;
  /** Formatted width of the item, canvas points. */
  width: number;
  measureIndex: number;
}

/** Per-measure stave geometry captured after formatting. */
export interface ScoreMeasureItemsLayout {
  groupId: string;
  measureIndex: number;
  systemIndex: number;
  /** Stave origin x, canvas points. */
  x: number;
  /** Stave width, canvas points. */
  width: number;
  /** Canvas x where notes may start on the stave (after clef/meter). */
  staveNoteStartX: number;
  /** Canvas x where the note area of the stave ends. */
  staveNoteEndX: number;
}

/**
 * Geometry of all rendered items keyed by item id, plus per-measure stave
 * bounds. Coordinates are content-space canvas points; for `document` /
 * `documentEven` renderers content-space x equals view-local x. See
 * {@link ScoreRendererProps.onItemsLayout}.
 */
export interface ScoreItemsLayout {
  items: Record<string, ScoreItemLayout>;
  measures: ScoreMeasureItemsLayout[];
  contentSize: RendererSize;
}

export interface RendererPoint {
  x: number;
  y: number;
}

export interface RendererSize {
  width: number;
  height: number;
}

export interface RendererRect extends RendererPoint, RendererSize {}

export interface VisibleViewport extends RendererRect {}
