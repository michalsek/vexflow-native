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
  {
    route: 'SimpleExample',
    title: 'Simple Example',
    description: 'Inspect a simple rendering example with basic primitives.',
  },
  {
    route: 'SimpleRenderer',
    title: 'Simple Renderer',
    description: 'Render a simple score using ScoreRenderer and the score type',
  },
  {
    route: 'MusicXmlImport',
    title: 'MusicXML Import',
    description: 'Parse a bundled MusicXML fixture and render the score.',
  },
  // {
  //   route: 'VexflowTestSuite',
  //   title: 'VexFlow Test Suite',
  //   description: 'Browse the current plain VexFlow rendering test suite.',
  // },
  {
    route: 'DocumentRenderer',
    title: 'Document Renderer',
    description: 'Placeholder for the document layout renderer workflow.',
  },
  {
    route: 'EvenDocumentRenderer',
    title: 'Even Document Renderer',
    description:
      'Placeholder for evenly distributed document layout rendering.',
  },
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
    <Screen
      scrollable
      contentContainerStyle={styles.container}
      safeAreaEdges={['left', 'right', 'bottom']}
    >
      <Column gap={8}>
        <Heading level={4}>Examples</Heading>
      </Column>
      <Column gap={4}>
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
              <Text variant="muted" style={styles.linkDescription}>
                {item.description}
              </Text>
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
    gap: 4,
  },
  linkCard: {
    borderRadius: 4,
    borderWidth: 1,
    padding: 4,
  },
  linkCardPressed: {
    opacity: 0.85,
  },
  linkContent: {
    gap: 2,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  linkDescription: {
    fontSize: 10,
  },
});

export default Main;
