import type { StyleProp, ViewStyle } from 'react-native';

export type SpacerAxis = 'vertical' | 'horizontal';
export type SpacerTone = 'transparent' | 'line';

export type SpacerProps = {
  size?: number;
  axis?: SpacerAxis;
  tone?: SpacerTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
