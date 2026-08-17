import {
  BlendMode,
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  type SkCanvas,
  type SkColor,
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
  VexflowStyleOverride,
} from './VexflowRecordingTypes';

/**
 * Map a CSS `shadowBlur` (a blur radius in px) to a Gaussian sigma for Skia's
 * drop-shadow filter. Canvas measures shadow blur as a radius; Skia's filter is
 * parameterised by sigma. `radius / 2` is the conventional approximation used
 * across Skia-backed canvas shims and gives a visually matching glow.
 */
function shadowBlurToSigma(shadowBlur: number): number {
  'worklet';

  return shadowBlur / 2;
}

/**
 * Per-replay `css color -> SkColor` cache: a recording uses a handful of
 * distinct colors but references them thousands of times.
 */
type SkColorCache = Record<string, SkColor>;

function getCachedColor(color: string, cache: SkColorCache): SkColor {
  'worklet';

  return (cache[color] ??= Skia.Color(color));
}

/**
 * Apply the recorded glow (CSS shadow) to a Skia paint as a drop-shadow image
 * filter. `dx = dy = 0` turns the drop shadow into a symmetric glow centred on
 * the ink; `MakeDropShadow` (not `…Only`) keeps the source content, so the note
 * still draws on top of its halo. No-op unless a `shadowColor` resolved.
 */
function applyGlow(
  skPaint: SkPaint,
  paint: VexflowRecordingPaint,
  colorCache: SkColorCache
) {
  'worklet';

  if (paint.shadowColor == null) {
    // Pooled paints carry state between commands — explicitly clear a filter
    // a previous command may have set.
    skPaint.setImageFilter(null);
    return;
  }

  const sigma = shadowBlurToSigma(paint.shadowBlur ?? 0);

  skPaint.setImageFilter(
    Skia.ImageFilter.MakeDropShadow(
      0,
      0,
      sigma,
      sigma,
      getCachedColor(paint.shadowColor, colorCache)
    )
  );
}

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

/**
 * One fill and one stroke paint are pooled per replay call and reconfigured
 * per command — Skia snapshots paint state into the canvas/display list at
 * each draw call, so mutating the pooled paint afterwards is safe. Optional
 * state (glow filter, dash effect) is explicitly reset on every configure so
 * nothing bleeds between commands.
 */
function createPooledFillPaint(): SkPaint {
  'worklet';

  const skPaint = Skia.Paint();
  skPaint.setStyle(PaintStyle.Fill);
  skPaint.setAntiAlias(true);

  return skPaint;
}

function createPooledStrokePaint(): SkPaint {
  'worklet';

  const skPaint = Skia.Paint();
  skPaint.setStyle(PaintStyle.Stroke);
  skPaint.setAntiAlias(true);

  return skPaint;
}

function configureFillPaint(
  skPaint: SkPaint,
  paint: VexflowRecordingPaint,
  colorCache: SkColorCache
): SkPaint {
  'worklet';

  skPaint.setColor(getCachedColor(paint.color, colorCache));
  applyGlow(skPaint, paint, colorCache);

  return skPaint;
}

function configureStrokePaint(
  skPaint: SkPaint,
  paint: VexflowRecordingPaint,
  colorCache: SkColorCache
): SkPaint {
  'worklet';

  skPaint.setColor(getCachedColor(paint.color, colorCache));
  skPaint.setStrokeWidth(paint.strokeWidth ?? 1);
  skPaint.setStrokeCap(mapRecordingLineCap(paint.strokeCap ?? 'butt'));
  applyGlow(skPaint, paint, colorCache);

  if (paint.lineDash != null && paint.lineDash.length > 0) {
    skPaint.setPathEffect(Skia.PathEffect.MakeDash(paint.lineDash));
  } else {
    skPaint.setPathEffect(null);
  }

  return skPaint;
}

function createClearPaint(): SkPaint {
  'worklet';

  const clearPaint = Skia.Paint();
  clearPaint.setBlendMode(BlendMode.Clear);

  return clearPaint;
}

type PaintKind = 'fill' | 'stroke';

