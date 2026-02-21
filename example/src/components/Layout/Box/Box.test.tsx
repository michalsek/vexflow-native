import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import Box from './Box';

describe('Box', () => {
  it('renders children', () => {
    const { getByText } = render(
      <Box>
        <Text>content</Text>
      </Box>
    );

    expect(getByText('content')).toBeTruthy();
  });
});
