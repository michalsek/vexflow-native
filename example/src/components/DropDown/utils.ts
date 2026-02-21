import { DROP_DOWN_PALETTE } from './constants';
import { type DropDownOption } from './types';

export function getSelectedLabel<TValue extends string>(
  options: DropDownOption<TValue>[],
  value: TValue,
  placeholder: string
) {
  return options.find((option) => option.value === value)?.label ?? placeholder;
}

export function getDropDownPalette(isDark: boolean) {
  return isDark ? DROP_DOWN_PALETTE.dark : DROP_DOWN_PALETTE.light;
}
