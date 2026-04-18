import { useFont, type SkFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import {
  BRAVURA_FONT_FAMILY,
  type LoadedFontResource,
  BRAVURA_FONT_SIZE,
} from './fontUtils';
import type { VexflowCanvasProps } from './types';

export function createNativeFontResource(
  bravuraFont: SkFont | null
): LoadedFontResource | null {
  if (!bravuraFont) {
    return null;
  }

  return {
    bravuraFont,
    bravuraTypeface: bravuraFont.getTypeface(),
    cacheKeyPrefix: `${BRAVURA_FONT_FAMILY}-native`,
  };
}

export function useResolvedFontResource(
  font: VexflowCanvasProps['font']
): LoadedFontResource | null {
  const bravuraFont = useFont(font, BRAVURA_FONT_SIZE);

  return useMemo(() => createNativeFontResource(bravuraFont), [bravuraFont]);
}
