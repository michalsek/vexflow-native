export type DropDownOption<TValue extends string = string> = {
  label: string;
  value: TValue;
};

export type DropDownProps<TValue extends string = string> = {
  options: DropDownOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
  placeholder?: string;
};
