import { parseMusicXmlToScore } from 'vexflow-native/musicxml';
import type { Score } from 'vexflow-native/state';

import { MUSIC_XML_IMPORT_FIXTURES } from '../../screens/MusicXmlImport/fixtures';
import { loadFixtureXml } from '../../screens/MusicXmlImport/loadFixtureXml';
import type { BenchFixtureId } from '../config';
import { createBenchScore } from './createBenchScore';

export type LoadedFixture = { score: Score; buildMs: number };

const BUILDERS: Record<BenchFixtureId, () => Score | Promise<Score>> = {
  long: () => createBenchScore({ id: 'bench-long', measures: 208 }),
  short: () => createBenchScore({ id: 'bench-short', measures: 12 }),
  musicxml: async () => {
    const { xml } = await loadFixtureXml(MUSIC_XML_IMPORT_FIXTURES[0]!.asset);

    return parseMusicXmlToScore(xml, { scoreId: 'bench-musicxml' });
  },
};

const cache = new Map<BenchFixtureId, Promise<LoadedFixture>>();

/** Memoised per id; a failed load is evicted so it can be retried. */
export function loadFixture(id: BenchFixtureId): Promise<LoadedFixture> {
  let pending = cache.get(id);

  if (!pending) {
    const start = performance.now();
    pending = Promise.resolve()
      .then(BUILDERS[id])
      .then((score) => ({
        score,
        buildMs: Math.round((performance.now() - start) * 10) / 10,
      }));
    pending.catch(() => cache.delete(id));
    cache.set(id, pending);
  }

  return pending;
}
