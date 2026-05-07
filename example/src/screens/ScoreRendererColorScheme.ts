import type { ScoreColorScheme } from 'vexflow-native/renderer';

export const SCORE_RENDERER_BACKGROUND = {
  dark: '#030712',
  light: '#ffffff',
};

export function getScoreRendererColorScheme(isDark: boolean): ScoreColorScheme {
  return {
    background: isDark
      ? SCORE_RENDERER_BACKGROUND.dark
      : SCORE_RENDERER_BACKGROUND.light,
    foreground: isDark ? '#f9fafb' : '#111827',
    ledgerLine: isDark ? '#9ca3af' : '#4b5563',
  };
}
