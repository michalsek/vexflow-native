import type {
  RendererSize,
  RendererType,
  Viewport,
  VisibleViewport,
} from './types';

function clampOffset(
  offset: number,
  contentExtent: number,
  viewportExtent: number
): number {
  'worklet';

  const maxOffset = Math.max(0, contentExtent - viewportExtent);

  return Math.min(Math.max(offset, 0), maxOffset);
}

export function createVisibleViewport(
  scrollOffset: number,
  rendererType: RendererType,
  viewport: Viewport,
  contentSize: RendererSize
): VisibleViewport {
  'worklet';

  const offset =
    rendererType === 'infiniteScore'
      ? {
          x: clampOffset(scrollOffset, contentSize.width, viewport.width),
          y: 0,
        }
      : {
          x: 0,
          y: clampOffset(scrollOffset, contentSize.height, viewport.height),
        };

  return {
    x: offset.x,
    y: offset.y,
    width: viewport.width,
    height: viewport.height,
  };
}
