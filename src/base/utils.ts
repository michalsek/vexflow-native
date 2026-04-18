import { StrokeCap } from '@shopify/react-native-skia';

// Basic color name support (limited to a few common colors for now)
const colorMap: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  // Add more colors as needed
};

export function parseStyleToColor(style: string): string {
  if (
    style.startsWith('#') ||
    style.startsWith('rgb') ||
    style.startsWith('hsl')
  ) {
    return style;
  }

  return colorMap[style.toLowerCase()] || '#000000'; // Default to black if unknown
}

export function mapLineCap(cap: string): StrokeCap {
  switch (cap) {
    case 'butt':
      return StrokeCap.Butt;
    case 'round':
      return StrokeCap.Round;
    case 'square':
      return StrokeCap.Square;
    default:
      return StrokeCap.Butt;
  }
}
