import { describe, expect, it, jest } from '@jest/globals';

import type {
  LineCap,
  LineJoin,
  ParsedCssFont,
  VexflowCanvasDrawArgs,
  VexflowCanvasProps,
} from 'vexflow-native';
import type {
  RendererMeasure,
  RendererScore,
  RendererStaff,
  RendererVoice,
  RendererVoiceItem,
} from 'vexflow-native/renderer';
import type {
  Measure,
  Meter,
  Score,
  Staff,
  Voice,
  VoiceItem,
} from 'vexflow-native/state';

jest.mock('@shopify/react-native-skia', () => ({
  BlendMode: { Clear: 'clear' },
  Canvas: 'Canvas',
  PaintStyle: { Fill: 'fill', Stroke: 'stroke' },
  Picture: 'Picture',
  Skia: {
    Color: (color: string) => color,
    Font: jest.fn(),
    FontMgr: {
      System: jest.fn(() => ({
        countFamilies: jest.fn(() => 0),
        getFamilyName: jest.fn(() => 'MockFamily'),
        matchFamilyStyle: jest.fn(() => null),
      })),
    },
    Paint: jest.fn(() => ({
      setAntiAlias: jest.fn(),
      setBlendMode: jest.fn(),
      setColor: jest.fn(),
      setStrokeCap: jest.fn(),
      setStrokeJoin: jest.fn(),
      setStrokeWidth: jest.fn(),
      setStyle: jest.fn(),
    })),
    Path: {
      Make: jest.fn(() => ({
        addArc: jest.fn(),
        addPath: jest.fn(),
        addRect: jest.fn(),
        arcToOval: jest.fn(),
        close: jest.fn(),
        cubicTo: jest.fn(),
        lineTo: jest.fn(),
        moveTo: jest.fn(),
        quadTo: jest.fn(),
        reset: jest.fn(),
        transform: jest.fn(),
      })),
    },
    PictureRecorder: jest.fn(),
    XYWHRect: jest.fn(),
  },
  StrokeCap: {
    Butt: 'butt',
    Round: 'round',
    Square: 'square',
  },
  StrokeJoin: {
    Bevel: 'bevel',
    Miter: 'miter',
    Round: 'round',
  },
  useFont: jest.fn(() => null),
}));

import * as publicApi from './index';

const packageJson =
  require('../package.json') as typeof import('../package.json');

