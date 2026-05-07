import type { SkFont } from '@shopify/react-native-skia';
import { Font } from 'vexflow';
import type VexflowRecordingContext from './VexflowRecordingContext';

class TextMeasureContext {
  __workletClass = true;

  private context: VexflowRecordingContext;
  private currentFont = '';

  constructor(context: VexflowRecordingContext) {
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
    return this.currentFont;
  }

  set(value: string) {
    this.currentFont = value;
    this.context.setFont(Font.fromCSSString(value));
  }

  get font() {
    return this.get();
  }

  set font(value: string) {
    this.set(value);
  }
}

export default TextMeasureContext;

function getAdvanceWidth(font: SkFont, text: string): number {
  const glyphs = font.getGlyphIDs(text);
  const widths = font.getGlyphWidths(glyphs);

  return widths.reduce((sum, width) => sum + width, 0);
}
