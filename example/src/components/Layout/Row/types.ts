import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export type RowTone = 'transparent' | 'surface';

export type RowProps = PropsWithChildren<{
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  tone?: RowTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;
