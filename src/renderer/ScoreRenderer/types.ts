import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

import type { RendererSize, ScrollAxis } from '../types';

export type { ScrollAxis } from '../types';

export type ScoreScrollState = {
  axis: ScrollAxis;
  contentSize: SharedValue<RendererSize>;
  panGesture: GestureType;
  scrollOffset: SharedValue<number>;
  viewportSize: SharedValue<RendererSize>;
};
