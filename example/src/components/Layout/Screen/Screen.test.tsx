import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import Screen from './Screen';

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');

  return {
    SafeAreaView: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

describe('Screen', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Screen disableSafeArea>
        <Text>Body</Text>
      </Screen>
    );

    expect(getByText('Body')).toBeTruthy();
  });

  it('excludes top edge from safe area by default', () => {
    const { getByTestId } = render(
      <Screen testID="screen">
        <Text>Body</Text>
      </Screen>
    );

    expect(getByTestId('screen').props.edges).toEqual([
      'right',
      'bottom',
      'left',
    ]);
  });

  it('allows including top edge explicitly', () => {
    const { getByTestId } = render(
      <Screen
        testID="screen"
        safeAreaEdges={['top', 'right', 'bottom', 'left']}
      >
        <Text>Body</Text>
      </Screen>
    );

    expect(getByTestId('screen').props.edges).toEqual([
      'top',
      'right',
      'bottom',
      'left',
    ]);
  });
});
