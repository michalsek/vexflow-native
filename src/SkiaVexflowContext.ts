import {
  BlendMode,
  PaintStyle,
  Skia,
  type SkCanvas,
  type SkFont,
  type SkPaint,
  type SkPath,
} from '@shopify/react-native-skia';
import { RenderContext as VexflowRenderContext } from 'vexflow';
import type { FontInfo } from 'vexflow';

import {
  DEFAULT_FILL_STYLE,
  DEFAULT_FONT,
  DEFAULT_LINE_WIDTH,
  DEFAULT_STROKE_STYLE,
  LINE_CAP_MAP,
  LINE_JOIN_MAP,
} from './constants';
import { resolveScoreColor } from './colorUtils';
import { type LineCap, type LineJoin } from './types';
import {
  createFont,
  getAdvanceWidth,
  parseCssFontShorthand,
  toPxFontSize,
} from './utils';

type RenderState = {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: LineCap;
  lineJoin: LineJoin;
  font: string;
};

type SkiaVexflowContextOptions = {
  defaultFillStyle?: string;
  defaultStrokeStyle?: string;
};

const isWarnDisabled = true;

function notImplemented(methodName: string): void {
  if (!isWarnDisabled) {
    console.warn(`SkiaVexflowContext: ${methodName} is not implemented yet.`);
  }
}

export default class SkiaVexflowContext implements VexflowRenderContext {
  static get CATEGORY() {
    return 'SkiaVexflowContext';
  }

  private canvas: SkCanvas;
  private currentPath: SkPath;
  private fillPaint: SkPaint;
  private strokePaint: SkPaint;
  private textFont: SkFont;
  private bravuraFont: SkFont | null;
  private defaultFillStyle: string;
  private defaultStrokeStyle: string;
  private stateStack: RenderState[] = [];

  private state: RenderState = {
    fillStyle: DEFAULT_FILL_STYLE,
    strokeStyle: DEFAULT_STROKE_STYLE,
    lineWidth: DEFAULT_LINE_WIDTH,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: DEFAULT_FONT,
  };

  constructor(
    canvas: SkCanvas,
    bravuraFont: SkFont | null = null,
    options: SkiaVexflowContextOptions = {}
  ) {
    this.canvas = canvas;
    this.bravuraFont = bravuraFont;

    this.currentPath = Skia.Path.Make();

    this.fillPaint = Skia.Paint();
    this.fillPaint.setStyle(PaintStyle.Fill);
    this.fillPaint.setAntiAlias(true);

    this.strokePaint = Skia.Paint();
    this.strokePaint.setStyle(PaintStyle.Stroke);
    this.strokePaint.setAntiAlias(true);

    this.textFont = createFont(12, 'Bravura', this.bravuraFont);

    if (options.defaultFillStyle !== undefined) {
      this.state.fillStyle = options.defaultFillStyle;
    }

    if (options.defaultStrokeStyle !== undefined) {
      this.state.strokeStyle = options.defaultStrokeStyle;
    }

    this.defaultFillStyle = this.state.fillStyle;
    this.defaultStrokeStyle = this.state.strokeStyle;

    this.applyState();
  }

  private applyState(): void {
    this.fillPaint.setColor(Skia.Color(this.state.fillStyle));

    this.strokePaint.setColor(Skia.Color(this.state.strokeStyle));
    this.strokePaint.setStrokeWidth(this.state.lineWidth);
    this.strokePaint.setStrokeCap(LINE_CAP_MAP[this.state.lineCap]);
    this.strokePaint.setStrokeJoin(LINE_JOIN_MAP[this.state.lineJoin]);

    const parsed = parseCssFontShorthand(this.state.font);
    this.textFont = createFont(parsed.sizePx, parsed.family, this.bravuraFont);
  }

  clear() {
    this.canvas.clear(Skia.Color('transparent'));
  }

  setFillStyle(style: string) {
    this.fillStyle = style;
    return this;
  }

  setBackgroundFillStyle(style: string) {
    void style;
    notImplemented('setBackgroundFillStyle');
    return this;
  }

  setStrokeStyle(style: string) {
    this.strokeStyle = style;
    return this;
  }

  setShadowColor(color: string) {
    void color;
    notImplemented('setShadowColor');
    return this;
  }

  setShadowBlur(blur: number) {
    void blur;
    notImplemented('setShadowBlur');
    return this;
  }

  setLineWidth(width: number) {
    this.state.lineWidth = width;
    this.strokePaint.setStrokeWidth(width);
    return this;
  }

  setLineCap(capType: CanvasLineCap) {
    const cap: LineCap =
      capType === 'round' || capType === 'square' ? capType : 'butt';
    this.state.lineCap = cap;
    this.strokePaint.setStrokeCap(LINE_CAP_MAP[cap]);
    return this;
  }

  setLineDash(dashPattern: number[]) {
    void dashPattern;
    notImplemented('setLineDash');
    return this;
  }

  scale(x: number, y: number) {
    this.canvas.scale(x, y);
    return this;
  }

