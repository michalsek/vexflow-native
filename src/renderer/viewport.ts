import type {
  RendererPoint,
  RendererSize,
  Viewport,
  VisibleViewport,
} from './types';

function clampOffset(
  offset: number,
  contentExtent: number,
  viewportExtent: number
): number {
  const maxOffset = Math.max(0, contentExtent - viewportExtent);

  return Math.min(Math.max(offset, 0), maxOffset);
}

export function createVisibleViewport(
  scrollOffset: RendererPoint,
  viewport: Viewport,
  contentSize: RendererSize
): VisibleViewport {
  return {
    x: clampOffset(scrollOffset.x, contentSize.width, viewport.width),
    y: clampOffset(scrollOffset.y, contentSize.height, viewport.height),
    width: viewport.width,
    height: viewport.height,
  };
}
