import type { Measure, Meter } from '../../state';

import type {
  MeasureDisplayPlan,
  NormalizedRendererConfig,
  RendererScore,
  RendererStaff,
  ResolvedMeasureState,
} from '../types';

export interface NormalizedConfigResult {
  config: NormalizedRendererConfig;
  fingerprint: string;
  layoutFingerprint: string;
  renderFingerprint: string;
  measureWidthFingerprint: string;
  horizontalLayoutFingerprint: string;
  verticalLayoutFingerprint: string;
}

export interface MeasureFingerprintEntry {
  measure: Measure;
  measureId: Measure['id'];
  fingerprint: string;
  meterFingerprint: string | null;
}

export interface StaffFingerprintEntry {
  staff: RendererStaff;
  staffId: RendererStaff['id'];
  layoutFingerprint: string;
  analysisFingerprint: string;
  measureFingerprints: MeasureFingerprintEntry[];
}

export interface ScoreFingerprintSnapshot {
  score: RendererScore;
  scoreFingerprint: string;
  analysisDefaultsFingerprint: string;
  timingFingerprint: string;
  staffEntries: StaffFingerprintEntry[];
}

export interface GlobalMeasureTimingDependency {
  explicitMeter?: Meter;
  explicitMeterFingerprint: string | null;
  showTimeSignature: boolean;
  fingerprint: string;
}

export interface GlobalMeasureTiming {
  index: number;
  meter: Meter;
  startBeat: number;
  endBeat: number;
  showTimeSignature: boolean;
  fingerprint: string;
}

export interface StaffMeasureAnalysis {
  measure: Measure;
  measureIndex: number;
  globalMeasureIndex: number;
  startBeat: number;
  endBeat: number;
  resolvedState: ResolvedMeasureState;
  display: MeasureDisplayPlan;
  minimumWidth: number;
  measureFingerprint: string;
  timingFingerprint: string;
}

export interface StaffAnalysis {
  staff: RendererStaff;
  staffIndex: number;
  analysisFingerprint: string;
  measures: StaffMeasureAnalysis[];
}
