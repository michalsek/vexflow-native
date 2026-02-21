import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import Column from './Column';

describe('Column', () => {
  it('renders children in container', () => {
    const { getByText } = render(
      <Column>
        <Text>A</Text>
      </Column>
    );

    expect(getByText('A')).toBeTruthy();
  });
});
