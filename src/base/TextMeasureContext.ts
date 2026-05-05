import type { SkFont } from '@shopify/react-native-skia';
import type SkiaVexflowContext from './SkiaVexflowContext';

function logUnimplemented(methodName: string) {
  console.log(
    `TextMeasureContext: Method "${methodName}" is not implemented yet.`
  );
}

class TextMeasureContext {
  __workletClass = true;

  private context: SkiaVexflowContext;

  constructor(context: SkiaVexflowContext) {
    this.context = context;
  }

  measureText(text: string) {
    const currentFont = this.context.getCurrentSkFont();
    const rect = currentFont.measureText(text);

    const width = getAdvanceWidth(currentFont, text);
    const ascent = Math.max(0, -rect.y);
    const descent = Math.max(0, rect.y + rect.height);

    return {
      width,
      actualBoundingBoxAscent: ascent,
      actualBoundingBoxDescent: descent,
      fontBoundingBoxAscent: ascent,
      fontBoundingBoxDescent: descent,
      actualBoundingBoxLeft: rect.x,
      actualBoundingBoxRight: rect.x + rect.width,
    };
  }

  get() {
    logUnimplemented('get');
    return '';
  }

  set(_value: string) {
    logUnimplemented('set');
  }
}

export default TextMeasureContext;

function getAdvanceWidth(font: SkFont, text: string): number {
  const glyphs = font.getGlyphIDs(text);
  const widths = font.getGlyphWidths(glyphs);

  return widths.reduce((sum, width) => sum + width, 0);
}
