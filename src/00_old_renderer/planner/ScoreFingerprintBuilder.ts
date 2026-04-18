import type { Measure, Voice, VoiceItem } from '../../state';

import type { RendererScore, RendererStaff } from '../types';

import { stableSerialize } from './FingerprintUtils';
import type {
  MeasureFingerprintEntry,
  ScoreFingerprintSnapshot,
  StaffFingerprintEntry,
} from './types';

export class ScoreFingerprintBuilder {
  build(
    score: RendererScore,
    sortedStaves: RendererStaff[]
  ): ScoreFingerprintSnapshot {
    const staffEntries = sortedStaves.map((staff) =>
      this.buildStaffEntry(staff)
    );
    const analysisDefaultsFingerprint = stableSerialize({
      defaultKeySignature: score.defaultKeySignature,
      tempo: score.tempo,
    });
    const timingFingerprint = stableSerialize({
      defaultMeter: score.defaultMeter,
      staves: staffEntries.map((staffEntry) =>
        staffEntry.measureFingerprints.map((measureEntry) => ({
          measureId: measureEntry.measureId,
          meterFingerprint: measureEntry.meterFingerprint,
        }))
      ),
    });

    return {
      score,
      scoreFingerprint: stableSerialize({
        scoreId: score.id,
        analysisDefaultsFingerprint,
        timingFingerprint,
        staves: staffEntries.map((staffEntry) => ({
          staffId: staffEntry.staffId,
          layoutFingerprint: staffEntry.layoutFingerprint,
          analysisFingerprint: staffEntry.analysisFingerprint,
        })),
      }),
      analysisDefaultsFingerprint,
      timingFingerprint,
      staffEntries,
    };
  }

  private buildStaffEntry(staff: RendererStaff): StaffFingerprintEntry {
    const measureFingerprints = staff.measures.map((measure) =>
      this.buildMeasureFingerprint(measure)
    );

    return {
      staff,
      staffId: staff.id,
      layoutFingerprint: stableSerialize({
        staffId: staff.id,
        order: staff.order,
        systemGroupId: staff.systemGroupId,
        systemGroupRole: staff.systemGroupRole,
      }),
      analysisFingerprint: stableSerialize({
        staffId: staff.id,
        clef: staff.clef,
        measures: measureFingerprints.map((measureEntry) => ({
          measureId: measureEntry.measureId,
          fingerprint: measureEntry.fingerprint,
        })),
      }),
      measureFingerprints,
    };
  }

  private buildMeasureFingerprint(measure: Measure): MeasureFingerprintEntry {
    return {
      measure,
      measureId: measure.id,
      fingerprint: stableSerialize({
        measureId: measure.id,
        clef: measure.clef,
        meter: measure.meter,
        keySignature: measure.keySignature,
        tempo: measure.tempo,
        directions: measure.directions ?? [],
        voices: measure.voices.map((voice) =>
          this.buildVoiceFingerprint(voice)
        ),
      }),
      meterFingerprint: measure.meter ? stableSerialize(measure.meter) : null,
    };
  }

  private buildVoiceFingerprint(voice: Voice): unknown {
    return {
      voiceId: voice.id,
      index: voice.index,
      items: voice.items.map((item) => this.buildVoiceItemFingerprint(item)),
    };
  }

  private buildVoiceItemFingerprint(item: VoiceItem): unknown {
    if (item.type === 'note') {
      return {
        itemId: item.id,
        type: item.type,
        duration: item.duration,
        accidental: item.pitch.accidental,
        lyric: item.lyric,
      };
    }

    if (item.type === 'chord') {
      return {
        itemId: item.id,
        type: item.type,
        duration: item.duration,
        accidentals: item.pitches.map((pitch) => pitch.accidental),
      };
    }

    return {
      itemId: item.id,
      type: item.type,
      duration: item.duration,
    };
  }
}
