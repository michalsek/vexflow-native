function toStableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toStableValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const normalized = toStableValue(
          (value as Record<string, unknown>)[key]
        );

        if (normalized !== undefined) {
          result[key] = normalized;
        }

        return result;
      }, {});
  }

  return value;
}

export function stableSerialize(value: unknown): string {
  const stableValue = toStableValue(value);

  return JSON.stringify(stableValue === undefined ? null : stableValue);
}
