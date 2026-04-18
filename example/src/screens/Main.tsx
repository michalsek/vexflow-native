import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Column, Heading, Screen, Text } from '../components';
import { useColorScheme } from '../hooks/useColorScheme';
import type { ExampleStackParamList } from '../navigation/ExampleStackParamList';

type MainScreenProps = NativeStackScreenProps<ExampleStackParamList, 'Main'>;
type DestinationRoute = Exclude<keyof ExampleStackParamList, 'Main'>;

type ScreenLink = {
  route: DestinationRoute;
  title: string;
  description: string;
};

const SCREEN_LINKS: ScreenLink[] = [
  // {
  //   route: 'VexflowTestSuite',
  //   title: 'VexFlow Test Suite',
  //   description: 'Browse the current plain VexFlow rendering test suite.',
  // },
  // {
  //   route: 'DocumentRenderer',
  //   title: 'Document Renderer',
  //   description: 'Placeholder for the document layout renderer workflow.',
  // },
  // {
  //   route: 'EvenDocumentRenderer',
  //   title: 'Even Document Renderer',
  //   description:
  //     'Placeholder for evenly distributed document layout rendering.',
  // },
  // {
  //   route: 'InfiniteScore',
  //   title: 'Infinite Score',
  //   description: 'Inspect the renderer-driven infinite-score example.',
  // },
];

const Main: React.FC<MainScreenProps> = ({ navigation }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Screen scrollable contentContainerStyle={styles.container}>
      <Column gap={8}>
        <Heading level={2}>Example Screens</Heading>
        <Text variant="muted">
          Choose a screen to inspect the current example flows.
        </Text>
      </Column>
      <Column gap={12}>
        {SCREEN_LINKS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => navigation.navigate(item.route)}
            style={({ pressed }) => [
              styles.linkCard,
              {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                borderColor: isDark ? '#374151' : '#d1d5db',
              },
              pressed ? styles.linkCardPressed : null,
            ]}
          >
            <View style={styles.linkContent}>
              <Text style={styles.linkTitle}>{item.title}</Text>
              <Text variant="muted">{item.description}</Text>
            </View>
          </Pressable>
        ))}
      </Column>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 16,
  },
  linkCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  linkCardPressed: {
    opacity: 0.85,
  },
  linkContent: {
    gap: 6,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Main;
