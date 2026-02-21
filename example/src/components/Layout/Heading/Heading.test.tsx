import { render } from '@testing-library/react-native';

import Heading from './Heading';

describe('Heading', () => {
  it('renders heading content', () => {
    const { getByText } = render(<Heading level={2}>Title</Heading>);

    expect(getByText('Title')).toBeTruthy();
  });
});
