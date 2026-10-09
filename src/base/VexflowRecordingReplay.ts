import {
  BlendMode,
  ClipOp,
  PaintStyle,
  Skia,
  StrokeCap,
  type SkCanvas,
  type SkColor,
  type SkImageFilter,
  type SkPaint,
  type SkPathBuilder,
  type SkPathEffect,
  type SkTypefaceFontProvider,
} from 'react-native-skia';

import FontManager from './FontManager';
import type {
  VexflowRecordingCommand,
  VexflowRecordingFont,
  VexflowRecordingLineCap,
  VexflowRecordingPaint,
  VexflowRecordingPathCommand,
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
 * Skia objects one replay call allocates once and reuses across its commands.
 * A recording uses a handful of distinct colors, glows and dashes but
 * references them thousands of times, so each is created on first use and
 * cached by value. Everything here is disposed when the replay ends: under
 * NativeState only GC would free it otherwise.
 */
type ReplayPool = {
  colors: Record<string, SkColor>;
  glows: Record<string, SkImageFilter>;
  dashes: Record<string, SkPathEffect>;
  fillPaint: SkPaint;
  strokePaint: SkPaint;
  /** Created on the first `clearRect`; most recordings never clear a rect. */
  clearPaint: SkPaint | null;
  pathBuilder: SkPathBuilder;
};

function getCachedColor(color: string, pool: ReplayPool): SkColor {
  'worklet';

  return (pool.colors[color] ??= Skia.Color(color));
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
  pool: ReplayPool
) {
  'worklet';

  if (paint.shadowColor == null) {
    // Pooled paints carry state between commands — explicitly clear a filter
    // a previous command may have set.
    skPaint.setImageFilter(null);
    return;
  }

  const sigma = shadowBlurToSigma(paint.shadowBlur ?? 0);
  const key = `${paint.shadowColor}|${sigma}`;

  skPaint.setImageFilter(
    (pool.glows[key] ??= Skia.ImageFilter.MakeDropShadow(
      0,
      0,
      sigma,
      sigma,
      getCachedColor(paint.shadowColor, pool)
    ))
  );
}

function applyDash(
  skPaint: SkPaint,
  lineDash: number[] | undefined,
  pool: ReplayPool
) {
  'worklet';

  if (lineDash == null || lineDash.length === 0) {
    skPaint.setPathEffect(null);
    return;
  }

  skPaint.setPathEffect(
    (pool.dashes[lineDash.join(',')] ??= Skia.PathEffect.MakeDash(lineDash))
  );
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
function createReplayPool(): ReplayPool {
  'worklet';

  const fillPaint = Skia.Paint();
  fillPaint.setStyle(PaintStyle.Fill);
  fillPaint.setAntiAlias(true);

  const strokePaint = Skia.Paint();
  strokePaint.setStyle(PaintStyle.Stroke);
  strokePaint.setAntiAlias(true);

  return {
    colors: {},
    glows: {},
    dashes: {},
    fillPaint,
    strokePaint,
    clearPaint: null,
    pathBuilder: Skia.PathBuilder.Make(),
  };
}

/**
 * Paints keep their own reference to an image filter / path effect, and a
 * recorded picture copies the paint state it drew with, so disposing the JS
 * handles here never invalidates what was drawn.
 */
function disposeReplayPool(pool: ReplayPool) {
  'worklet';

  for (const key in pool.glows) {
    pool.glows[key]!.dispose();
  }
  for (const key in pool.dashes) {
    pool.dashes[key]!.dispose();
  }
  pool.fillPaint.dispose();
  pool.strokePaint.dispose();
  pool.clearPaint?.dispose();
  pool.pathBuilder.dispose();
}

function configureFillPaint(
  paint: VexflowRecordingPaint,
  pool: ReplayPool
): SkPaint {
  'worklet';

  const skPaint = pool.fillPaint;
  skPaint.setColor(getCachedColor(paint.color, pool));
  applyGlow(skPaint, paint, pool);

  return skPaint;
}

function configureStrokePaint(
  paint: VexflowRecordingPaint,
  pool: ReplayPool
): SkPaint {
  'worklet';

  const skPaint = pool.strokePaint;
  skPaint.setColor(getCachedColor(paint.color, pool));
  skPaint.setStrokeWidth(paint.strokeWidth ?? 1);
  skPaint.setStrokeCap(mapRecordingLineCap(paint.strokeCap ?? 'butt'));
  applyGlow(skPaint, paint, pool);
  applyDash(skPaint, paint.lineDash, pool);

  return skPaint;
}

function getClearPaint(pool: ReplayPool): SkPaint {
  'worklet';

  if (pool.clearPaint == null) {
    pool.clearPaint = Skia.Paint();
    pool.clearPaint.setBlendMode(BlendMode.Clear);
  }

  return pool.clearPaint;
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
      builder.addRect(command.rect);
      break;
    case 'addArc':
      builder.addArc(command.rect, command.startDegrees, command.sweepDegrees);
      break;
    case 'close':
      builder.close();
      break;
    default:
      assertNever(command);
  }
}

/**
 * Build the recorded path in the pooled builder (`detach` hands over the path
 * and resets the builder for the next command), draw it, and free it at once:
 * the canvas copies the path at the draw call.
 */
function drawRecordedPath(
  canvas: SkCanvas,
  path: readonly VexflowRecordingPathCommand[],
  skPaint: SkPaint,
  builder: SkPathBuilder
) {
  'worklet';

  for (const command of path) {
    applyPathCommand(builder, command);
  }

  const skPath = builder.detach();
  canvas.drawPath(skPath, skPaint);
  skPath.dispose();
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
  const pool = createReplayPool();

  try {
    for (const command of commands) {
      switch (command.type) {
        case 'clear':
          canvas.clear(getCachedColor(command.color, pool));
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
          canvas.clipRect(command.rect, ClipOp.Intersect, true);
          break;
        case 'fillRect':
          canvas.drawRect(
            command.rect,
            configureFillPaint(
              resolveStyle(
                command.paint,
                command.groupId,
                'fill',
                styleOverrides
              ),
              pool
            )
          );
          break;
        case 'clearRect':
          canvas.drawRect(command.rect, getClearPaint(pool));
          break;
        case 'fillPath':
          drawRecordedPath(
            canvas,
            command.path,
            configureFillPaint(
              resolveStyle(
                command.paint,
                command.groupId,
                'fill',
                styleOverrides
              ),
              pool
            ),
            pool.pathBuilder
          );
          break;
        case 'strokePath':
          drawRecordedPath(
            canvas,
            command.path,
            configureStrokePaint(
              resolveStyle(
                command.paint,
                command.groupId,
                'stroke',
                styleOverrides
              ),
              pool
            ),
            pool.pathBuilder
          );
          break;
        case 'fillText':
          canvas.drawText(
            command.text,
            command.x,
            command.y,
            configureFillPaint(
              resolveStyle(
                command.paint,
                command.groupId,
                'fill',
                styleOverrides
              ),
              pool
            ),
            createFont(fontManager, command.font)
          );
          break;
        default:
          assertNever(command);
      }
    }
  } finally {
    disposeReplayPool(pool);
  }
}
