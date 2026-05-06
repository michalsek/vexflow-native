import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import type { RendererSize } from '../types';

export type ScrollAxis = 'horizontal' | 'vertical';

export type ScoreScrollState = {
  axis: ScrollAxis;
  contentSize: SharedValue<RendererSize>;
  panGesture: GestureType;
  scrollOffset: SharedValue<number>;
  viewportSize: SharedValue<RendererSize>;
};
