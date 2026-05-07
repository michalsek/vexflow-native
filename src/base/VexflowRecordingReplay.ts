import {
  BlendMode,
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  type SkCanvas,
  type SkPaint,
  type SkPathBuilder,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

import FontManager from './FontManager';
import type {
  VexflowRecordingCommand,
  VexflowRecordingFont,
  VexflowRecordingLineCap,
  VexflowRecordingPaint,
  VexflowRecordingPathCommand,
  VexflowRecordingRect,
} from './VexflowRecordingTypes';

function toSkiaRect(rect: VexflowRecordingRect) {
  'worklet';

  return Skia.XYWHRect(rect.x, rect.y, rect.width, rect.height);
}

function mapRecordingLineCap(cap: VexflowRecordingLineCap): StrokeCap {
  'worklet';

  switch (cap) {
    case 'round':
      return StrokeCap.Round;
    case 'square':
      return StrokeCap.Square;
    case 'butt':
    default:
      return StrokeCap.Butt;
  }
}

function createFillPaint(paint: VexflowRecordingPaint): SkPaint {
  'worklet';

  const skPaint = Skia.Paint();
  skPaint.setStyle(PaintStyle.Fill);
  skPaint.setAntiAlias(true);
  skPaint.setColor(Skia.Color(paint.color));

  return skPaint;
}

function createStrokePaint(paint: VexflowRecordingPaint): SkPaint {
  'worklet';

  const skPaint = Skia.Paint();
  skPaint.setStyle(PaintStyle.Stroke);
  skPaint.setAntiAlias(true);
  skPaint.setColor(Skia.Color(paint.color));
  skPaint.setStrokeWidth(paint.strokeWidth ?? 1);
  skPaint.setStrokeCap(mapRecordingLineCap(paint.strokeCap ?? 'butt'));

  return skPaint;
}

function createClearPaint(): SkPaint {
  'worklet';

  const clearPaint = Skia.Paint();
  clearPaint.setBlendMode(BlendMode.Clear);

  return clearPaint;
}

function createFont(fontManager: FontManager, font: VexflowRecordingFont) {
  'worklet';

  return fontManager.createSkFont(
    font.font,
    font.size,
    font.weight,
    font.style
  );
}

function assertNever(value: never): never {
  throw new Error(`Unexpected Vexflow recording command: ${String(value)}`);
}

function applyPathCommand(
  builder: SkPathBuilder,
  command: VexflowRecordingPathCommand
) {
  'worklet';

  switch (command.type) {
    case 'moveTo':
      builder.moveTo(command.x, command.y);
      break;
    case 'lineTo':
      builder.lineTo(command.x, command.y);
      break;
    case 'cubicTo':
      builder.cubicTo(
        command.cp1x,
        command.cp1y,
        command.cp2x,
        command.cp2y,
        command.x,
        command.y
      );
      break;
    case 'quadTo':
      builder.quadTo(command.cpx, command.cpy, command.x, command.y);
      break;
    case 'addRect':
      builder.addRect(toSkiaRect(command.rect));
      break;
    case 'addArc':
      builder.addArc(
        toSkiaRect(command.rect),
        command.startDegrees,
        command.sweepDegrees
      );
      break;
    case 'close':
      builder.close();
      break;
    default:
      assertNever(command);
  }
}

function buildPath(path: readonly VexflowRecordingPathCommand[]) {
  'worklet';

  const builder = Skia.PathBuilder.Make();

  for (const command of path) {
    applyPathCommand(builder, command);
  }

  return builder.build();
}

export function renderVexflowRecordingCommands(
  canvas: SkCanvas,
  commands: readonly VexflowRecordingCommand[],
  fontProvider: SkTypefaceFontProvider,
  defaultFont: string
) {
  'worklet';

  const fontManager = new FontManager(fontProvider, defaultFont);

  for (const command of commands) {
    switch (command.type) {
      case 'clear':
        canvas.clear(Skia.Color(command.color));
        break;
      case 'save':
        canvas.save();
        break;
      case 'restore':
        canvas.restore();
        break;
      case 'scale':
        canvas.scale(command.x, command.y);
        break;
      case 'translate':
        canvas.translate(command.x, command.y);
        break;
      case 'clipRect':
        canvas.clipRect(toSkiaRect(command.rect), ClipOp.Intersect, true);
        break;
      case 'fillRect':
        canvas.drawRect(
          toSkiaRect(command.rect),
          createFillPaint(command.paint)
        );
        break;
      case 'clearRect':
        canvas.drawRect(toSkiaRect(command.rect), createClearPaint());
        break;
      case 'fillPath':
        canvas.drawPath(
          buildPath(command.path),
          createFillPaint(command.paint)
        );
        break;
      case 'strokePath':
        canvas.drawPath(
          buildPath(command.path),
          createStrokePaint(command.paint)
        );
        break;
      case 'fillText':
        canvas.drawText(
          command.text,
          command.x,
          command.y,
          createFillPaint(command.paint),
          createFont(fontManager, command.font)
        );
        break;
      default:
        assertNever(command);
    }
  }
}
