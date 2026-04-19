import { Font } from 'vexflow';
import { Platform } from 'react-native';
import type { FontInfo } from 'vexflow';

const FONT_SIZE_PATTERN =
  /(\d+(?:\.\d+)?(?:px|pt|em|rem|%|in|mm|cm)?)(?:\/[^\s]+)?/i;
const FONT_STYLE_PATTERN = /\b(italic|oblique|normal)\b/i;
const FONT_WEIGHT_PATTERN = /\b(bold|bolder|lighter|normal|[1-9]00)\b/i;

const originalFromCSSString = Font.fromCSSString.bind(Font);

let fallbackInstalled = false;

export function installVexflowReactNativeFallbacks(): void {
  'worklet';

  if (fallbackInstalled) {
    return;
  }

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return;
  }

  if ('document' in globalThis) {
    fallbackInstalled = true;
    return;
  }

  Font.fromCSSString = ((cssFontShorthand: string) =>
    parseCssFontShorthand(cssFontShorthand)) as typeof Font.fromCSSString;

  fallbackInstalled = true;
}

function parseCssFontShorthand(cssFontShorthand: string): Required<FontInfo> {
  const source = cssFontShorthand.trim();

  if (source.length === 0) {
    return emptyFontInfo();
  }

  const sizeMatch = source.match(FONT_SIZE_PATTERN);

  if (!sizeMatch || sizeMatch.index === undefined) {
    return emptyFontInfo();
  }

  const prefix = source.slice(0, sizeMatch.index).trim();
  const family = source.slice(sizeMatch.index + sizeMatch[0].length).trim();
  const style =
    prefix.match(FONT_STYLE_PATTERN)?.[1]?.toLowerCase() ?? 'normal';
  const weight =
    prefix.match(FONT_WEIGHT_PATTERN)?.[1]?.toLowerCase() ?? 'normal';

  return {
    family,
    size: sizeMatch[1] ?? '',
    weight,
    style,
  };
}

function emptyFontInfo(): Required<FontInfo> {
  return {
    family: '',
    size: '',
    weight: '',
    style: '',
  };
}

export const __test__ = {
  originalFromCSSString,
  parseCssFontShorthand,
};
