import { parseStyleToColor } from './utils';

export interface VexflowColorScheme {
  foreground?: string;
  background?: string;
  ledgerLine?: string;
}

const FOREGROUND_COLOR_ALIASES = new Set(['black', '#000', '#000000']);
const LEDGER_LINE_COLOR_ALIASES = new Set(['#444', '#444444']);

export function resolveVexflowColor(
  style: string,
  colorScheme?: VexflowColorScheme
): string {
  const normalizedStyle = style.trim().toLowerCase();

  if (
    colorScheme?.foreground &&
    FOREGROUND_COLOR_ALIASES.has(normalizedStyle)
  ) {
    return parseStyleToColor(colorScheme.foreground);
  }

  if (LEDGER_LINE_COLOR_ALIASES.has(normalizedStyle)) {
    return parseStyleToColor(
      colorScheme?.ledgerLine ?? colorScheme?.foreground ?? style
    );
  }

  return parseStyleToColor(style);
}
