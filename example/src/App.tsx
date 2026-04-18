import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { enableScreens } from 'react-native-screens';

import { useColorScheme } from './hooks/useColorScheme';
import type { ExampleStackParamList } from './navigation/ExampleStackParamList';
// import DocumentRenderer from './screens/DocumentRenderer';
// import EvenDocumentRenderer from './screens/EvenDocumentRenderer';
// import InfiniteScore from './screens/InfiniteScore';
import Main from './screens/Main';
// import VexflowTestSuite from './screens/VexflowTestSuite';

enableScreens();

const Stack = createNativeStackNavigator<ExampleStackParamList>();

const App: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: isDark ? '#030712' : '#f9fafb',
      border: isDark ? '#1f2937' : '#e5e7eb',
      card: isDark ? '#030712' : '#f9fafb',
      primary: isDark ? '#f9fafb' : '#111827',
      text: isDark ? '#f9fafb' : '#111827',
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          contentStyle: {
            backgroundColor: isDark ? '#030712' : '#f9fafb',
          },
          headerStyle: {
            backgroundColor: isDark ? '#030712' : '#f9fafb',
          },
          headerTintColor: isDark ? '#f9fafb' : '#111827',
        }}
      >
        <Stack.Screen
          name="Main"
          component={Main}
          options={{ title: 'Examples' }}
        />
        {/* <Stack.Screen
          name="VexflowTestSuite"
          component={VexflowTestSuite}
          options={{ title: 'VexFlow Test Suite' }}
        />
        <Stack.Screen
          name="DocumentRenderer"
          component={DocumentRenderer}
          options={{ title: 'Document Renderer' }}
        />
        <Stack.Screen
          name="EvenDocumentRenderer"
          component={EvenDocumentRenderer}
          options={{ title: 'Even Document Renderer' }}
        />
        <Stack.Screen
          name="InfiniteScore"
          component={InfiniteScore}
          options={{ title: 'Infinite Score' }}
        /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
