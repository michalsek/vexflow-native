import type { RenderContext as VexflowRenderContext } from 'vexflow';

import { measureScore } from './planning';
import { renderScore } from './vexflow';
import type {
  MeasureRequest,
  RenderRequest,
  RenderResult,
  RendererEngine,
  RendererPlan,
} from './types';

export class RendererCore<
  TContext extends VexflowRenderContext = VexflowRenderContext
> implements RendererEngine<TContext>
{
  measure(request: MeasureRequest): RendererPlan {
    return measureScore(request);
  }

  render(request: RenderRequest<TContext>): RenderResult {
    return renderScore(request);
  }
}

export function createRendererEngine<
  TContext extends VexflowRenderContext = VexflowRenderContext
>(): RendererEngine<TContext> {
  return new RendererCore<TContext>();
}
