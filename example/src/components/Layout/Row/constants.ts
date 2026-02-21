import type { RowTone } from './types';

export const ROW_DEFAULT_GAP = 8;

export const ROW_TONE_COLORS: Record<RowTone, { light: string; dark: string }> =
  {
    transparent: { light: 'transparent', dark: 'transparent' },
    surface: { light: '#ffffff', dark: '#111827' },
  };
