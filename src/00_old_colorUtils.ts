const SCORE_THEME_HEX_TOKENS = new Set([
  '#000',
  '#000000',
  '#444',
  '#444444',
  '#777',
  '#777777',
  '#999',
  '#999999',
]);
const BLACK_KEYWORD = 'black';
const BLACK_RGB_REGEX = /^rgb\(0,0,0\)$/;
const BLACK_RGBA_REGEX = /^rgba\(0,0,0,(1|1\.0+|0?\.\d+)\)$/;
const LEDGER_RGB_REGEX = /^rgb\(68,68,68\)$/;
const LEDGER_RGBA_REGEX = /^rgba\(68,68,68,(1|1\.0+|0?\.\d+)\)$/;
const BEND_RGB_REGEX = /^rgb\(119,119,119\)$/;
const BEND_RGBA_REGEX = /^rgba\(119,119,119,(1|1\.0+|0?\.\d+)\)$/;
const TAB_STAVE_RGB_REGEX = /^rgb\(153,153,153\)$/;
const TAB_STAVE_RGBA_REGEX = /^rgba\(153,153,153,(1|1\.0+|0?\.\d+)\)$/;

function normalizeColorToken(style: string): string {
  return style.trim().toLowerCase().replace(/\s+/g, '');
}

function isBlackColorToken(style: string): boolean {
  const normalized = normalizeColorToken(style);

  if (SCORE_THEME_HEX_TOKENS.has(normalized) || normalized === BLACK_KEYWORD) {
    return true;
  }

  if (
    BLACK_RGB_REGEX.test(normalized) ||
    BLACK_RGBA_REGEX.test(normalized) ||
    LEDGER_RGB_REGEX.test(normalized) ||
    LEDGER_RGBA_REGEX.test(normalized) ||
    BEND_RGB_REGEX.test(normalized) ||
    BEND_RGBA_REGEX.test(normalized) ||
    TAB_STAVE_RGB_REGEX.test(normalized) ||
    TAB_STAVE_RGBA_REGEX.test(normalized)
  ) {
    return true;
  }

  return false;
}

// Replaces VexFlow default black values with the active score theme color.
export function resolveScoreColor(style: string, themeColor: string): string {
  if (isBlackColorToken(style)) {
    return themeColor;
  }

  return style;
}
