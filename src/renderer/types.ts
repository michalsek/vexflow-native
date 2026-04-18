import type { RenderContext as VexflowRenderContext } from 'vexflow';

import type {
  Clef,
  KeySignature,
  Measure,
  Meter,
  Score,
  Staff,
  Tempo,
  Voice,
  VoiceItem,
} from '../state';

export type RendererScore = Score;
export type RendererStaff = Staff;
export type RendererMeasure = Measure;
export type RendererVoice = Voice;
export type RendererVoiceItem = VoiceItem;

export interface RendererPoint {
  x: number;
  y: number;
}

export interface RendererSize {
  width: number;
  height: number;
}

export interface RendererRect extends RendererPoint, RendererSize {}

export interface RendererInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type RendererLayoutMode = 'infiniteScore';

export interface RendererViewport extends RendererSize {}

export interface RendererSpacingOptions {
  systemGap?: number;
  staffGap?: number;
  groupGap?: number;
  minimumMeasureWidth?: number;
  measureHorizontalPadding?: number;
  staffHeight?: number;
  staffInnerVerticalPadding?: number;
}

export interface RendererRenderOptions {
  pixelRatio?: number;
  scale?: number;
  debug?: boolean;
}

export interface InfiniteScoreRendererConfig {
  layoutMode: 'infiniteScore';
  viewport: RendererViewport;
  padding?: RendererInsets;
  spacing?: RendererSpacingOptions;
  render?: RendererRenderOptions;
}

export type RendererConfig = InfiniteScoreRendererConfig;

export interface NormalizedRendererSpacingOptions {
  systemGap: number;
  staffGap: number;
  groupGap: number;
  minimumMeasureWidth: number;
  measureHorizontalPadding: number;
  staffHeight: number;
  staffInnerVerticalPadding: number;
}

export interface NormalizedRendererRenderOptions {
  pixelRatio: number;
  scale: number;
  debug: boolean;
}

export interface NormalizedRendererConfig {
  layoutMode: 'infiniteScore';
  viewport: RendererViewport;
  padding: RendererInsets;
  spacing: NormalizedRendererSpacingOptions;
  render: NormalizedRendererRenderOptions;
}

export interface MeasureRange {
  startMeasureIndex: number;
  endMeasureIndex: number;
}

export interface PagePlan {
  pageIndex: number;
  bounds: RendererRect;
  contentBounds: RendererRect;
  systemIndices: number[];
  measureIndices: number[];
}

export interface SystemPlan {
  systemIndex: number;
  pageIndex: number;
  bounds: RendererRect;
  contentBounds: RendererRect;
  staffIndices: number[];
  measureIndices: number[];
  range: MeasureRange;
}

export interface StaffPlan {
  staffId: RendererStaff['id'];
  staffIndex: number;
  pageIndex: number;
  systemIndex: number;
  systemGroupId?: RendererStaff['systemGroupId'];
  systemGroupRole?: RendererStaff['systemGroupRole'];
  bounds: RendererRect;
  contentBounds: RendererRect;
  measureIndices: number[];
}

export interface ResolvedMeasureState {
  clef: Clef;
  meter: Meter;
  keySignature?: KeySignature;
  tempo?: Tempo;
}

export interface MeasureDisplayPlan {
  showClef: boolean;
  showKeySignature: boolean;
  showTimeSignature: boolean;
  showTempo: boolean;
  showDirections: boolean;
}

export interface MeasurePlan {
  scoreId: RendererScore['id'];
  staffId: RendererStaff['id'];
  measureId: RendererMeasure['id'];
  pageIndex: number;
  systemIndex: number;
  staffIndex: number;
  measureIndex: number;
  globalMeasureIndex: number;
  bounds: RendererRect;
  contentBounds: RendererRect;
  minimumWidth: number;
  allocatedWidth: number;
  startBeat: number;
  endBeat: number;
  resolvedState: ResolvedMeasureState;
  display: MeasureDisplayPlan;
}

export interface RendererPlan {
  score: RendererScore;
  config: NormalizedRendererConfig;
  contentSize: RendererSize;
  pages: PagePlan[];
  systems: SystemPlan[];
  staves: StaffPlan[];
  measures: MeasurePlan[];
}

export interface MeasureLayout {
  scoreId: RendererScore['id'];
  staffId: RendererStaff['id'];
  measureId: RendererMeasure['id'];
  pageIndex: number;
  systemIndex: number;
  staffIndex: number;
  measureIndex: number;
  globalMeasureIndex: number;
  bounds: RendererRect;
  contentBounds: RendererRect;
  noteStartX: number;
  noteEndX: number;
  startBeat: number;
  endBeat: number;
}

export interface NoteBounds {
  voiceItemId: RendererVoiceItem['id'];
  voiceId: RendererVoice['id'];
  staffId: RendererStaff['id'];
  measureId: RendererMeasure['id'];
  pageIndex: number;
  systemIndex: number;
  staffIndex: number;
  measureIndex: number;
  globalMeasureIndex: number;
  bounds: RendererRect;
  startBeat: number;
  endBeat: number;
}

export interface MeasureRequest {
  score: RendererScore;
  config: RendererConfig;
}

export interface RenderRequest<
  TContext extends VexflowRenderContext = VexflowRenderContext
> {
  plan: RendererPlan;
  context: TContext;
  range?: MeasureRange;
}

export interface RenderResult {
  contentSize: RendererSize;
  measureLayouts: MeasureLayout[];
  noteBounds: NoteBounds[];
}

export interface RendererEngine<
  TContext extends VexflowRenderContext = VexflowRenderContext
> {
  measure(request: MeasureRequest): RendererPlan;
  render(request: RenderRequest<TContext>): RenderResult;
}
