import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

import DropDown from './DropDown';

const mockUseColorScheme = jest.fn(() => 'light');

jest.mock('../../hooks/useColorScheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

const OPTIONS = [
  { label: 'C4', value: 'c/4' },
  { label: 'D4', value: 'd/4' },
  { label: 'E4', value: 'e/4' },
];

describe('DropDown', () => {
  it('uses light theme colors by default', () => {
    const { getByTestId } = render(
      <DropDown options={OPTIONS} value="d/4" onChange={() => {}} />
    );

    const trigger = getByTestId('dropDownTrigger');
    const triggerStyle = Array.isArray(trigger.props.style)
      ? Object.assign({}, ...trigger.props.style.filter(Boolean))
      : trigger.props.style;

    expect(triggerStyle.backgroundColor).toBe('#ffffff');
    expect(triggerStyle.borderColor).toBe('#d4d4d8');
  });

  it('uses dark theme colors when color scheme is dark', () => {
    mockUseColorScheme.mockReturnValueOnce('dark');

    const { getByTestId } = render(
      <DropDown options={OPTIONS} value="d/4" onChange={() => {}} />
    );

    const trigger = getByTestId('dropDownTrigger');
    const triggerStyle = Array.isArray(trigger.props.style)
      ? Object.assign({}, ...trigger.props.style.filter(Boolean))
      : trigger.props.style;

    expect(triggerStyle.backgroundColor).toBe('#111827');
    expect(triggerStyle.borderColor).toBe('#374151');
  });

  it('renders selected option label', () => {
    const { getByText } = render(
      <DropDown options={OPTIONS} value="d/4" onChange={() => {}} />
    );

    expect(getByText('D4')).toBeTruthy();
  });

  it('opens menu when trigger is pressed', () => {
    const { getByTestId, getByText } = render(
      <DropDown options={OPTIONS} value="c/4" onChange={() => {}} />
    );

    fireEvent.press(getByTestId('dropDownTrigger'));

    expect(getByText('E4')).toBeTruthy();
  });

  it('calls onChange and closes menu on option select', () => {
    const handleChange = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <DropDown options={OPTIONS} value="c/4" onChange={handleChange} />
    );

    fireEvent.press(getByTestId('dropDownTrigger'));
    fireEvent.press(getByText('E4'));

    expect(handleChange).toHaveBeenCalledWith('e/4');
    expect(queryByText('E4')).toBeNull();
  });
});
