import React from 'react';

import { Column, Heading, Screen, Text } from '../components';

const DocumentRenderer: React.FC = () => {
  return (
    <Screen contentContainerStyle={styles.container}>
      <Column gap={8}>
        <Heading level={2}>Document Renderer</Heading>
        <Text variant="muted">
          Placeholder for rendering scores in a document layout flow.
        </Text>
      </Column>
    </Screen>
  );
};

const styles = {
  container: {
    flexGrow: 1,
    justifyContent: 'center' as const,
  },
};

export default DocumentRenderer;
