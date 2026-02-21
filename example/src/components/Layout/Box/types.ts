import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type BoxProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;
