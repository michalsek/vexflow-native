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
  options?: ScoreRendererOptions;
  scrollEnabled?: boolean;
  showScrollbars?: boolean;
  /**
   * Fired after every recording pass with the final geometry of the rendered
   * score. Coordinates are view-space points at scroll offset 0 and do not
   * track scrolling. For the `document` and `documentEven` renderer types they
   * map 1:1 to view-local coordinates; for `infiniteScore` they cannot be
   * mapped to on-screen positions.
   *
   * @param layout Geometry of all rendered items and measures.
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
  /** Currently unused — reserved for future raster-density control. */
  pixelRatio: number;
  /**
   * Uniform notation scale, default 1. Scaling is lossless — the notation is
   * re-rasterized at the final size. Non-finite or non-positive values are
   * treated as 1.
   */
  scale: number;
  debug: boolean;
  /**
   * Position every tick context at its time-proportional x inside the note
   * area instead of VexFlow's duration-weighted spacing. With a `spacer`
   * voice covering each lattice tick, engraved x positions become a pure
   * function of time — content edits cannot reflow them. Meant for
   * step-editor previews; default false (classic engraving spacing).
   */
  fixedNoteSpacing: boolean;
}

export interface ScoreOptions {
  spacing: ScoreSpacing;
  insets: ScoreInsets;
  render: RenderOptions;
}

/**
 * Partial options accepted by the `ScoreRenderer` `options` prop, merged over
 * the library defaults.
 */
export interface ScoreRendererOptions {
  spacing?: Partial<ScoreSpacing>;
  insets?: Partial<ScoreInsets>;
  render?: Partial<RenderOptions>;
}

/** Final formatted geometry of one rendered voice item (note, chord or rest). */
export interface ScoreItemLayout {
  /**
   * Left edge of the formatted note block. Glyphs draw to the right of it, so
   * use {@link headCenterX} for visual alignment.
   */
  x: number;
  /** Formatted width of the item. */
  width: number;
  /**
   * Center of the item's notehead span — the coordinate external UI should
   * align to. Items without a notehead (hidden and spacer rests) fall back to
   * the center of a notional notehead at the block's left edge, so they agree
   * with a real note on the same tick.
   */
  headCenterX: number;
  measureIndex: number;
}

/**
 * Geometry of one rendered stave of a measure. Entries of the same measure
 * share `x`/`width`, but note bounds are per stave — clef and time signature
 * can differ between the staves of a group.
 */
export interface ScoreMeasureItemsLayout {
  groupId: string;
  staffId: string;
  measureIndex: number;
  systemIndex: number;
  /** Stave origin x. */
  x: number;
  /** Stave width. */
  width: number;
  /** X where notes may start on this stave (after its clef/meter). */
  staveNoteStartX: number;
  /** X where the note area of this stave ends. */
  staveNoteEndX: number;
}

/**
 * Geometry of all rendered items keyed by item id, plus per-stave measure
 * bounds. Coordinates and `contentSize` are view-space at scroll offset 0.
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
