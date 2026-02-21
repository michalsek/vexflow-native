import { View } from 'react-native';

import { useColorScheme } from '../../../hooks/useColorScheme';
import { SPACER_DEFAULT_SIZE } from './constants';
import { type SpacerProps } from './types';
import { getSpacerBackgroundColor, getSpacerDimensions } from './utils';

// Reserves fixed horizontal or vertical spacing.
const Spacer: React.FC<SpacerProps> = ({
  size = SPACER_DEFAULT_SIZE,
  axis = 'vertical',
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
        getSpacerDimensions(size, axis),
        { backgroundColor: getSpacerBackgroundColor(tone, isDark) },
        style,
      ]}
    />
  );
};

export default Spacer;
