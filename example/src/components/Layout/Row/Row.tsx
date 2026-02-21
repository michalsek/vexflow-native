import { StyleSheet, View } from 'react-native';

import { useColorScheme } from '../../../hooks/useColorScheme';
import { ROW_DEFAULT_GAP } from './constants';
import { type RowProps } from './types';
import { getRowBackgroundColor, getRowStyle } from './utils';

// Stacks children horizontally with configurable alignment and spacing.
const Row: React.FC<RowProps> = ({
  children,
  gap = ROW_DEFAULT_GAP,
  align,
  justify,
  wrap = false,
  tone = 'transparent',
  style,
  testID,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        getRowStyle(gap, wrap),
        { backgroundColor: getRowBackgroundColor(tone, isDark) },
        align ? { alignItems: align } : null,
        justify ? { justifyContent: justify } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
});

export default Row;
