import type { VexflowColorScheme } from '../base/VexflowColorScheme';

export type ScoreColorScheme = VexflowColorScheme;

export interface ResolvedScoreColorScheme {
  foreground: string;
  background: string;
  ledgerLine?: string;
}

const DEFAULT_SCORE_COLOR_SCHEME: ResolvedScoreColorScheme = {
  foreground: '#000000',
  background: 'transparent',
};

export function resolveScoreColorScheme(
  colorScheme?: ScoreColorScheme
): ResolvedScoreColorScheme {
  if (!colorScheme) {
    return DEFAULT_SCORE_COLOR_SCHEME;
  }

  return {
    foreground: colorScheme.foreground ?? DEFAULT_SCORE_COLOR_SCHEME.foreground,
    background: colorScheme.background ?? DEFAULT_SCORE_COLOR_SCHEME.background,
    ledgerLine: colorScheme.ledgerLine,
  };
}
