import { Skia } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import {
  BRAVURA_FONT_FAMILY,
  BRAVURA_FONT_SIZE,
  type LoadedFontResource,
} from './fontUtils';
import type { VexflowCanvasProps } from './types';

type AssetFontSource = NonNullable<VexflowCanvasProps['font']>;

function resolveFontUri(font: Exclude<AssetFontSource, Uint8Array>): string {
  if (typeof font === 'string') {
    return font;
  }

  if (typeof font === 'number') {
    return Image.resolveAssetSource(font)?.uri ?? '';
  }

  if ('uri' in font) {
    return font.uri;
  }

  return font.default;
}

export async function loadWebFontResource(
  font: VexflowCanvasProps['font']
): Promise<LoadedFontResource | null> {
  if (!font) {
    return null;
  }

  const data =
    font instanceof Uint8Array
      ? Skia.Data.fromBytes(font)
      : await Skia.Data.fromURI(resolveFontUri(font));

  const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);

  if (!typeface) {
    return null;
  }

  const fontManager = Skia.TypefaceFontProvider.Make();
  fontManager.registerFont(typeface, BRAVURA_FONT_FAMILY);

  return {
    bravuraFont: Skia.Font(typeface, BRAVURA_FONT_SIZE),
    bravuraTypeface: typeface,
    fontManager,
    cacheKeyPrefix: `${BRAVURA_FONT_FAMILY}-web`,
  };
}

export function useResolvedFontResource(
  font: VexflowCanvasProps['font']
): LoadedFontResource | null {
  const [fontResource, setFontResource] = useState<LoadedFontResource | null>(
    null
  );

  useEffect(() => {
    let isMounted = true;

    setFontResource(null);

    loadWebFontResource(font)
      .then((resource) => {
        if (isMounted) {
          setFontResource(resource);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFontResource(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [font]);

  return fontResource;
}
