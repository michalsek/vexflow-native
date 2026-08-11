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
   * Fired after every recording pass with the final formatted geometry of the
   * rendered score (per-item tick x/width plus per-stave measure note
   * bounds).
   *
   * Coordinates are VIEW-space points AT SCROLL OFFSET 0: content-space
   * canvas coordinates multiplied by `options.render.scale` (see
   * `src/renderer/scale.ts` for the full scale rule; at the default scale 1
   * view space and content space are identical). The geometry does NOT track
   * scrolling — the scroll offset lives inside the renderer and is not
   * exposed, and the callback does not re-fire while the user scrolls.
   *
   * For the `document` and `documentEven` renderer types view-space x equals
   * view-local x (the render path never translates horizontally), so the
   * values can be compared 1:1 with layout coordinates of sibling views —
   * alignment overlays are supported for these renderer types only. For
   * `infiniteScore` the picture is translated horizontally by the internal
   * scroll offset, so these coordinates cannot be mapped to on-screen
   * positions through the public API; exposing the live scroll offset (or
   * re-firing with scroll-adjusted geometry) is a potential future addition.
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
   * Uniform notation scale, default 1. Layout runs in content space against a
   * virtual viewport of `viewport / scale` (insets/spacing are content-space,
   * so an inset occupies `inset x scale` view-pt on screen), the picture is
   * scaled back down at draw, and everything exposed outside the render path
   * (scroll content size, `onItemsLayout` geometry) is view-space. Lossless:
   * the Skia picture is vector commands re-rasterized at the final size. See
   * `src/renderer/scale.ts` for the precise rule. Non-finite or non-positive
   * values are treated as 1.
   */
  scale: number;
  debug: boolean;
}

export interface ScoreOptions {
  spacing: ScoreSpacing;
  insets: ScoreInsets;
  render: RenderOptions;
}

/**
 * Deep-partial options accepted by the `ScoreRenderer` `options` prop; each
 * provided field is merged over the lib defaults from
 * `src/renderer/constants.ts`.
 */
export interface ScoreRendererOptions {
  spacing?: Partial<ScoreSpacing>;
  insets?: Partial<ScoreInsets>;
  render?: Partial<RenderOptions>;
}

/** Final formatted geometry of one rendered voice item (note, chord or rest). */
export interface ScoreItemLayout {
  /**
   * Absolute canvas x of the item's tick (includes stave noteStartX +
   * padding). This is the LEFT edge of the formatted note block, NOT the
   * visual center — glyphs draw to the right of it, so aligning external UI
   * to `x` sits it roughly half a notehead left of the engraving. Use
   * {@link headCenterX} for visual alignment.
   */
  x: number;
  /** Formatted width of the item, canvas points. */
  width: number;
  /**
   * Absolute canvas x of the visual notehead-span center: the midpoint of
   * `StaveNote.getNoteHeadBeginX()` / `getNoteHeadEndX()` (rests included —
   * the rest glyph is a notehead). Always satisfies `x < headCenterX <=
   * x + width`. Items without a notehead span (hidden/spacer rests rendered
   * as `GhostNote`) or with a nonsensical reported span fall back to the
   * block center `x + width / 2`. This is the coordinate external UI should
   * align columns/overlays to.
   */
  headCenterX: number;
  measureIndex: number;
}

/**
 * Per-stave measure geometry captured after formatting: one entry per
 * rendered stave of a staff-group measure (a single-staff measure emits
 * exactly one). Entries of the same measure share `x`/`width`, but the note
 * bounds are per stave — left modifiers (clef/meter) can differ between the
 * staves of a group.
 */
export interface ScoreMeasureItemsLayout {
  groupId: string;
  /** `Staff.id` of the stave this entry was measured on. */
  staffId: string;
  measureIndex: number;
  systemIndex: number;
  /** Stave origin x, canvas points. */
  x: number;
  /** Stave width, canvas points. */
  width: number;
  /** Canvas x where notes may start on this stave (after its clef/meter). */
  staveNoteStartX: number;
  /** Canvas x where the note area of this stave ends. */
  staveNoteEndX: number;
}

/**
 * Geometry of all rendered items keyed by item id, plus per-stave measure
 * bounds. Coordinates and `contentSize` are VIEW-space at scroll offset 0
 * (content-space canvas points multiplied by `options.render.scale`); for
 * `document` / `documentEven` renderers view-space x equals view-local x. See
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
