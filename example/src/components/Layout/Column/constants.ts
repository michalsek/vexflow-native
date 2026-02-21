import type { ColumnTone } from './types';

export const COLUMN_DEFAULT_GAP = 8;

export const COLUMN_TONE_COLORS: Record<
  ColumnTone,
  { light: string; dark: string }
> = {
  transparent: { light: 'transparent', dark: 'transparent' },
  surface: { light: '#ffffff', dark: '#111827' },
};