describe('root public API', () => {
  it('exposes only the supported runtime exports', () => {
    expect(
      Object.keys(publicApi)
        .filter((key) => key !== '__esModule')
        .sort()
    ).toEqual([
      'SkiaVexflowContext',
      'VEXFLOW_SCORE_COLORS',
      'VexflowCanvas',
      'parseCssFontShorthand',
      'toPxFontSize',
    ]);
  });

  it('exports the documented type surface from the package root', () => {
    const acceptProps = (_props: VexflowCanvasProps) => undefined;
    const acceptDrawArgs = (_args: VexflowCanvasDrawArgs) => undefined;
    const parsedFont = {
      family: 'Bravura',
      sizePx: 12,
    } satisfies ParsedCssFont;
    const lineCap = 'round' as LineCap;
    const lineJoin = 'bevel' as LineJoin;

    expect(acceptProps).toBeInstanceOf(Function);
    expect(acceptDrawArgs).toBeInstanceOf(Function);
    expect(parsedFont).toEqual({ family: 'Bravura', sizePx: 12 });
    expect(lineCap).toBe('round');
    expect(lineJoin).toBe('bevel');
    expect(publicApi.VEXFLOW_SCORE_COLORS.light.fill).toBe('#111827');
  });

  it('declares the root and subpath entrypoints in package exports', () => {
    expect(packageJson.exports).toMatchObject({
      '.': {
        source: './src/index.ts',
        types: './lib/typescript/src/index.d.ts',
        default: './lib/module/index.js',
      },
      './state': {
        source: './src/state/index.ts',
        types: './lib/typescript/src/state/index.d.ts',
        default: './lib/module/state/index.js',
      },
      './renderer': {
        source: './src/renderer/index.ts',
        types: './lib/typescript/src/renderer/index.d.ts',
        default: './lib/module/renderer/index.js',
      },
      './musicxml': {
        source: './src/musicxml/index.ts',
        types: './lib/typescript/src/musicxml/index.d.ts',
        default: './lib/module/musicxml/index.js',
      },
    });
  });

  it('resolves the public subpath modules in the type system', () => {
    type StateModule = typeof import('vexflow-native/state');
    type RendererModule = typeof import('vexflow-native/renderer');
    type MusicXmlModule = typeof import('vexflow-native/musicxml');

    const acceptStateModule = (_module: StateModule) => undefined;
    const acceptRendererModule = (_module: RendererModule) => undefined;
    const acceptMusicXmlModule = (_module: MusicXmlModule) => undefined;

    expect(acceptStateModule).toBeInstanceOf(Function);
    expect(acceptRendererModule).toBeInstanceOf(Function);
    expect(acceptMusicXmlModule).toBeInstanceOf(Function);
  });

  it('exposes the canonical notation state types on the state subpath', () => {
    const meter = {
      beats: 4,
      beatUnit: 4,
      beaming: [2, 2],
    } satisfies import('vexflow-native/state').Meter;
    const voiceItem = {
      id: 'note-1',
      type: 'note',
      pitch: {
        step: 'C',
        octave: 4,
      },
      duration: {
        length: 'q',
      },
      voiceId: 'voice-1',
      tieStart: true,
      articulations: ['accent'],
    } satisfies import('vexflow-native/state').VoiceItem;
    const measure = {
      id: 'measure-1',
      number: 1,
      meter,
      directions: ['dolce'],
      voices: [
        {
          id: 'voice-1',
          index: 0,
          items: [voiceItem],
        },
      ],
      startBarline: 'single',
      endBarline: 'final',
    } satisfies import('vexflow-native/state').Measure;
    const score = {
      id: 'score-1',
      defaultMeter: meter,
      metadata: {
        title: 'Prelude',
        composer: 'Composer',
      },
      staves: [
        {
          id: 'staff-1',
          order: 0,
          clef: 'treble',
          measures: [measure],
        },
      ],
    } satisfies import('vexflow-native/state').Score;
    const acceptMeter = (_meter: Meter) => undefined;
    const acceptVoiceItem = (_voiceItem: VoiceItem) => undefined;
    const acceptMeasure = (_measure: Measure) => undefined;
    const acceptScore = (_score: Score) => undefined;

    expect(acceptMeter).toBeInstanceOf(Function);
    expect(acceptVoiceItem).toBeInstanceOf(Function);
    expect(acceptMeasure).toBeInstanceOf(Function);
    expect(acceptScore).toBeInstanceOf(Function);
    expect(score.defaultMeter.beatUnit).toBe(4);
    expect(score.staves[0]?.measures[0]?.meter).toEqual(meter);
  });

  it('exposes renderer-owned aliases for the initial renderer type surface', () => {
    const voiceItem = {
      id: 'note-1',
      type: 'note',
      pitch: {
        step: 'C',
        octave: 4,
      },
      duration: {
        length: 'q',
      },
      voiceId: 'voice-1',
    } satisfies VoiceItem;
    const voice = {
      id: 'voice-1',
      index: 0,
      items: [voiceItem],
    } satisfies Voice;
    const measure = {
      id: 'measure-1',
      number: 1,
      voices: [voice],
    } satisfies Measure;
    const staff = {
      id: 'staff-1',
      order: 0,
      clef: 'treble',
      measures: [measure],
    } satisfies Staff;
    const score = {
      id: 'score-1',
      defaultMeter: {
        beats: 4,
        beatUnit: 4,
      },
      staves: [staff],
    } satisfies Score;
    const acceptRendererVoiceItem = (_voiceItem: RendererVoiceItem) =>
      undefined;
    const acceptRendererVoice = (_voice: RendererVoice) => undefined;
    const acceptRendererMeasure = (_measure: RendererMeasure) => undefined;
    const acceptRendererStaff = (_staff: RendererStaff) => undefined;
    const acceptRendererScore = (_score: RendererScore) => undefined;

    expect(acceptRendererVoiceItem).toBeInstanceOf(Function);
    expect(acceptRendererVoice).toBeInstanceOf(Function);
    expect(acceptRendererMeasure).toBeInstanceOf(Function);
    expect(acceptRendererStaff).toBeInstanceOf(Function);
    expect(acceptRendererScore).toBeInstanceOf(Function);
    expect(acceptRendererVoiceItem(voiceItem)).toBeUndefined();
    expect(acceptRendererVoice(voice)).toBeUndefined();
    expect(acceptRendererMeasure(measure)).toBeUndefined();
    expect(acceptRendererStaff(staff)).toBeUndefined();
    expect(acceptRendererScore(score)).toBeUndefined();
    expect(score.staves[0]?.measures[0]?.voices[0]?.items[0]).toEqual(
      voiceItem
    );
  });

  it('keeps the public helper semantics stable', () => {
    expect(publicApi.toPxFontSize(10)).toBeCloseTo(13.333333333333334);
    expect(publicApi.toPxFontSize('10pt')).toBeCloseTo(13.333333333333334);
    expect(publicApi.toPxFontSize('10px')).toBe(10);
    expect(publicApi.parseCssFontShorthand('italic 12pt Bravura')).toEqual({
      family: 'Bravura',
      sizePx: 16,
    });
  });
});
