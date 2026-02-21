import { render } from '@testing-library/react-native';

import Spacer from './Spacer';

describe('Spacer', () => {
  it('renders spacer view', () => {
    const { getByTestId } = render(<Spacer testID="spacer" />);

    expect(getByTestId('spacer')).toBeTruthy();
  });
});
