import React from 'react';
import { StyleSheet } from 'react-native';

import { Screen, Text } from '../components';

const DocumentRenderer: React.FC = () => {
  return (
    <Screen
      contentContainerStyle={styles.container}
      safeAreaEdges={['left', 'right', 'bottom']}
    >
      <Text variant="muted">
        Placeholder for rendering scores in a document layout flow.
      </Text>
    </Screen>
  );
};

export default DocumentRenderer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
