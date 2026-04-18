import type { RenderContext as VexflowRenderContext } from 'vexflow';

import { RendererPlanner } from './planner';
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
  private readonly planner = new RendererPlanner();

  measure(request: MeasureRequest): RendererPlan {
    return this.planner.measure(request);
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
