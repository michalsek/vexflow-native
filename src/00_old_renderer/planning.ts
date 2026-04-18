import type {
  MeasureRequest,
  NormalizedRendererConfig,
  RendererConfig,
  RendererPlan,
} from './types';

import { ConfigNormalizer, RendererPlanner } from './planner';

const compatibilityNormalizer = new ConfigNormalizer();
const compatibilityPlanner = new RendererPlanner();

export function normalizeRendererConfig(
  config: RendererConfig
): NormalizedRendererConfig {
  return compatibilityNormalizer.normalize(config).config;
}

export function measureScore(request: MeasureRequest): RendererPlan {
  return compatibilityPlanner.measure(request);
}
