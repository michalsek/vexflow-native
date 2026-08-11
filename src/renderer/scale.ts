import type { RendererRect, RendererSize, ScoreItemsLayout } from './types';

/**
 * Scale rule for `options.render.scale`: layout runs in content space against
 * a virtual viewport (the view viewport divided by the scale), the recorded
 * picture is scaled back at draw time, and everything exposed outside the
 * render path (scroll content size, `onItemsLayout` geometry) is converted
 * back to view space. At scale 1 every helper returns its input untouched.
 */

/**
 * Reads the render scale from options; invalid values fall back to 1.
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
 * The virtual content-space viewport layout runs against: the view viewport
 * divided by the scale.
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
 * Converts a content-space size to view space.
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
 * Converts the geometry captured by `renderScore` to view space. The field
 * list is hand-maintained: new coordinate fields must be multiplied here too
 * (guarded by a structural test in scale.test.ts).
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
