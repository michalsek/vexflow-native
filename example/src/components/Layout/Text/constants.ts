import type { BodyTextVariant } from './types';

export const BODY_TEXT_COLORS: Record<
  BodyTextVariant,
  { light: string; dark: string }
> = {
  default: { light: '#111827', dark: '#f9fafb' },
  muted: { light: '#4b5563', dark: '#9ca3af' },
};
