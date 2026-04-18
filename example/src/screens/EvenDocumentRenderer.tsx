import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen, Text } from '../components';

const EvenDocumentRenderer: React.FC = () => {
  return (
    <Screen
      contentContainerStyle={styles.container}
      safeAreaEdges={['left', 'right', 'bottom']}
    >
      <Text variant="muted">
        Placeholder for evenly spaced document layout rendering.
      </Text>
    </Screen>
  );
};

export default EvenDocumentRenderer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
