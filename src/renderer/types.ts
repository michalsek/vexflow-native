import type { SkTypefaceFontProvider } from '@shopify/react-native-skia';

import type {
  Barline,
  Clef,
  KeySignature,
  Measure,
  Meter,
  Note,
  Rest,
  Chord,
  Score,
  Staff,
  Tempo,
  Voice,
  VoiceItem,
} from '../state';

export type RendererType = 'infiniteScore' | 'document' | 'documentEven';

export interface ScoreRendererProps {
  score: Score;
  defaultFont: string;
  fontManager: SkTypefaceFontProvider;
  rendererType?: RendererType;
  options?: Partial<ScoreOptions>;
  scrollOffset?: RendererPoint;
  onContentSizeChange?: (size: RendererSize) => void;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ScoreInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ScoreSpacing {
  systemGap: number;
  staffGap: number;
  groupGap: number;
  minimumMeasureWidth: number;
  measureHorizontalPadding: number;
  staffHeight: number;
  staffInnerVerticalPadding: number;
}

export interface RenderOptions {
  pixelRatio: number;
  scale: number;
  debug: boolean;
}

export interface ScoreOptions {
  spacing: ScoreSpacing;
  insets: ScoreInsets;
  render: RenderOptions;
}

export interface RendererPoint {
  x: number;
  y: number;
}

export interface RendererSize {
  width: number;
  height: number;
}

export interface RendererRect extends RendererPoint, RendererSize {}

export interface VisibleViewport extends RendererRect {}

export interface ResolvedMeasureState {
  clef: Clef;
  meter: Meter;
  keySignature?: KeySignature;
  tempo?: Tempo;
}

export interface MeasureDisplayState {
  showClef: boolean;
  showKeySignature: boolean;
  showTimeSignature: boolean;
  showTempo: boolean;
  showDirections: boolean;
}

export interface GlobalMeasureTiming {
  measureIndex: number;
  startBeat: number;
  endBeat: number;
  meter: Meter;
  showTimeSignature: boolean;
}

export interface ItemTimingPlan {
  voiceItemId: VoiceItem['id'];
  voiceId: Voice['id'];
  type: VoiceItem['type'];
  startBeat: number;
  endBeat: number;
}

export interface VoiceMeasurementPlan {
  voiceId: Voice['id'];
  itemTimings: ItemTimingPlan[];
  noteAreaWidth: number;
}

export interface MeasureModifierReservations {
  clef: number;
  keySignature: number;
  timeSignature: number;
  tempo: number;
  directions: number;
  barlines: number;
}

export interface MeasureMeasurementPlan {
  scoreId: Score['id'];
  staffId: Staff['id'];
  measureId: Measure['id'];
  staffIndex: number;
  measureIndex: number;
  globalMeasureIndex: number;
  startBeat: number;
  endBeat: number;
  resolvedState: ResolvedMeasureState;
  display: MeasureDisplayState;
  voicePlans: VoiceMeasurementPlan[];
  modifierReservations: MeasureModifierReservations;
  noteAreaWidth: number;
  minimumWidth: number;
  allocatedWidth: number;
  bounds: RendererRect;
  contentBounds: RendererRect;
}

export interface StaffMeasurementPlan {
  staffId: Staff['id'];
  staffIndex: number;
  systemGroupId?: Staff['systemGroupId'];
  systemGroupRole?: Staff['systemGroupRole'];
  bounds: RendererRect;
  contentBounds: RendererRect;
  measureIndices: number[];
}

export interface SystemGroupPlan {
  systemGroupId: NonNullable<Staff['systemGroupId']>;
  topStaffId: Staff['id'];
  bottomStaffId: Staff['id'];
  measureIndices: number[];
}

export interface ScoreMeasurementPlan {
  score: Score;
  viewport: Viewport;
  options: ScoreOptions;
  globalMeasureWidths: number[];
  timings: GlobalMeasureTiming[];
  staves: StaffMeasurementPlan[];
  measures: MeasureMeasurementPlan[];
  systemGroups: SystemGroupPlan[];
  contentSize: RendererSize;
}

export interface MeasureLayout {
  scoreId: Score['id'];
  staffId: Staff['id'];
  measureId: Measure['id'];
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
  voiceItemId: VoiceItem['id'];
  voiceId: Voice['id'];
  staffId: Staff['id'];
  measureId: Measure['id'];
  staffIndex: number;
  measureIndex: number;
  globalMeasureIndex: number;
  bounds: RendererRect;
  startBeat: number;
  endBeat: number;
}

export interface RenderResult {
  contentSize: RendererSize;
  measureLayouts: MeasureLayout[];
  noteBounds: NoteBounds[];
}

export interface RenderPassOptions {
  visibleViewport?: VisibleViewport;
}

export type MeasureChild =
  | Score
  | Staff
  | Measure
  | Voice
  | Note
  | Rest
  | Chord;

export interface MeasureModifiers {
  clef?: Clef;
  keySignature?: KeySignature;
  meter?: Meter;
  tempo?: Tempo;
  directions?: string[];
  startBarline?: Barline;
  endBarline?: Barline;
}
