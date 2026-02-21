import type { SpacerTone } from './types';

export const SPACER_DEFAULT_SIZE = 12;

export const SPACER_TONE_COLORS: Record<
  SpacerTone,
  { light: string; dark: string }
> = {
  transparent: { light: 'transparent', dark: 'transparent' },
  line: { light: '#e5e7eb', dark: '#374151' },
};
