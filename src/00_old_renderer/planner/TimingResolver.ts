import type { Meter } from '../../state';

import type { RendererScore, RendererStaff } from '../types';
import { getMeasureQuarterBeats } from '../timing';

import { stableSerialize } from './FingerprintUtils';
import type {
  GlobalMeasureTiming,
  GlobalMeasureTimingDependency,
} from './types';

export class TimingResolver {
  private cachedDependencies: GlobalMeasureTimingDependency[] = [];

  private cachedTimings: GlobalMeasureTiming[] = [];

  private defaultMeterFingerprint?: string;

  resolve(
    score: RendererScore,
    sortedStaves: RendererStaff[]
  ): GlobalMeasureTiming[] {
    const dependencies = this.buildDependencies(sortedStaves);
    const defaultMeterFingerprint = stableSerialize(score.defaultMeter);
    const firstDirtyIndex = this.findFirstDirtyIndex(
      dependencies,
      defaultMeterFingerprint
    );

    if (firstDirtyIndex === null) {
      return this.cachedTimings;
    }

    this.recomputeTimingsFromIndex(
      firstDirtyIndex,
      dependencies,
      score.defaultMeter
    );
    this.cachedDependencies = dependencies;
    this.defaultMeterFingerprint = defaultMeterFingerprint;

    return this.cachedTimings;
  }

  public recomputeTimingsFromIndex(
    startIndex: number,
    dependencies: GlobalMeasureTimingDependency[],
    defaultMeter: Meter
  ): void {
    const nextTimings = this.cachedTimings.slice(0, startIndex);
    let activeMeter =
      startIndex > 0 ? nextTimings[startIndex - 1]!.meter : defaultMeter;
    let currentBeat = startIndex > 0 ? nextTimings[startIndex - 1]!.endBeat : 0;

    for (
      let measureIndex = startIndex;
      measureIndex < dependencies.length;
      measureIndex += 1
    ) {
      const dependency = dependencies[measureIndex];

      if (!dependency) {
        break;
      }

      if (dependency.explicitMeter) {
        activeMeter = dependency.explicitMeter;
      }

      const measureQuarterBeats = getMeasureQuarterBeats(activeMeter);

      nextTimings[measureIndex] = {
        index: measureIndex,
        meter: activeMeter,
        startBeat: currentBeat,
        endBeat: currentBeat + measureQuarterBeats,
        showTimeSignature: dependency.showTimeSignature,
        fingerprint: stableSerialize({
          meter: activeMeter,
          startBeat: currentBeat,
          endBeat: currentBeat + measureQuarterBeats,
          showTimeSignature: dependency.showTimeSignature,
        }),
      };

      currentBeat += measureQuarterBeats;
    }

    this.cachedTimings = nextTimings;
  }

  private buildDependencies(
    sortedStaves: RendererStaff[]
  ): GlobalMeasureTimingDependency[] {
    const totalMeasureCount = sortedStaves.reduce(
      (maxCount, staff) => Math.max(maxCount, staff.measures.length),
      0
    );

    return Array.from({ length: totalMeasureCount }, (_, measureIndex) => {
      const explicitMeter = sortedStaves
        .map((staff) => staff.measures[measureIndex]?.meter)
        .find((meter): meter is Meter => meter !== undefined);
      const showTimeSignature =
        measureIndex === 0 ||
        sortedStaves.some(
          (staff) => staff.measures[measureIndex]?.meter !== undefined
        );
      const explicitMeterFingerprint = explicitMeter
        ? stableSerialize(explicitMeter)
        : null;

      return {
        explicitMeter,
        explicitMeterFingerprint,
        showTimeSignature,
        fingerprint: stableSerialize({
          explicitMeterFingerprint,
          showTimeSignature,
        }),
      };
    });
  }

  private findFirstDirtyIndex(
    dependencies: GlobalMeasureTimingDependency[],
    defaultMeterFingerprint: string
  ): number | null {
    if (this.defaultMeterFingerprint !== defaultMeterFingerprint) {
      return 0;
    }

    const sharedCount = Math.min(
      dependencies.length,
      this.cachedDependencies.length
    );

    for (let index = 0; index < sharedCount; index += 1) {
      if (
        this.cachedDependencies[index]?.fingerprint !==
        dependencies[index]?.fingerprint
      ) {
        return index;
      }
    }

    if (dependencies.length !== this.cachedDependencies.length) {
      return sharedCount;
    }

    return null;
  }
}
