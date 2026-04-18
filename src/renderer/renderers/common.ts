import { BarlineType, Fraction, type StaveNote } from 'vexflow';

import type { Articulation, Barline, Clef, Duration, Meter } from '../../state';
import type { RendererRect } from '../types';
import type SkiaVexflowContext from '../../base/SkiaVexflowContext';

export function createRect(
  x: number,
  y: number,
  width: number,
  height: number
): RendererRect {
  return { x, y, width, height };
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function measureTextWidth(
  context: Pick<SkiaVexflowContext, 'getMeasurementContext'>,
  text: string
): number {
  return context.getMeasurementContext().measureText(text).width;
}

export function toVexflowPitch(pitch: {
  step: string;
  octave: number;
  accidental?: string;
}): string {
  return `${pitch.step.toLowerCase()}${pitch.accidental ?? ''}/${pitch.octave}`;
}

export function toRestKey(clef: Clef): string {
  return clef === 'bass' ? 'd/3' : 'b/4';
}

export function toVexflowDuration(duration: Duration, isRest: boolean): string {
  return `${duration.length}${isRest ? 'r' : ''}`;
}

export function toStemDirection(
  stemDirection: 'up' | 'down' | 'auto' | undefined
): number | undefined {
  if (stemDirection === 'up') {
    return 1;
  }

  if (stemDirection === 'down') {
    return -1;
  }

  return undefined;
}

export function buildBeamGroups(
  meter: Meter | undefined
): Fraction[] | undefined {
  if (!meter?.beaming?.length) {
    return undefined;
  }

  return meter.beaming.map((group) => new Fraction(group, meter.beatUnit));
}

export function mapBarlineType(barline: Barline | undefined): number {
  switch (barline) {
    case 'double':
      return BarlineType.DOUBLE;
    case 'end':
    case 'final':
      return BarlineType.END;
    case 'repeat-begin':
      return BarlineType.REPEAT_BEGIN;
    case 'repeat-end':
      return BarlineType.REPEAT_END;
    case 'single':
    default:
      return BarlineType.SINGLE;
  }
}

export function mapArticulationType(
  articulation: Articulation
): string | undefined {
  switch (articulation) {
    case 'staccato':
      return 'a.';
    case 'tenuto':
      return 'a-';
    case 'accent':
      return 'a>';
    case 'marcato':
      return 'a^';
    case 'staccatissimo':
      return 'av';
    case 'fermata':
      return 'a@a';
    default:
      return undefined;
  }
}

export function resolveRect(
  box:
    | {
        getX?: () => number;
        getY?: () => number;
        getW?: () => number;
        getH?: () => number;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
      }
    | undefined,
  fallback: RendererRect
): RendererRect {
  if (!box) {
    return fallback;
  }

  return {
    x: box.getX?.() ?? box.x ?? fallback.x,
    y: box.getY?.() ?? box.y ?? fallback.y,
    width: box.getW?.() ?? box.w ?? fallback.width,
    height: box.getH?.() ?? box.h ?? fallback.height,
  };
}

export function extractNoteRect(
  tickable: StaveNote,
  fallback: RendererRect
): RendererRect {
  const boundingBox = tickable.getBoundingBox?.();

  if (boundingBox) {
    return resolveRect(boundingBox, fallback);
  }

  const tickableLike = tickable as StaveNote & {
    getNoteHeadBounds?: () => Array<{
      y_top: number;
      y_bottom: number;
      x: number;
      w: number;
    }>;
    getNoteHeadBeginX?: () => number;
    getNoteHeadEndX?: () => number;
    getYs?: () => number[];
  };
  const noteHeadBounds = tickableLike.getNoteHeadBounds?.() as unknown as
    | Array<{
        y_top: number;
        y_bottom: number;
        x: number;
        w: number;
      }>
    | undefined;

  if (Array.isArray(noteHeadBounds) && noteHeadBounds.length > 0) {
    const minX = Math.min(...noteHeadBounds.map((bound) => bound.x));
    const maxX = Math.max(...noteHeadBounds.map((bound) => bound.x + bound.w));
    const minY = Math.min(...noteHeadBounds.map((bound) => bound.y_top));
    const maxY = Math.max(...noteHeadBounds.map((bound) => bound.y_bottom));

    return createRect(minX, minY, maxX - minX, maxY - minY);
  }

  const startX = tickableLike.getNoteHeadBeginX?.() ?? fallback.x;
  const endX = tickableLike.getNoteHeadEndX?.() ?? startX + 12;
  const ys = tickableLike.getYs?.() ?? [fallback.y];
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return createRect(startX, minY - 6, endX - startX, maxY - minY + 12);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}
