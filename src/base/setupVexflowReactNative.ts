import { Element, Font } from 'vexflow';
import { Platform } from 'react-native';
import type { FontInfo } from 'vexflow';

const FONT_SIZE_PATTERN =
  /(\d+(?:\.\d+)?(?:px|pt|em|rem|%|in|mm|cm)?)(?:\/[^\s]+)?/i;
const FONT_STYLE_PATTERN = /\b(italic|oblique|normal)\b/i;
const FONT_WEIGHT_PATTERN = /\b(bold|bolder|lighter|normal|[1-9]00)\b/i;

const originalFromCSSString = Font.fromCSSString.bind(Font);

let fallbackInstalled = false;
let textMeasurementCanvasInstalled = false;

const emptyTextMetrics = {
  width: 0,
  actualBoundingBoxAscent: 0,
  actualBoundingBoxDescent: 0,
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: 0,
  fontBoundingBoxAscent: 0,
  fontBoundingBoxDescent: 0,
};

const emptyTextMeasurementContext = {
  measureText: () => emptyTextMetrics,
};

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

export function ensureVexflowTextMeasurementCanvas(): void {
  'worklet';

  if (textMeasurementCanvasInstalled) {
    return;
  }

  const existingCanvas = Element.getTextMeasurementCanvas();
  const existingContext = existingCanvas?.getContext(
    '2d' as unknown as 'webgpu'
  );

  if (existingContext) {
    textMeasurementCanvasInstalled = true;
    return;
  }

  if ('document' in globalThis) {
    return;
  }

  Element.setTextMeasurementCanvas({
    getContext: (type: string) => {
      if (type === '2d') {
        return emptyTextMeasurementContext;
      }

      return null;
    },
  } as unknown as HTMLCanvasElement);
  textMeasurementCanvasInstalled = true;
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
