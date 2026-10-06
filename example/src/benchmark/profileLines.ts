import { round1 } from './stats';

const LABELS: Record<string, ProfileEntry['kind']> = {
  '[ScoreRenderer] recording profile': 'recording',
  '[ScoreRenderer] picture profile': 'picture',
  '[ScoreRenderer] overlay profile': 'overlay',
};
const REC_FIELDS = [
  'measureMs',
  'layoutMs',
  'renderMs',
  'finishMs',
  'totalMs',
] as const;

type RecTimes = Record<(typeof REC_FIELDS)[number], number>;

export type ProfileEntry =
  | (RecTimes & {
      kind: 'recording';
      scoreId: string;
      commandCount: number;
      measureCount: number;
      systemCount: number;
    })
  | { kind: 'picture'; commandCount: number; durationMs: number }
  | { kind: 'overlay'; maxMs: number; count: number };

export function parseProfileArgs([
  label,
  payload,
]: readonly unknown[]): ProfileEntry | null {
  const kind = typeof label === 'string' ? LABELS[label] : undefined;

  if (!kind || typeof payload !== 'object' || payload === null) {
    return null;
  }

  const p = payload as Record<string, unknown>;
  const num = (key: string) => (typeof p[key] === 'number' ? p[key] : 0);

  switch (kind) {
    case 'recording':
      return {
        kind,
        scoreId: String(p.scoreId),
        commandCount: num('commandCount'),
        measureCount: num('measureCount'),
        systemCount: num('systemCount'),
        ...(Object.fromEntries(
          REC_FIELDS.map((key) => [key, num(key)])
        ) as RecTimes),
      };
    case 'picture':
      return {
        kind,
        commandCount: num('commandCount'),
        durationMs: num('durationMs'),
      };
    case 'overlay':
      return { kind, maxMs: num('maxMs'), count: num('count') };
  }
}

/**
 * Sums the recordings of `scoreId` and the picture replays directly
 * following one of them with the same command count (picture lines carry no
 * score id); `commands`/`measures`/`systems` are the last recording's.
 */
export function collectPhaseTimes(
  entries: readonly ProfileEntry[],
  scoreId: string
) {
  const rec = {
    n: 0,
    ...(Object.fromEntries(REC_FIELDS.map((key) => [key, 0])) as RecTimes),
    commands: 0,
    measures: 0,
    systems: 0,
  };
  const pic = { n: 0, ms: 0 };
  const overlayMax: number[] = [];
  let records = 0;

  entries.forEach((entry, index) => {
    const previous = entries[index - 1];

    if (entry.kind === 'recording' && entry.scoreId === scoreId) {
      rec.n += 1;
      REC_FIELDS.forEach((key) => (rec[key] += entry[key]));
      rec.commands = entry.commandCount;
      rec.measures = entry.measureCount;
      rec.systems = entry.systemCount;
    } else if (
      entry.kind === 'picture' &&
      previous?.kind === 'recording' &&
      previous.scoreId === scoreId &&
      previous.commandCount === entry.commandCount
    ) {
      pic.n += 1;
      pic.ms += entry.durationMs;
    } else if (entry.kind === 'overlay') {
      overlayMax.push(entry.maxMs);
      records += entry.count;
    }
  });

  REC_FIELDS.forEach((key) => (rec[key] = round1(rec[key])));
  pic.ms = round1(pic.ms);

  return {
    rec,
    pic,
    ovl: overlayMax.length
      ? {
          windows: overlayMax.length,
          records,
          maxMs: Math.max(...overlayMax),
          meanMaxMs: round1(
            overlayMax.reduce((a, b) => a + b, 0) / overlayMax.length
          ),
        }
      : null,
  };
}

export type PhaseTimes = ReturnType<typeof collectPhaseTimes>;