/**
 * Resolve a recorded paint against an optional per-group style override map
 * (`groupId -> VexflowStyleOverride`), merging the override OVER the recorded
 * paint. Returns the original paint object (referentially) when no override
 * applies, so untagged chrome (staff lines, clefs, …) is never restyled and a
 * replay with no `styleOverrides` is byte-identical to a faithful replay.
 *
 * `kind` disambiguates which colour field wins: a fill command reads
 * `fillColor ?? color`, a stroke command reads `strokeColor ?? color`, each
 * falling back to the recorded colour. Glow (shadow) is applied to both kinds so
 * the whole note glows; dash is stroke-only. This is the seam that lets a single
 * recording be replayed many times in different styles (e.g. per-frame from a
 * shared value) without re-recording.
 */
function resolveStyle(
  paint: VexflowRecordingPaint,
  groupId: string | undefined,
  kind: PaintKind,
  styleOverrides?: Record<string, VexflowStyleOverride>
): VexflowRecordingPaint {
  'worklet';

  if (styleOverrides == null || groupId == null) {
    return paint;
  }

  const override = styleOverrides[groupId];

  if (override == null) {
    return paint;
  }

  const color =
    kind === 'fill'
      ? override.fillColor ?? override.color ?? paint.color
      : override.strokeColor ?? override.color ?? paint.color;

  return {
    ...paint,
    color,
    shadowColor: override.shadowColor ?? paint.shadowColor,
    shadowBlur: override.shadowBlur ?? paint.shadowBlur,
    // Dash is stroke-only; ignore any override.lineDash on fill commands.
    lineDash:
      kind === 'stroke' ? override.lineDash ?? paint.lineDash : paint.lineDash,
  };
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
  defaultFont: string,
  /**
   * Optional `groupId -> VexflowStyleOverride` map. Commands tagged (via
   * `beginColorGroup`/`endColorGroup`) with a `groupId` present here are drawn
   * with the override merged over their recorded paint — separate fill/stroke
   * colours, a glow (shadow), and a stroke dash are all expressible. Omit for a
   * byte-identical replay of the recorded style.
   */
  styleOverrides?: Record<string, VexflowStyleOverride>,
  /**
   * Optional pre-built FontManager to reuse across replays so its SkFont /
   * family caches survive between calls (e.g. one overlay replay per note).
   * Omitted, one is constructed per call — the original behavior.
   */
  replayFontManager?: FontManager
) {
  'worklet';

  const fontManager =
    replayFontManager ?? new FontManager(fontProvider, defaultFont);
  const colorCache: SkColorCache = {};
  const fillPaint = createPooledFillPaint();
  const strokePaint = createPooledStrokePaint();

  for (const command of commands) {
    switch (command.type) {
      case 'clear':
        canvas.clear(getCachedColor(command.color, colorCache));
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
          configureFillPaint(
            fillPaint,
            resolveStyle(
              command.paint,
              command.groupId,
              'fill',
              styleOverrides
            ),
            colorCache
          )
        );
        break;
      case 'clearRect':
        canvas.drawRect(toSkiaRect(command.rect), createClearPaint());
        break;
      case 'fillPath':
        canvas.drawPath(
          buildPath(command.path),
          configureFillPaint(
            fillPaint,
            resolveStyle(
              command.paint,
              command.groupId,
              'fill',
              styleOverrides
            ),
            colorCache
          )
        );
        break;
      case 'strokePath':
        canvas.drawPath(
          buildPath(command.path),
          configureStrokePaint(
            strokePaint,
            resolveStyle(
              command.paint,
              command.groupId,
              'stroke',
              styleOverrides
            ),
            colorCache
          )
        );
        break;
      case 'fillText':
        canvas.drawText(
          command.text,
          command.x,
          command.y,
          configureFillPaint(
            fillPaint,
            resolveStyle(
              command.paint,
              command.groupId,
              'fill',
              styleOverrides
            ),
            colorCache
          ),
          createFont(fontManager, command.font)
        );
        break;
      default:
        assertNever(command);
    }
  }
}
