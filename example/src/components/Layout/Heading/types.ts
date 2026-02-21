import type { PropsWithChildren } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

export type HeadingLevel = 1 | 2 | 3 | 4;

export type HeadingProps = PropsWithChildren<{
  level?: HeadingLevel;
  style?: StyleProp<TextStyle>;
  testID?: string;
}>;
