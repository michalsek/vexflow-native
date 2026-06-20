import type { FontInfo } from 'vexflow';

export type VexflowRecordingLineCap = 'butt' | 'round' | 'square';

export interface VexflowRecordingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VexflowRecordingPaint {
  color: string;
  strokeCap?: VexflowRecordingLineCap;
  strokeWidth?: number;
  /**
   * Glow/shadow colour (CSS `shadowColor`). Recorded from
   * `VexflowRecordingContext.setShadowColor`. Replayed in Skia as a drop-shadow
   * image filter with `dx = dy = 0` (a glow around the ink), and overridable per
   * group via `VexflowStyleOverride.shadowColor`.
   */
  shadowColor?: string;
  /**
   * Glow/shadow blur radius in px (CSS `shadowBlur`). Recorded from
   * `VexflowRecordingContext.setShadowBlur`. Mapped to a Gaussian sigma of
   * `shadowBlur / 2` at replay. Only takes effect when `shadowColor` is set.
   */
  shadowBlur?: number;
  /**
   * Dash pattern (CSS `setLineDash`), stroke only. Recorded from
   * `VexflowRecordingContext.setLineDash`. Replayed as a Skia dash path effect
   * and overridable per group via `VexflowStyleOverride.lineDash`.
   */
  lineDash?: number[];
}

/**
 * A granular, disambiguated style override applied to every command sharing a
 * `groupId` at replay (see `renderVexflowRecordingCommands`'s `styleOverrides`).
 *
 * Each field is merged OVER the recorded paint, so any field left undefined
 * falls back to whatever was recorded. An override is resolved per command
 * against the paint that command uses (fill vs stroke), which is why fill and
 * stroke colours are separable here — the consumer can, e.g., fill a notehead
 * green while stroking its stem red.
 */
export interface VexflowStyleOverride {
  /** Fill paint colour (noteheads, rests, glyphs, filled shapes). */
  fillColor?: string;
  /** Stroke paint colour (stems, ledger lines, beam edges). */
  strokeColor?: string;
  /** Shorthand applied to both fill and stroke (lower precedence than the two above). */
  color?: string;
  /** Glow colour (CSS `shadowColor`), applied to both fill and stroke so the whole note glows. */
  shadowColor?: string;
  /** Glow blur radius in px (CSS `shadowBlur`). Only takes effect when a `shadowColor` resolves. */
  shadowBlur?: number;
  /** Dash pattern (stroke only). */
  lineDash?: number[];
}

export interface VexflowRecordingFont {
  font?: string | FontInfo;
  size?: string | number;
  weight?: string | number;
  style?: string;
}

export type VexflowRecordingPathCommand =
  | {
      type: 'moveTo';
      x: number;
      y: number;
    }
  | {
      type: 'lineTo';
      x: number;
      y: number;
    }
  | {
      type: 'cubicTo';
      cp1x: number;
      cp1y: number;
      cp2x: number;
      cp2y: number;
      x: number;
      y: number;
    }
  | {
      type: 'quadTo';
      cpx: number;
      cpy: number;
      x: number;
      y: number;
    }
  | {
      type: 'addRect';
      rect: VexflowRecordingRect;
    }
  | {
      type: 'addArc';
      rect: VexflowRecordingRect;
      startDegrees: number;
      sweepDegrees: number;
    }
  | {
      type: 'close';
    };

/**
 * A recorded draw command. `groupId` (optional) is stamped by
 * `beginColorGroup`/`endColorGroup` on the recording context: a replay can then
 * recolor every command sharing a `groupId` from a `groupId -> color` override
 * map without re-recording. Untagged commands (staff lines, clefs, …) are never
 * overridden.
 */
export type VexflowRecordingCommand = { groupId?: string } & (
  | {
      type: 'clear';
      color: string;
    }
  | {
      type: 'save';
    }
  | {
      type: 'restore';
    }
  | {
      type: 'scale';
      x: number;
      y: number;
    }
  | {
      type: 'translate';
      x: number;
      y: number;
    }
  | {
      type: 'clipRect';
      rect: VexflowRecordingRect;
    }
  | {
      type: 'fillRect';
      rect: VexflowRecordingRect;
      paint: VexflowRecordingPaint;
    }
  | {
      type: 'clearRect';
      rect: VexflowRecordingRect;
    }
  | {
      type: 'fillPath';
      path: VexflowRecordingPathCommand[];
      paint: VexflowRecordingPaint;
    }
  | {
      type: 'strokePath';
      path: VexflowRecordingPathCommand[];
      paint: VexflowRecordingPaint;
    }
  | {
      type: 'fillText';
      text: string;
      x: number;
      y: number;
      paint: VexflowRecordingPaint;
      font: VexflowRecordingFont;
    }
);
