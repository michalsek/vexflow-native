// Resolves content padding based on safe-area settings.
export function getScreenPadding(
  padding: number,
  disableSafeArea: boolean
): number {
  if (disableSafeArea) {
    return 0;
  }

  return padding;
}
