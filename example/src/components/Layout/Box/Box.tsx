import { StyleSheet, View } from 'react-native';

import { useColorScheme } from '../../../hooks/useColorScheme';
import { BOX_DEFAULT_FLEX } from './constants';
import { type BoxProps } from './types';
import { getBoxBackgroundColor } from './utils';

// Renders a themed base layout container.
const Box: React.FC<BoxProps> = ({ children, style, testID }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { backgroundColor: getBoxBackgroundColor(isDark) },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: BOX_DEFAULT_FLEX,
  },
});

export default Box;
