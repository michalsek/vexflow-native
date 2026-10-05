import type { ScoreItemStyleOverrides } from 'vexflow-native/renderer';

export type StyleMode = 'default' | 'color' | 'glow' | 'dash';

export const STYLE_OVERRIDE_PRESETS: Record<
  StyleMode,
  ScoreItemStyleOverrides
> = {
  default: {},
  color: {
    'top-s1-m1-v1-n2': {
      fillColor: '#16a34a',
      strokeColor: '#15803d',
    },
    'top-s1-m3-v1-c1': {
      fillColor: '#2563eb',
      strokeColor: '#1d4ed8',
    },
    'bottom-s1-m2-v1-c1': {
      fillColor: '#dc2626',
      strokeColor: '#991b1b',
    },
  },
  glow: {
    'top-s1-m1-v1-n4': {
      color: '#f59e0b',
      shadowColor: '#fbbf24',
      shadowBlur: 12,
    },
    'top-s1-m3-v1-c2': {
      color: '#a855f7',
      shadowColor: '#c084fc',
      shadowBlur: 14,
    },
    'bottom-s1-m1-v1-c1': {
      color: '#14b8a6',
      shadowColor: '#2dd4bf',
      shadowBlur: 12,
    },
  },
  dash: {
    'top-s1-m3-v1-c1': {
      strokeColor: '#2563eb',
      lineDash: [4, 2],
    },
    'top-s1-m4-v1-n2': {
      strokeColor: '#ef4444',
      lineDash: [5, 3],
    },
    'bottom-s1-m4-v1-n1': {
      strokeColor: '#16a34a',
      lineDash: [6, 3],
    },
  },
};
