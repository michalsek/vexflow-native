import type { ScoreItemsLayout } from 'vexflow-native/renderer';
import type { Score } from 'vexflow-native/state';

import { emitBenchLine } from '../benchLog';
import { parseBenchParams } from '../config';
import { collectPhaseTimes, parseProfileArgs } from '../profileLines';
import * as stats from '../stats';
import * as timeline from '../timeline';

describe('stats', () => {
  it.each([
    [[], 0, 0],
    [[1, 2, 3, 4], 2, 4],
    [[5, 1, 4, 2, 3, 6, 7, 8, 9, 10], 5, 10],
  ])('summarizes %j as p50 %i, p95 %i', (values, p50Ms, p95Ms) => {
    expect(stats.summarizeFrameIntervals(values, 60)).toMatchObject({
      p50Ms,
      p95Ms,
    });
  });

  it.each([
    [[16.6, 16.7, 16.8], 60],
    [[11.1, 11.2], 90],
    [[8.3, 8.4, 16.6], 120],
  ])('detects %j as %i Hz', (intervals, hz) => {
    expect(stats.detectRefreshHz(intervals)).toBe(hz);
  });

  it('counts dropped frames against 60 Hz and the device rate', () => {
    expect(stats.summarizeFrameIntervals([8.3, 16.7, 25], 120)).toMatchObject({
      frames: 3,
      dropped60: 1,
      droppedHz: 3,
    });
  });

  it('summarizes only ok runs', () => {
    const run = (status: string, readyMs: number) =>
      ({ status, t: { readyMs }, rec: {}, pic: {} } as stats.BenchRunResult);

    expect(
      stats.summarizeRuns('initial', [
        run('ok', 10),
        run('ok', 30),
        run('invalid', 99),
      ])
    ).toEqual({ readyMs: { median: 10, max: 30 } });
  });
});

describe('parseBenchParams', () => {
  it('accepts a full link and autostarts', () => {
    const params = {
      scenario: 'scroll',
      fixture: 'short',
      layout: 'infiniteScore',
      label: 'p2.ios-1',
    };

    expect(parseBenchParams({ ...params, runs: '5', warmup: '0' })).toEqual({
      ok: true,
      autostart: true,
      warnings: [],
      config: { ...params, runs: 5, warmup: 0 },
    });
  });

  it('defaults without autostart and only warns on unknown or inherited keys', () => {
    expect(parseBenchParams({ foo: '1', toString: '1' })).toMatchObject({
      ok: true,
      autostart: false,
      warnings: ['unknown param "foo"', 'unknown param "toString"'],
      config: { scenario: 'initial', fixture: 'long', runs: 3, warmup: 1 },
    });
  });

  it.each([
    ['scenario', 'foo'],
    ['runs', '0'],
    ['runs', '21'],
    ['runs', '1.5'],
    ['label', 'has space'],
  ])('rejects %s=%s', (key, value) => {
    expect(parseBenchParams({ [key]: value })).toMatchObject({ ok: false });
  });
});

describe('profile lines', () => {
  const line = (label: string, payload: object) =>
    parseProfileArgs([`[ScoreRenderer] ${label} profile`, payload])!;
  const recording = (scoreId: string, commandCount: number) =>
    line('recording', {
      scoreId,
      commandCount,
      measureCount: 12,
      systemCount: 4,
      measureMs: 1,
      layoutMs: 2,
      renderMs: 3,
      finishMs: 4,
      totalMs: 10,
    });
  const picture = (commandCount: number) =>
    line('picture', { commandCount, durationMs: 5 });
  const overlay = (maxMs: number) => line('overlay', { maxMs, count: 8 });

  it('ignores unrelated console calls', () => {
    expect(parseProfileArgs(['hello', {}])).toBeNull();
    expect(parseProfileArgs(['[ScoreRenderer] picture profile'])).toBeNull();
  });

  it('pairs pictures with their recording and filters by score id', () => {
    const entries = [
      recording('a', 100),
      picture(100),
      recording('b', 50),
      picture(50),
      picture(100),
      overlay(2),
      overlay(4),
      recording('a', 100),
      picture(100),
    ];

    expect(collectPhaseTimes(entries, 'a')).toEqual({
      rec: {
        n: 2,
        measureMs: 2,
        layoutMs: 4,
        renderMs: 6,
        finishMs: 8,
        totalMs: 20,
        commands: 100,
        measures: 12,
        systems: 4,
      },
      pic: { n: 2, ms: 10 },
      ovl: { windows: 2, records: 16, maxMs: 4, meanMaxMs: 3 },
    });
    expect(collectPhaseTimes([], 'a').ovl).toBeNull();
  });
});

