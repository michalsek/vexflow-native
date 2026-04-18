import type { SkiaVexflowContext } from '../base';
import type { Score } from '../state';
import type { RendererType, ScoreOptions, Viewport } from './types';

export default class Renderer {
  private ctx: SkiaVexflowContext;
  private score: Score;
  private layoutType: RendererType;
  private viewport: Viewport;
  private options: ScoreOptions;

  constructor(
    ctx: SkiaVexflowContext,
    viewport: Viewport,
    options: ScoreOptions,
    score: Score,
    type: RendererType = 'documentEven'
  ) {
    this.ctx = ctx;
    this.viewport = viewport;
    this.options = options;
    this.score = score;
    this.layoutType = type;
  }

  measure() {}

  render() {}
}
