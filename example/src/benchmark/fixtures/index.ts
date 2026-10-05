import { parseMusicXmlToScore } from 'vexflow-native/musicxml';
import type { Score } from 'vexflow-native/state';

import { createDrumKitScore } from '../../screens/DrumKitExample';
import { MUSIC_XML_IMPORT_FIXTURES } from '../../screens/MusicXmlImport/fixtures';
import { loadFixtureXml } from '../../screens/MusicXmlImport/loadFixtureXml';
import { createSimpleRendererScore } from '../../screens/SimpleRendererFixture';
import type { BenchFixtureId } from '../config';
import { createBenchScore } from './createBenchScore';

export type FixtureId =
  | BenchFixtureId
  | 'percussion-one-line'
  | 'drum-kit'
  | 'lyrics-dynamics'
  | 'showcase';

export type LoadedFixture = { score: Score; buildMs: number };

const BUILDERS: Record<FixtureId, () => Score | Promise<Score>> = {
  'long': () =>
    createBenchScore({
      id: 'bench-long',
      measures: 208,
      parts: ['melody', 'snare'],
    }),
  'short': () =>
    createBenchScore({
      id: 'bench-short',
      measures: 12,
      parts: ['melody', 'snare'],
    }),
  'musicxml': async () => {
    const { xml } = await loadFixtureXml(MUSIC_XML_IMPORT_FIXTURES[0]!.asset);

    return parseMusicXmlToScore(xml, { scoreId: 'bench-musicxml' });
  },
  'percussion-one-line': () =>
    createBenchScore({
      id: 'bench-one-line',
      measures: 8,
      parts: ['snare'],
      snareLines: 1,
    }),
  'drum-kit': createDrumKitScore,
  'lyrics-dynamics': () =>
    createBenchScore({ id: 'bench-lyrics', measures: 8, parts: ['melody'] }),
  'showcase': createSimpleRendererScore,
};

const cache = new Map<FixtureId, Promise<LoadedFixture>>();

/** Memoised per id; a failed load is evicted so it can be retried. */
export function loadFixture(id: FixtureId): Promise<LoadedFixture> {
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
