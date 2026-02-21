import { StyleSheet, Text } from 'react-native';

import { useColorScheme } from '../../../hooks/useColorScheme';
import { type BodyTextProps } from './types';
import { getBodyTextColor } from './utils';

// Renders themed body text for layout usage.
const BodyText: React.FC<BodyTextProps> = ({
  children,
  variant = 'default',
  style,
  testID,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Text
      testID={testID}
      style={[styles.text, { color: getBodyTextColor(variant, isDark) }, style]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default BodyText;
