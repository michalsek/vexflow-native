import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Row, Screen, Text } from '../../components';
import type { ExampleStackParamList } from '../../navigation/ExampleStackParamList';
import { PARITY_CASES, PARITY_SCHEMES } from './parityCases';

type ParityGalleryProps = NativeStackScreenProps<
  ExampleStackParamList,
  'ParityGallery'
>;

const ParityGallery: React.FC<ParityGalleryProps> = ({ navigation }) => (
  <Screen scrollable safeAreaEdges={['left', 'right', 'bottom']}>
    {PARITY_CASES.map(({ id }) => (
      <Row key={id} align="center" gap={8} style={styles.row}>
        <Text style={styles.name}>{id}</Text>
        {PARITY_SCHEMES.map((scheme) => (
          <Pressable
            key={scheme}
            testID={`parity-open-${id}-${scheme}`}
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('ParityCase', { case: id, scheme })
            }
            style={styles.button}
          >
            <Text>{scheme === 'light' ? 'Light' : 'Dark'}</Text>
          </Pressable>
        ))}
      </Row>
    ))}
  </Screen>
);

export default ParityGallery;

const styles = StyleSheet.create({
  button: {
    borderColor: '#9ca3af',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  name: {
    flex: 1,
  },
  row: {
    paddingVertical: 4,
  },
});
