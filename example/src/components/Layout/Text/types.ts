import type { PropsWithChildren } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

export type BodyTextVariant = 'default' | 'muted';

export type BodyTextProps = PropsWithChildren<{
  variant?: BodyTextVariant;
  style?: StyleProp<TextStyle>;
  testID?: string;
}>;
