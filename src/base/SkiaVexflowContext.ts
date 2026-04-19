import {
  BlendMode,
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkFont,
  type SkPaint,
  type SkPath,
  type SkPathBuilder,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { RenderContext as VexflowRenderContext } from 'vexflow';
import type { FontInfo } from 'vexflow';
import { Element } from 'vexflow';
import { Platform } from 'react-native';

import { parseStyleToColor, mapLineCap } from './utils';
import TextMeasureContext from './TextMeasureContext';
import FontManager from './FontManager';
import { installVexflowReactNativeFallbacks } from './setupVexflowReactNative';

const showSilentLogs = false;

const WidthScale = 3 / 4;

function logUnimplemented(methodName: string, isSilent = false) {
  if (isSilent && !showSilentLogs) {
    return;
  }

  console.log(
    `SkiaVexflowContext: Method "${methodName}" is not implemented yet.`
  );
}

export default class SkiaVexflowContext implements VexflowRenderContext {
  __workletClass = true;

  private canvas: SkCanvas;

  private currentPath?: SkPathBuilder;

  private fillPaint: SkPaint;
  // private defaultFillStyle: string;

  private strokePaint: SkPaint;
  // private defaultStrokeStyle: string;

  private textFont: SkFont;
  private fontManager: FontManager;
  private textMeasurementContext: TextMeasureContext;

  constructor(
    canvas: SkCanvas,
    fontProvider: SkTypefaceFontProvider,
    defaultFont: string
  ) {
    this.canvas = canvas;
    this.fontManager = new FontManager(fontProvider, defaultFont);

    this.textFont = this.fontManager.createSkFont(defaultFont);

    this.fillPaint = Skia.Paint();
    this.fillPaint.setStyle(PaintStyle.Fill);
    this.fillPaint.setAntiAlias(true);
    this.fillPaint.setColor(Skia.Color('black'));

    this.strokePaint = Skia.Paint();
    this.strokePaint.setStyle(PaintStyle.Stroke);
    this.strokePaint.setAntiAlias(true);
    this.strokePaint.setColor(Skia.Color('black'));
    this.strokePaint.setStrokeWidth(1.5 * WidthScale);

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

  /* local (private) or custom skia-vexflow implementations */
  getCurrentSkFont() {
    return this.textFont;
  }

  getMeasurementContext() {
    return this.textMeasurementContext;
  }

  private buildCurrentPath(): SkPath {
    if (!this.currentPath) {
      this.currentPath = Skia.PathBuilder.Make();
    }

    return this.currentPath.build();
  }

  clear() {
    this.canvas.clear(Skia.Color('transparent'));
  }

  setFillStyle(style: string | unknown) {
    if (typeof style === 'string') {
      this.fillPaint.setColor(Skia.Color(parseStyleToColor(style)));
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
    this.strokePaint.setColor(Skia.Color(parseStyleToColor(style)));
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
    this.strokePaint.setStrokeWidth(width * WidthScale);
    return this;
  }

  setLineCap(cap: string) {
    this.strokePaint.setStrokeCap(mapLineCap(cap));
    return this;
  }

  setLineDash(_dashPattern: number[]) {
    logUnimplemented('setLineDash');
    return this;
  }

  scale(x: number, y: number) {
    this.canvas.scale(x, y);
    return this;
  }

  resize(_width: number, _height: number) {
    logUnimplemented('resize');
    return this;
  }

  rect(x: number, y: number, width: number, height: number) {
    this.currentPath?.addRect(Skia.XYWHRect(x, y, width, height));
    return this;
  }

  fillRect(x: number, y: number, width: number, height: number) {
    this.canvas.drawRect(Skia.XYWHRect(x, y, width, height), this.fillPaint);
    return this;
  }

  clearRect(x: number, y: number, width: number, height: number) {
    const clearPaint = Skia.Paint();
    clearPaint.setBlendMode(BlendMode.Clear);
    this.canvas.drawRect(Skia.XYWHRect(x, y, width, height), clearPaint);
    return this;
  }

  pointerRect(_x: number, _y: number, _width: number, _height: number) {
    logUnimplemented('pointerRect', true);
    return this;
  }

  beginPath() {
    this.currentPath = Skia.PathBuilder.Make();
    return this;
  }

  moveTo(x: number, y: number) {
    this.currentPath?.moveTo(x, y);
    return this;
  }

  lineTo(x: number, y: number) {
    this.currentPath?.lineTo(x, y);
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
    this.currentPath?.cubicTo(cp1x, cp1y, cp2x, cp2y, x, y);
    return this;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.currentPath?.quadTo(cpx, cpy, x, y);
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
    this.currentPath?.addArc(
      Skia.XYWHRect(x - radius, y - radius, radius * 2, radius * 2),
      startDeg,
      sweepDeg
    );
    return this;
  }

  fill(_attributes?: any) {
    this.canvas.drawPath(this.buildCurrentPath(), this.fillPaint);
    return this;
  }

  stroke() {
    this.canvas.drawPath(this.buildCurrentPath(), this.strokePaint);
    return this;
  }

  closePath() {
    this.currentPath?.close();
    return this;
  }

  fillText(text: string, x: number, y: number) {
    this.canvas.drawText(text, x, y, this.fillPaint, this.textFont);
    return this;
  }

  save(): this {
    this.canvas.save();
    return this;
  }

  restore(): this {
    this.canvas.restore();
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

  add(_child: any) {
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
    const skFont = this.fontManager.createSkFont(font, size, weight, style);
    this.textFont = skFont;
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
}
