import type { RendererRect, RendererSize, ScoreItemsLayout } from './types';

/**
 * Notation scale rule (`options.render.scale`)
 * ============================================
 *
 * `scale` shrinks (or magnifies) the whole engraved notation losslessly — the
 * recorded Skia picture is a vector command list, re-rasterized at the final
 * size, so there is no blur. The pipeline applies one consistent rule:
 *
 * 1. LAYOUT runs entirely in CONTENT space against a *virtual viewport* that
 *    is the view viewport divided by `scale` (every rect field: x, y, width,
 *    height). Insets and spacing are therefore CONTENT-space values: an inset
 *    of 24 content-pt occupies `24 x scale` view-pt on screen. Because the
 *    virtual viewport is wider than the view, a stretched document line lays
 *    out at `viewport.width / scale - insets` content-pt and visually fills
 *    the view width after scaling.
 * 2. DRAW records the picture in content space (content-space cull rect) and
 *    maps it to the view with a Group transform that scales content first,
 *    then translates by the VIEW-space scroll offset:
 *    `p_view = scale * p_content - scrollOffset_view`.
 * 3. Everything exposed OUTSIDE the render path is VIEW space: the content
 *    size driving scrolling/scrollbars and the geometry emitted through
 *    `onItemsLayout` are multiplied back by `scale` (see
 *    {@link scaleItemsLayoutToViewSpace}).
 *
 * The rule holds for every renderer type, including `infiniteScore` (its
 * centering math divides and re-multiplies symmetrically, and its horizontal
 * scroll range comes from the view-space content width).
 *
 * `scale === 1` short-circuits through every helper and returns the input
 * objects untouched, so the default pipeline output is byte-identical to the
 * pre-scale implementation.
 */

/**
 * Resolves the effective render scale from (possibly partial) options.
 * Non-finite or non-positive values fall back to 1 so the render path stays
 * throw-free.
 */
export function getRenderScale(options?: {
  render?: { scale?: number };
}): number {
  const scale = options?.render?.scale;

  return typeof scale === 'number' && Number.isFinite(scale) && scale > 0
    ? scale
    : 1;
}

/**
 * The virtual CONTENT-space viewport layout runs against: the view viewport
 * divided by `scale`. Identity (same reference) at scale 1.
 */
export function createContentViewport(
  viewport: RendererRect,
  scale: number
): RendererRect {
  if (scale === 1) {
    return viewport;
  }

  return {
    x: viewport.x / scale,
    y: viewport.y / scale,
    width: viewport.width / scale,
    height: viewport.height / scale,
  };
}

/**
 * Converts a CONTENT-space size (e.g. the layout plan's content size) to VIEW
 * space. Identity (same reference) at scale 1.
 */
export function toViewSize(size: RendererSize, scale: number): RendererSize {
  if (scale === 1) {
    return size;
  }

  return {
    width: size.width * scale,
    height: size.height * scale,
  };
}

/**
 * Converts the CONTENT-space geometry captured by `renderScore` to VIEW space
 * by multiplying every horizontal coordinate/extent and the content size by
 * `scale` — including every per-stave measure entry. This keeps the
 * `onItemsLayout` contract ("view-space at scroll offset 0"; see
 * `ScoreRendererProps.onItemsLayout` in types.ts) true regardless of scale.
 * Identity (same reference) at scale 1.
 *
 * NOTE: this is a HAND-MAINTAINED field list. Every new coordinate/extent
 * field added to `ScoreItemLayout` or `ScoreMeasureItemsLayout` MUST be
 * multiplied here — `scale.test.ts` carries a structural guard that fails
 * when a numeric non-index field survives unscaled.
 */
export function scaleItemsLayoutToViewSpace(
  itemsLayout: ScoreItemsLayout,
  scale: number
): ScoreItemsLayout {
  if (scale === 1) {
    return itemsLayout;
  }

  const items: ScoreItemsLayout['items'] = {};

  for (const [itemId, item] of Object.entries(itemsLayout.items)) {
    items[itemId] = {
      ...item,
      x: item.x * scale,
      width: item.width * scale,
      headCenterX: item.headCenterX * scale,
    };
  }

  return {
    items,
    measures: itemsLayout.measures.map((measure) => ({
      ...measure,
      x: measure.x * scale,
      width: measure.width * scale,
      staveNoteStartX: measure.staveNoteStartX * scale,
      staveNoteEndX: measure.staveNoteEndX * scale,
    })),
    contentSize: toViewSize(itemsLayout.contentSize, scale),
  };
}
