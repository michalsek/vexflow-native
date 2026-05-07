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

export type VexflowRecordingCommand =
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
    };
