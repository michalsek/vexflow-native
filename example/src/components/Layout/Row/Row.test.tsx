import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import Row from './Row';

describe('Row', () => {
  it('renders children in container', () => {
    const { getByText } = render(
      <Row>
        <Text>A</Text>
      </Row>
    );

    expect(getByText('A')).toBeTruthy();
  });
});
