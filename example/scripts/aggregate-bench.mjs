#!/usr/bin/env node
// Aggregates [VEXBENCH] device logs of host-driven benchmark launches.
// aggregate-bench.mjs --platform <name> [--launches f] [--mem f] [--out-json f]
//   [--out-md f] <device.log>…  (markdown goes to stdout without --out-md)
// --launches ndjson: {"label","status":"ok"|"timeout"|"crash"|"error","noisy"?}
// --mem ndjson: {"label","peakMB"}. Labels end in `-k<round>`; round 0 is warm-up.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';

const LINE = /\[VEXBENCH\]\s*(\{.*\})\s*$/;
const SCENARIOS = ['initial', 'scroll', 'playback', 'edit'];
const FIXTURES = ['long', 'short', 'musicxml'];
const LAYOUTS = ['document', 'documentEven', 'infiniteScore'];
const COLUMNS = (
  'measure=d.measureMs,layout=d.layoutMs,render→cmds=d.renderCmdMs,' +
  'picture=d.pictureMs,ready=d.readyMs,frame=d.frameMs,UI p50=ui.p50Ms,' +
  'UI p95=ui.p95Ms,dropped=ui.droppedHz,overlay max=ovl.meanMaxMs,' +
  'JS p95=js.p95Ms,peak MB=mem.peakMB'
).split(',');
const APPENDIX = (
  'rec.n rec.totalMs rec.commands t.otherMs edit.recP95Ms edit.layoutP95Ms ' +
  'edit.frameP95Ms ui.frames ui.p99Ms ui.maxMs ui.dropped60 js.p50Ms js.maxMs ' +
  'js.dropped60 heap.afterMB steps scrollRange'
).split(' ');

const STR = { type: 'string' };
const { values: args, positionals: logs } = parseArgs({
  options: Object.fromEntries(
    'platform launches mem out-json out-md'.split(' ').map((k) => [k, STR])
  ),
  allowPositionals: true,
});

if (!args.platform || logs.length === 0) {
  throw new Error('usage: --platform <name> [options] <device.log>…');
}

const readLines = (file) =>
  readFileSync(file, 'utf8').split('\n').filter(Boolean);
const byLabel = (file) =>
  new Map(
    (file ? readLines(file) : [])
      .map((l) => JSON.parse(l))
      .map((e) => [e.label, e])
  );
const round1 = (value) => Math.round(value * 10) / 10;
const isWarmup = (label) => /-k0$/.test(label);

let malformed = 0;
const runs = new Map();

for (const file of logs) {
  for (const raw of readLines(file).filter((l) => l.includes('[VEXBENCH]'))) {
    // `log stream --style compact` writes a backslash as \134.
    const match = LINE.exec(raw.replace(/\\134/g, '\\'));
    let line;

    try {
      line = JSON.parse(match?.[1] ?? '');
    } catch {
      malformed += 1;
      continue;
    }
    if (line.type === 'run' && line.label) {
      runs.set(`${line.label}#${line.run}`, line);
    }
  }
}

const launches = byLabel(args.launches);
const memory = byLabel(args.mem);
const used = [...runs.values()].filter(
  (run) =>
    !isWarmup(run.label) &&
    run.status === 'ok' &&
    (!args.launches || launches.get(run.label)?.status === 'ok')
);

function flatten(value, prefix = '', out = {}) {
  for (const [key, leaf] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof leaf === 'number' && !['v', 'run', 'runs'].includes(key)) {
      out[path] = leaf;
    } else if (leaf && typeof leaf === 'object' && !Array.isArray(leaf)) {
      flatten(leaf, path, out);
    }
  }

  return out;
}

/** Per-recording means, so `edit` (10 recordings per run) reads like `initial`. */
function derive(run) {
  const perRec = (ms) => (run.rec?.n > 0 ? ms / run.rec.n : undefined);

  return {
    ...flatten(run),
    'd.measureMs': perRec(run.rec?.measureMs),
    'd.layoutMs': perRec(run.rec?.layoutMs),
    'd.renderCmdMs': perRec(run.rec?.renderMs + run.rec?.finishMs),
    'd.pictureMs': run.pic?.n > 0 ? run.pic.ms / run.pic.n : undefined,
    'd.readyMs': run.t?.readyMs ?? run.edit?.layoutMedMs,
    'd.frameMs': run.t?.frameMs ?? run.edit?.frameMedMs,
    'mem.peakMB': memory.get(run.label)?.peakMB,
  };
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const at = (p) => round1(sorted[Math.max(1, Math.ceil(p * n)) - 1]);

  return { n, median: at(0.5), p95: at(0.95), min: at(0), max: at(1) };
}

const groups = [];
const combos = SCENARIOS.flatMap((s) =>
  FIXTURES.flatMap((f) => LAYOUTS.map((l) => `${s}/${f}/${l}`))
);

for (const combo of combos) {
  const members = used.filter(
    (r) => `${r.scenario}/${r.fixture}/${r.layout}` === combo
  );
  const [scenario, fixture, layout] = combo.split('/');
  const n = members.length;

  if (n === 0) {
    continue;
  }

  const rows = members.map(derive);
  const metrics = Object.fromEntries(
    [...new Set(rows.flatMap(Object.keys))]
      .sort()
      .map((key) => [key, rows.map((r) => r[key]).filter(Number.isFinite)])
      .filter(([, values]) => values.length > 0)
      .map(([key, values]) => [key, stats(values)])
  );
  const noisy = members.filter((r) => launches.get(r.label)?.noisy).length;
  groups.push({ scenario, fixture, layout, n, noisy, metrics });
}

const summary = {
  meta: {
    platform: args.platform,
    generatedFrom: logs.map((file) => basename(file)).sort(),
    malformed,
    launchesTotal: [...launches.keys()].filter((l) => !isWarmup(l)).length,
    launchesUsed: new Set(used.map((run) => run.label)).size,
  },
  groups,
};

const cell = (m) => (m ? `${m.median} / ${m.p95}` : '—');
const row = (cells) => `| ${cells.join(' | ')} |`;
const table = (headers, cellsOf) => [
  row(['Scenario', 'Fixture', ...headers]),
  row(Array(headers.length + 2).fill('---')),
  ...groups.map((g) =>
    row([
      g.scenario,
      g.layout === 'document' ? g.fixture : `${g.fixture} (${g.layout})`,
      ...cellsOf(g),
    ])
  ),
];
const md = [
  ...table(['n', 'noisy', ...COLUMNS.map((c) => c.split('=')[0])], (g) => [
    g.n,
    g.noisy,
    ...COLUMNS.map((c) => cell(g.metrics[c.split('=')[1]])),
  ]),
  '',
  `<details><summary>${args.platform}: appendix (median / p95)</summary>`,
  '',
  ...table(APPENDIX, (g) => APPENDIX.map((key) => cell(g.metrics[key]))),
  '',
  '</details>',
  '',
].join('\n');

if (args['out-json']) {
  const json = JSON.stringify(summary, null, 2).replace(
    /\{\n\s+("n": [^{}]+?)\n\s+\}/g,
    (_, body) => `{ ${body.replace(/\n\s+/g, ' ')} }`
  );
  writeFileSync(args['out-json'], `${json}\n`);
}
if (args['out-md']) {
  writeFileSync(args['out-md'], md);
} else {
  process.stdout.write(md);
}
process.stderr.write(
  `${args.platform}: ${used.length} runs in ${groups.length} groups, ${malformed} malformed\n`
);
