import type { MeasureRequest, RendererPlan, RendererStaff } from '../types';

import { stableSerialize } from './FingerprintUtils';
import { ConfigNormalizer } from './ConfigNormalizer';
import { InfiniteScoreLayoutPlanner } from './InfiniteScoreLayoutPlanner';
import { ScoreFingerprintBuilder } from './ScoreFingerprintBuilder';
import { StaffAnalysisPlanner } from './StaffAnalysisPlanner';
import { TimingResolver } from './TimingResolver';

export class RendererPlanner {
  private readonly configNormalizer = new ConfigNormalizer();

  private readonly scoreFingerprintBuilder = new ScoreFingerprintBuilder();

  private readonly timingResolver = new TimingResolver();

  private readonly staffAnalysisPlanner = new StaffAnalysisPlanner();

  private readonly infiniteScoreLayoutPlanner =
    new InfiniteScoreLayoutPlanner();

  private sortedStaffIds: RendererStaff['id'][] = [];

  private sortFingerprint?: string;

  measure(request: MeasureRequest): RendererPlan {
    const normalizedConfig = this.configNormalizer.normalize(request.config);
    const sortedStaves = this.resolveSortedStaves(request.score.staves);
    const scoreSnapshot = this.scoreFingerprintBuilder.build(
      request.score,
      sortedStaves
    );
    const timings = this.timingResolver.resolve(request.score, sortedStaves);
    const staffAnalyses = this.staffAnalysisPlanner.plan({
      score: request.score,
      staffEntries: scoreSnapshot.staffEntries,
      timings,
      config: normalizedConfig,
      analysisDefaultsFingerprint: scoreSnapshot.analysisDefaultsFingerprint,
    });

    return this.infiniteScoreLayoutPlanner.buildPlan({
      score: request.score,
      config: normalizedConfig,
      staffAnalyses,
      sortedStaves,
      timings,
    });
  }

  private resolveSortedStaves(staves: RendererStaff[]): RendererStaff[] {
    const nextSortFingerprint = stableSerialize(
      staves.map((staff) => ({
        id: staff.id,
        order: staff.order,
      }))
    );
    const staffById = new Map(staves.map((staff) => [staff.id, staff]));

    if (
      this.sortFingerprint === nextSortFingerprint &&
      this.sortedStaffIds.length === staves.length
    ) {
      return this.sortedStaffIds
        .map((staffId) => staffById.get(staffId))
        .filter((staff): staff is RendererStaff => staff !== undefined);
    }

    const sortedStaves = [...staves].sort(
      (left, right) => left.order - right.order
    );

    this.sortFingerprint = nextSortFingerprint;
    this.sortedStaffIds = sortedStaves.map((staff) => staff.id);

    return sortedStaves;
  }
}
