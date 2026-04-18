import { Platform } from 'react-native';

import { useResolvedFontResource as useResolvedNativeFontResource } from './fontLoader.native';
import { useResolvedFontResource as useResolvedWebFontResource } from './fontLoader.web';
import type { LoadedFontResource } from './fontUtils';
import type { VexflowCanvasProps } from './types';

const usePlatformResolvedFontResource =
  Platform.OS === 'web'
    ? useResolvedWebFontResource
    : useResolvedNativeFontResource;

export function useResolvedFontResource(
  font: VexflowCanvasProps['font']
): LoadedFontResource | null {
  return usePlatformResolvedFontResource(font);
}
