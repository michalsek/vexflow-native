import type { DurationValue, Rest, Voice } from '../../state';
import { MusicXmlParseError } from './types';

const NOTE_LENGTHS: Array<{
  length: DurationValue['length'];
  wholeRatio: number;
}> = [
  { length: 'long', wholeRatio: 4 },
  { length: 'breve', wholeRatio: 2 },
  { length: 'w', wholeRatio: 1 },
  { length: 'h', wholeRatio: 0.5 },
  { length: 'q', wholeRatio: 0.25 },
  { length: '8', wholeRatio: 0.125 },
  { length: '16', wholeRatio: 0.0625 },
  { length: '32', wholeRatio: 0.03125 },
  { length: '64', wholeRatio: 0.015625 },
  { length: '128', wholeRatio: 0.0078125 },
];

export function getMeasureDurationTicks(
  divisions: number,
  beats: number,
  beatUnit: number
): number {
  return divisions * beats * (4 / beatUnit);
}

export function durationToTicks(
  duration: DurationValue,
  divisions: number
): number {
  const length = NOTE_LENGTHS.find((item) => item.length === duration.length);

  if (!length) {
    throw new MusicXmlParseError(
      `Unsupported duration length "${duration.length}"`
    );
  }

  const baseTicks = divisions * 4 * length.wholeRatio;
  let multiplier = 1;

  for (let dotIndex = 0; dotIndex < (duration.dots ?? 0); dotIndex++) {
    multiplier += 1 / 2 ** (dotIndex + 1);
  }

  return baseTicks * multiplier;
}

export function inferDurationType(duration: number, divisions: number) {
  const wholeDuration = divisions * 4;
  const ratio = duration / wholeDuration;

  if (ratio === 4) {
    return 'long';
  }

  if (ratio === 2) {
    return 'breve';
  }

  if (ratio === 1) {
    return 'w';
  }

  if (ratio === 0.5) {
    return 'h';
  }

  if (ratio === 0.25) {
    return 'q';
  }

  if (ratio === 0.125) {
    return '8';
  }

  if (ratio === 0.0625) {
    return '16';
  }

  if (ratio === 0.03125) {
    return '32';
  }

  if (ratio === 0.015625) {
    return '64';
  }

  if (ratio === 0.0078125) {
    return '128';
  }

  throw new MusicXmlParseError(
    `Cannot infer note type from duration ${duration.toString()}`
  );
}

export function appendSpacerRests(
  voice: Voice,
  ticks: number,
  divisions: number
): boolean {
  if (ticks <= 0) {
    return true;
  }

  const durations = decomposeTicks(ticks, divisions);

  if (!durations) {
    return false;
  }

  for (const duration of durations) {
    const rest: Rest = {
      id: `${voice.id}-item-${(voice.items.length + 1).toString()}`,
      type: 'rest',
      duration,
      voiceId: voice.id,
      kind: 'spacer',
    };
    voice.items.push(rest);
  }

  return true;
}

function decomposeTicks(
  ticks: number,
  divisions: number
): DurationValue[] | undefined {
  const candidates = NOTE_LENGTHS.map((duration) => ({
    ...duration,
    ticks: divisions * 4 * duration.wholeRatio,
  })).filter((duration) => Number.isInteger(duration.ticks));
  const durations: DurationValue[] = [];
  let remaining = ticks;

  while (remaining > 0) {
    const candidate = candidates.find(
      (duration) => duration.ticks <= remaining
    );

    if (!candidate) {
      return undefined;
    }

    durations.push({ length: candidate.length });
    remaining -= candidate.ticks;
  }

  return durations;
}
