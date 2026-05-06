import {
  type SkFont,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { Element, RenderContext as VexflowRenderContext } from 'vexflow';
import type { FontInfo } from 'vexflow';

import FontManager from './FontManager';
import TextMeasureContext from './TextMeasureContext';
import { installVexflowReactNativeFallbacks } from './setupVexflowReactNative';
import { parseStyleToColor } from './utils';
import type {
  VexflowRecordingCommand,
  VexflowRecordingFont,
  VexflowRecordingLineCap,
  VexflowRecordingPaint,
  VexflowRecordingPathCommand,
  VexflowRecordingRect,
} from './VexflowRecordingTypes';

const showSilentLogs = false;

const WidthScale = 3 / 4;

function logUnimplemented(methodName: string, isSilent = false) {
  if (isSilent && !showSilentLogs) {
    return;
  }

  console.log(
    `VexflowRecordingContext: Method "${methodName}" is not implemented yet.`
  );
}

export default class VexflowRecordingContext implements VexflowRenderContext {
  __workletClass = true;

  private commands: VexflowRecordingCommand[] = [];
  private currentPath?: VexflowRecordingPathCommand[];
  private fillPaint: VexflowRecordingPaint = {
    color: parseStyleToColor('black'),
  };
  private strokePaint: VexflowRecordingPaint = {
    color: parseStyleToColor('black'),
    strokeCap: 'butt',
    strokeWidth: 1.5 * WidthScale,
  };
  private textFont: SkFont;
  private textFontDescriptor: VexflowRecordingFont;
  private fontManager: FontManager;
  private textMeasurementContext: TextMeasureContext;
  private isFinished = false;

  constructor(fontProvider: SkTypefaceFontProvider, defaultFont: string) {
    this.fontManager = new FontManager(fontProvider, defaultFont);
    this.textFontDescriptor = { font: defaultFont };
    this.textFont = this.fontManager.createSkFont(defaultFont);

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      installVexflowReactNativeFallbacks();
      this.textMeasurementContext = new TextMeasureContext(this);

      Element.setTextMeasurementCanvas({
        getContext: (type: string) => {
          if (type === '2d') {
            return this.textMeasurementContext;
          }

          return null;
        },
      } as unknown as HTMLCanvasElement);
    } else {
      const measurementCanvas = Element.getTextMeasurementCanvas();
      this.textMeasurementContext = measurementCanvas?.getContext(
        '2d' as unknown as 'webgpu'
      ) as unknown as TextMeasureContext;
    }
  }

  getCurrentSkFont() {
    return this.textFont;
  }

  getMeasurementContext() {
    return this.textMeasurementContext;
  }

  finish(): readonly VexflowRecordingCommand[] {
    this.isFinished = true;
    return this.commands.map((command) => cloneCommand(command));
  }

  clear() {
    this.pushCommand({
      type: 'clear',
      color: 'transparent',
    });
    return this;
  }

  setFillStyle(style: string | unknown) {
    if (typeof style === 'string') {
      this.fillPaint = {
        ...this.fillPaint,
        color: parseStyleToColor(style),
      };
      return this;
    }

    logUnimplemented('setFillStyle (gradient or pattern)');
    return this;
  }

  setBackgroundFillStyle(_style: string) {
    logUnimplemented('setBackgroundFillStyle');
    return this;
  }

  setStrokeStyle(style: string) {
    this.strokePaint = {
      ...this.strokePaint,
      color: parseStyleToColor(style),
    };
    return this;
  }

  setShadowColor(_color: string): this {
    logUnimplemented('setShadowColor');
    return this;
  }

  setShadowBlur(_blur: number) {
    logUnimplemented('setShadowBlur');
    return this;
  }

  setLineWidth(width: number) {
    this.strokePaint = {
      ...this.strokePaint,
      strokeWidth: width * WidthScale,
    };
    return this;
  }

  setLineCap(cap: string) {
    this.strokePaint = {
      ...this.strokePaint,
      strokeCap: normalizeLineCap(cap),
    };
    return this;
  }

  setLineDash(_dashPattern: number[]) {
    logUnimplemented('setLineDash');
    return this;
  }

  scale(x: number, y: number) {
    this.pushCommand({ type: 'scale', x, y });
    return this;
  }

  translate(x: number, y: number) {
    this.pushCommand({ type: 'translate', x, y });
    return this;
  }

  resize(_width: number, _height: number) {
    logUnimplemented('resize');
    return this;
  }

  rect(x: number, y: number, width: number, height: number) {
    this.currentPath?.push({
      type: 'addRect',
      rect: makeRect(x, y, width, height),
    });
    return this;
  }

  fillRect(x: number, y: number, width: number, height: number) {
    this.pushCommand({
      type: 'fillRect',
      rect: makeRect(x, y, width, height),
      paint: clonePaint(this.fillPaint),
    });
    return this;
  }

  clearRect(x: number, y: number, width: number, height: number) {
    this.pushCommand({
      type: 'clearRect',
      rect: makeRect(x, y, width, height),
    });
    return this;
  }

  clipRect(x: number, y: number, width: number, height: number) {
    this.pushCommand({
      type: 'clipRect',
      rect: makeRect(x, y, width, height),
    });
    return this;
  }

  pointerRect(_x: number, _y: number, _width: number, _height: number) {
    logUnimplemented('pointerRect', true);
    return this;
  }

  beginPath() {
    this.currentPath = [];
    return this;
  }

  moveTo(x: number, y: number) {
    this.currentPath?.push({ type: 'moveTo', x, y });
    return this;
  }

  lineTo(x: number, y: number) {
    this.currentPath?.push({ type: 'lineTo', x, y });
    return this;
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ) {
    this.currentPath?.push({
      type: 'cubicTo',
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      x,
      y,
    });
    return this;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.currentPath?.push({ type: 'quadTo', cpx, cpy, x, y });
    return this;
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    anticlockwise: boolean
  ) {
    const startDeg = (startAngle * 180) / Math.PI;
    const endDeg = (endAngle * 180) / Math.PI;
    const sweepDeg = anticlockwise ? startDeg - endDeg : endDeg - startDeg;

    this.currentPath?.push({
      type: 'addArc',
      rect: makeRect(x - radius, y - radius, radius * 2, radius * 2),
      startDegrees: startDeg,
      sweepDegrees: sweepDeg,
    });
    return this;
  }

  fill(_attributes?: unknown) {
    this.pushCommand({
      type: 'fillPath',
      path: this.cloneCurrentPath(),
      paint: clonePaint(this.fillPaint),
    });
    return this;
  }

  stroke() {
    this.pushCommand({
      type: 'strokePath',
      path: this.cloneCurrentPath(),
      paint: clonePaint(this.strokePaint),
    });
    return this;
  }

  closePath() {
    this.currentPath?.push({ type: 'close' });
    return this;
  }

  fillText(text: string, x: number, y: number) {
    this.pushCommand({
      type: 'fillText',
      text,
      x,
      y,
      paint: clonePaint(this.fillPaint),
      font: cloneFont(this.textFontDescriptor),
    });
    return this;
  }

  save(): this {
    this.pushCommand({ type: 'save' });
    return this;
  }

  restore(): this {
    this.pushCommand({ type: 'restore' });
    return this;
  }

  openGroup(_cls?: string, _id?: string) {
    logUnimplemented('openGroup', true);
    return this;
  }

  closeGroup() {
    logUnimplemented('closeGroup', true);
    return this;
  }

  openRotation(_angleDegrees: number, _x: number, _y: number) {
    logUnimplemented('openRotation');
    return this;
  }

  closeRotation() {
    logUnimplemented('closeRotation');
    return this;
  }

  add(_child: unknown) {
    logUnimplemented('add');
    return this;
  }

  measureText(_text: string) {
    logUnimplemented('measureText');
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  set fillStyle(style: string | unknown) {
    this.setFillStyle(style);
  }

  get fillStyle() {
    logUnimplemented('get fillStyle');
    return '';
  }

  set strokeStyle(value: string) {
    this.setStrokeStyle(value);
  }

  get strokeStyle() {
    logUnimplemented('get strokeStyle');
    return '';
  }

  setFont(
    font?: string | FontInfo,
    size?: string | number,
    weight?: string | number,
    style?: string
  ) {
    this.textFontDescriptor = { font, size, weight, style };
    this.textFont = this.fontManager.createSkFont(font, size, weight, style);
    return this;
  }

  getFont() {
    logUnimplemented('getFont');
    return '';
  }

  set font(value: string) {
    this.setFont(value);
  }

  get font() {
    logUnimplemented('get font');
    return '';
  }

  private cloneCurrentPath(): VexflowRecordingPathCommand[] {
    if (!this.currentPath) {
      this.currentPath = [];
    }

    return this.currentPath.map((command) => clonePathCommand(command));
  }

  private pushCommand(command: VexflowRecordingCommand) {
    if (this.isFinished) {
      throw new Error(
        'VexflowRecordingContext: Cannot record commands after finish() has been called.'
      );
    }

    this.commands.push(command);
  }
}

function makeRect(
  x: number,
  y: number,
  width: number,
  height: number
): VexflowRecordingRect {
  return { x, y, width, height };
}

function normalizeLineCap(cap: string): VexflowRecordingLineCap {
  if (cap === 'round' || cap === 'square') {
    return cap;
  }

  return 'butt';
}

function clonePaint(paint: VexflowRecordingPaint): VexflowRecordingPaint {
  return { ...paint };
}

function cloneFont(font: VexflowRecordingFont): VexflowRecordingFont {
  return {
    ...font,
    font:
      typeof font.font === 'object' && font.font ? { ...font.font } : font.font,
  };
}

function clonePathCommand(
  command: VexflowRecordingPathCommand
): VexflowRecordingPathCommand {
  if (command.type === 'addRect' || command.type === 'addArc') {
    return {
      ...command,
      rect: { ...command.rect },
    };
  }

  return { ...command };
}

function cloneCommand(
  command: VexflowRecordingCommand
): VexflowRecordingCommand {
  switch (command.type) {
    case 'fillRect':
      return {
        ...command,
        rect: { ...command.rect },
        paint: clonePaint(command.paint),
      };
    case 'fillPath':
    case 'strokePath':
      return {
        ...command,
        path: command.path.map((pathCommand) => clonePathCommand(pathCommand)),
        paint: clonePaint(command.paint),
      };
    case 'fillText':
      return {
        ...command,
        paint: clonePaint(command.paint),
        font: cloneFont(command.font),
      };
    case 'clipRect':
    case 'clearRect':
      return {
        ...command,
        rect: { ...command.rect },
      };
    default:
      return { ...command };
  }
}
