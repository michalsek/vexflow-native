import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '../../../hooks/useColorScheme';
import { SCREEN_DEFAULT_PADDING } from './constants';
import { type ScreenProps } from './types';
import { getScreenPadding } from './utils';

// Renders a page-level container with optional safe-area and scroll behavior.
const Screen: React.FC<ScreenProps> = ({
  children,
  disableSafeArea = false,
  safeAreaEdges = ['right', 'bottom', 'left', 'top'],
  padding = SCREEN_DEFAULT_PADDING,
  scrollable = false,
  contentContainerStyle,
  style,
  testID,
  scrollViewProps,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const contentPadding = getScreenPadding(padding, disableSafeArea);

  const content = scrollable ? (
    <ScrollView
      {...scrollViewProps}
      contentContainerStyle={[
        styles.content,
        { padding: contentPadding },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        { padding: contentPadding },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  if (disableSafeArea) {
    return (
      <View
        testID={testID}
        style={[
          styles.root,
          { backgroundColor: isDark ? '#030712' : '#f9fafb' },
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <SafeAreaView
      testID={testID}
      style={[
        styles.root,
        { backgroundColor: isDark ? '#030712' : '#f9fafb' },
        style,
      ]}
      edges={safeAreaEdges}
    >
      {content}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});

export default Screen;
