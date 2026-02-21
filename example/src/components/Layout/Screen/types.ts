import type { PropsWithChildren } from 'react';
import type { Edge } from 'react-native-safe-area-context';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';

export type ScreenProps = PropsWithChildren<{
  disableSafeArea?: boolean;
  safeAreaEdges?: Edge[];
  padding?: number;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  scrollViewProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
}>;
