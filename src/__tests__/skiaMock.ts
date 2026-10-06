import { jest } from '@jest/globals';
import type * as RNSkia from 'react-native-skia';

/** T's member names only (nested factories included): a member renamed or dropped in a skia bump fails `yarn typecheck`. */
export type Stub<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? unknown
    : Stub<T[K]>;
};

/** Enum whose members read as their own names ('Fill', 'Bold'). */
const names = <E>() => new Proxy({}, { get: (_target, key) => key }) as E;

const host = <T extends { __typename__: string }>(
  __typename__: T['__typename__']
) => ({ __typename__, dispose: jest.fn() });

export const BlendMode = names<typeof RNSkia.BlendMode>();
export const ClipOp = names<typeof RNSkia.ClipOp>();
export const FontSlant = names<typeof RNSkia.FontSlant>();
export const FontWeight = names<typeof RNSkia.FontWeight>();
export const FontWidth = names<typeof RNSkia.FontWidth>();
export const PaintStyle = names<typeof RNSkia.PaintStyle>();
export const StrokeCap = names<typeof RNSkia.StrokeCap>();

export const Canvas = 'Canvas';
export const Group = 'Group';
export const Picture = 'Picture';
export const RoundedRect = 'RoundedRect';

export const useCanvasRef = () => ({ current: null });

/** Shared by every `Skia.PictureRecorder()` so tests read one call log. */
export const pictureRecorder = {
  ...host<RNSkia.SkPictureRecorder>('PictureRecorder'),
  beginRecording: jest.fn(
    () => ({ save: jest.fn() } satisfies Stub<RNSkia.SkCanvas>)
  ),
  finishRecordingAsPicture: jest.fn(() => host<RNSkia.SkPicture>('Picture')),
} satisfies Stub<RNSkia.SkPictureRecorder>;

export const Skia = {
  Color: jest.fn((color: string) => `color:${color}`),
  Font: jest.fn(),
  FontMgr: { System: jest.fn() },
  ImageFilter: {
    MakeDropShadow: jest.fn(() => host<RNSkia.SkImageFilter>('ImageFilter')),
  },
  Paint: jest.fn(
    () =>
      ({
        ...host<RNSkia.SkPaint>('Paint'),
        setAntiAlias: jest.fn(),
        setBlendMode: jest.fn(),
        setColor: jest.fn(),
        setImageFilter: jest.fn(),
        setPathEffect: jest.fn(),
        setStrokeCap: jest.fn(),
        setStrokeWidth: jest.fn(),
        setStyle: jest.fn(),
      } satisfies Stub<RNSkia.SkPaint>)
  ),
  PathBuilder: {
    Make: jest.fn(
      () =>
        ({
          ...host<RNSkia.SkPathBuilder>('PathBuilder'),
          addArc: jest.fn(),
          addRect: jest.fn(),
          build: jest.fn(() => host<RNSkia.SkPath>('Path')),
          close: jest.fn(),
          cubicTo: jest.fn(),
          lineTo: jest.fn(),
          moveTo: jest.fn(),
          quadTo: jest.fn(),
        } satisfies Stub<RNSkia.SkPathBuilder>)
    ),
  },
  PathEffect: {
    MakeDash: jest.fn(() => host<RNSkia.SkPathEffect>('PathEffect')),
  },
  PictureRecorder: jest.fn(() => pictureRecorder),
  RRectXY: jest.fn((rect: unknown, rx: number, ry: number) => ({
    rect,
    rx,
    ry,
  })),
  XYWHRect: jest.fn((x: number, y: number, width: number, height: number) => ({
    x,
    y,
    width,
    height,
  })),
} satisfies Stub<typeof RNSkia.Skia>;
