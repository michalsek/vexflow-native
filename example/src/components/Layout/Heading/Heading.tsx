import { StyleSheet, Text } from 'react-native';

import { useColorScheme } from '../../../hooks/useColorScheme';
import { type HeadingProps } from './types';
import { getHeadingStyle } from './utils';

// Renders themed heading text for section titles.
const Heading: React.FC<HeadingProps> = ({
  children,
  level = 3,
  style,
  testID,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Text
      testID={testID}
      style={[
        styles.base,
        { color: isDark ? '#f9fafb' : '#111827' },
        getHeadingStyle(level),
        style,
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontWeight: '700',
  },
});

export default Heading;