describe('timeline', () => {
  const note = (id: string, length: string, dots?: number) => ({
    id,
    duration: { length, dots },
  });
  const staff = (...items: object[]) => ({
    measures: [{ voices: [{ items }] }],
  });
  const score = {
    staves: [
      staff(note('m1', 'q', 1), note('m2', '8'), note('m3', 'h')),
      staff(
        note('t1', '8'),
        note('t2', '8'),
        note('t3', '8'),
        note('s4', 'q', 1),
        note('s5', '8')
      ),
    ],
    tuplets: [{ itemIds: ['t1', 't2', 't3'], ratio: { num: 3, den: 2 } }],
  } as unknown as Score;
  const layout = {
    items: Object.fromEntries(
      ['m1', 'm2', 'm3', 't1', 't2', 't3', 's4', 's5'].map((id, i) => [
        id,
        { headCenterX: 100 - i },
      ])
    ),
    measures: [{ measureIndex: 0, y: 10, height: 200 }],
  } as unknown as ScoreItemsLayout;

  it('groups items by onset across staves, x = leftmost head', () => {
    expect(
      timeline
        .buildPlaybackTimeline(score, layout)
        .map(({ itemIds, onset, x }) => [itemIds, onset, x])
    ).toEqual(
      [
        [['m1', 't1'], 0, 97],
        [['t2'], 1 / 12, 96],
        [['t3'], 1 / 6, 95],
        [['s4'], 0.25, 94],
        [['m2'], 0.375, 99],
        [['m3'], 0.5, 98],
        [['s5'], 0.625, 93],
      ].map(([ids, onset, x]) => [
        ids,
        Math.round((onset as number) * 1e6) / 1e6,
        x,
      ])
    );
  });

  it.each([
    [0.5, 15],
    [1.5, 20],
  ])('interpolates the playhead within a system at %f steps', (position, x) => {
    const steps = [
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 5, y: 100 },
    ] as timeline.PlaybackStep[];

    expect(timeline.playheadX(steps, position)).toBe(x);
  });

  it.each([
    [250, 300],
    [500, 200],
    [1000, 400],
  ])('ping-pongs at %i ms to %i', (elapsedMs, offset) => {
    expect(timeline.pingPongOffset(elapsedMs, 1200, 400)).toBeCloseTo(offset);
  });

  it.each([
    [0, 100, 0],
    [0, 470, 454],
    [300, 100, 84],
    [0, 990, 500],
  ])('follows from %i to a step at %i → %i', (offset, start, expected) => {
    expect(timeline.followOffset(offset, start, 20, 480, 500)).toBe(expected);
  });
});

describe('emitBenchLine', () => {
  it('drops optional blocks until the line fits in 1000 bytes', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const ui = stats.summarizeFrameIntervals([16.7], 60);

    emitBenchLine({ type: 'run', ui, js: { pad: 'x'.repeat(1000) } });
    const text = log.mock.calls[0]![0] as string;
    log.mockRestore();

    expect(text.length).toBeLessThanOrEqual(1000);
    expect(JSON.parse(text.slice('[VEXBENCH]'.length))).toEqual({
      v: 1,
      type: 'run',
      ui,
      dropped: ['js'],
    });
  });
});