  rect(x: number, y: number, width: number, height: number) {
    this.currentPath.addRect(Skia.XYWHRect(x, y, width, height));
    return this;
  }

  resize(width: number, height: number) {
    void width;
    void height;
    notImplemented('resize');
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

  pointerRect(x: number, y: number, width: number, height: number) {
    void x;
    void y;
    void width;
    void height;
    notImplemented('pointerRect');
    return this;
  }

  beginPath() {
    this.currentPath = Skia.Path.Make();
    return this;
  }

  moveTo(x: number, y: number) {
    this.currentPath.moveTo(x, y);
    return this;
  }

  lineTo(x: number, y: number) {
    this.currentPath.lineTo(x, y);
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
    this.currentPath.cubicTo(cp1x, cp1y, cp2x, cp2y, x, y);
    return this;
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.currentPath.quadTo(cpx, cpy, x, y);
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
    const sweep = anticlockwise ? startDeg - endDeg : endDeg - startDeg;

    this.currentPath.addArc(
      Skia.XYWHRect(x - radius, y - radius, radius * 2, radius * 2),
      startDeg,
      sweep
    );
    return this;
  }

  fill(attributes?: any) {
    void attributes;
    this.canvas.drawPath(this.currentPath, this.fillPaint);
    return this;
  }

  stroke() {
    this.canvas.drawPath(this.currentPath, this.strokePaint);
    return this;
  }

  closePath() {
    this.currentPath.close();
    return this;
  }

  fillText(text: string, x: number, y: number) {
    this.canvas.drawText(text, x, y, this.fillPaint, this.textFont);
    return this;
  }

  save() {
    this.canvas.save();
    this.stateStack.push({ ...this.state });
    return this;
  }

  restore() {
    this.canvas.restore();
    const prevState = this.stateStack.pop();
    if (prevState) {
      this.state = prevState;
      this.applyState();
    }

    return this;
  }

  openGroup(cls?: string, id?: string) {
    void cls;
    void id;
    notImplemented('openGroup');
    return null;
  }

  closeGroup() {
    notImplemented('closeGroup');
  }

  openRotation(angleDegrees: number, x: number, y: number) {
    void angleDegrees;
    void x;
    void y;
    notImplemented('openRotation');
  }

  closeRotation() {
    notImplemented('closeRotation');
  }

  add(child: any) {
    void child;
    notImplemented('add');
  }

  measureText(text: string) {
    const rect = this.textFont.measureText(text);
    const width = getAdvanceWidth(this.textFont, text);
    const height = rect.height;

    return {
      x: rect.x,
      y: rect.y,
      width,
      height,
    };
  }

  set fillStyle(style: string | CanvasGradient | CanvasPattern) {
    if (typeof style === 'string') {
      const resolvedStyle = resolveScoreColor(style, this.defaultFillStyle);
      this.state.fillStyle = resolvedStyle;
      this.fillPaint.setColor(Skia.Color(resolvedStyle));
      return;
    }

    notImplemented('set fillStyle (gradient/pattern)');
  }

  get fillStyle() {
    return this.state.fillStyle;
  }

  set strokeStyle(style: string | CanvasGradient | CanvasPattern) {
    if (typeof style === 'string') {
      const resolvedStyle = resolveScoreColor(style, this.defaultStrokeStyle);
      this.state.strokeStyle = resolvedStyle;
      this.strokePaint.setColor(Skia.Color(resolvedStyle));
      return;
    }

    notImplemented('set strokeStyle (gradient/pattern)');
  }

  get strokeStyle() {
    return this.state.strokeStyle;
  }

  setFont(
    font?: string | FontInfo,
    size?: string | number,
    weight?: string | number,
    style?: string
  ) {
    if (typeof font === 'object' && font !== null) {
      const fontSize = toPxFontSize(font.size);
      const family = Array.isArray(font.family)
        ? font.family.join(', ')
        : font.family;
      const fontWeight = font.weight ? ` ${font.weight}` : '';
      const fontStyle = font.style ? ` ${font.style}` : '';

      this.font = `${fontStyle}${fontWeight} ${fontSize}px ${
        family ?? 'sans-serif'
      }`.trim();
      return this;
    }

    if (
      typeof font === 'string' &&
      size === undefined &&
      weight === undefined &&
      style === undefined
    ) {
      this.font = font;
      return this;
    }

    const fontSize = toPxFontSize(size);
    const fontWeight = weight ? ` ${weight}` : '';
    const fontStyle = style ? ` ${style}` : '';
    const family = font || 'sans-serif';

    this.font = `${fontStyle}${fontWeight} ${fontSize}px ${family}`.trim();
    return this;
  }

  getFont() {
    return this.state.font;
  }

  set font(font: string) {
    this.state.font = font;
    const parsed = parseCssFontShorthand(font);
    this.textFont = createFont(parsed.sizePx, parsed.family, this.bravuraFont);
  }

  get font() {
    return this.state.font;
  }
}
