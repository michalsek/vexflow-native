import type { SkFont } from 'react-native-skia';

import type { VexflowRecordingCommand } from '../base';
import type FontManager from '../base/FontManager';
import type { VexflowRecordingPathCommand } from '../base/VexflowRecordingTypes';

interface VerticalExtent {
  top: number;
  bottom: number;
}

interface VerticalBand {
  y: number;
  height: number;
}

/**
 * Grows each band to cover everything the recording draws for it. A command
 * belongs to the band its vertical centre is in, or else the nearest one.
 * Curve control points count as drawn, so a band can come out slightly taller
 * than its ink, never shorter.
 */
export function coverDrawnExtents<Band extends VerticalBand>(
  bands: readonly Band[],
  commands: readonly VexflowRecordingCommand[],
  fontManager: FontManager
): Band[] {
  const extents = bands.map(
    (band): VerticalExtent => ({ top: band.y, bottom: band.y + band.height })
  );
  const textExtents = new Map<SkFont, Map<string, VerticalExtent>>();

  for (const command of commands) {
    const drawn = commandExtent(command, fontManager, textExtents);
    const extent = drawn && nearestExtent(extents, bands, drawn);

    if (drawn && extent) {
      extent.top = Math.min(extent.top, drawn.top);
      extent.bottom = Math.max(extent.bottom, drawn.bottom);
    }
  }

  return bands.map((band, index) => ({
    ...band,
    y: extents[index]!.top,
    height: extents[index]!.bottom - extents[index]!.top,
  }));
}

function nearestExtent(
  extents: VerticalExtent[],
  bands: readonly VerticalBand[],
  drawn: VerticalExtent
): VerticalExtent | undefined {
  const centre = (drawn.top + drawn.bottom) / 2;
  let nearest: VerticalExtent | undefined;
  let nearestDistance = Infinity;

  bands.forEach((band, index) => {
    const distance = Math.max(band.y - centre, centre - band.y - band.height);

    if (distance < nearestDistance) {
      nearest = extents[index];
      nearestDistance = distance;
    }
  });

  return nearest;
}

function commandExtent(
  command: VexflowRecordingCommand,
  fontManager: FontManager,
  textExtents: Map<SkFont, Map<string, VerticalExtent>>
): VerticalExtent | undefined {
  switch (command.type) {
    case 'fillRect':
      return {
        top: command.rect.y,
        bottom: command.rect.y + command.rect.height,
      };
    case 'fillPath':
      return pathExtent(command.path, 0);
    case 'strokePath':
      return pathExtent(command.path, (command.paint.strokeWidth ?? 0) / 2);
    case 'fillText': {
      const { font, size, weight, style } = command.font;
      const skFont = fontManager.createSkFont(font, size, weight, style);
      const byText = textExtents.get(skFont) ?? new Map();
      let glyphs = byText.get(command.text);

      if (!glyphs) {
        const rect = skFont.measureText(command.text);

        glyphs = { top: rect.y, bottom: rect.y + rect.height };
        byText.set(command.text, glyphs);
        textExtents.set(skFont, byText);
      }

      return {
        top: command.y + glyphs.top,
        bottom: command.y + glyphs.bottom,
      };
    }
    default:
      return undefined;
  }
}

function pathExtent(
  path: VexflowRecordingPathCommand[],
  outset: number
): VerticalExtent | undefined {
  const ys = path.flatMap((segment) => {
    switch (segment.type) {
      case 'moveTo':
      case 'lineTo':
        return [segment.y];
      case 'quadTo':
        return [segment.cpy, segment.y];
      case 'cubicTo':
        return [segment.cp1y, segment.cp2y, segment.y];
      case 'addRect':
      case 'addArc':
        return [segment.rect.y, segment.rect.y + segment.rect.height];
      default:
        return [];
    }
  });

  return ys.length > 0
    ? { top: Math.min(...ys) - outset, bottom: Math.max(...ys) + outset }
    : undefined;
}
