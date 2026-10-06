import { AlphaType, ColorType, Skia, type SkImage } from 'react-native-skia';
import type { SkPicture, SkTypefaceFontProvider } from 'react-native-skia';
import { Platform } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
  createWorkletRuntime,
  scheduleOnRN,
  scheduleOnRuntime,
  scheduleOnUI,
  type WorkletRuntime,
} from 'react-native-worklets';
import { FontManager } from 'vexflow-native';

import { abortReason, delay, type RunToken } from '../../benchmark/async';

type Provider = SkTypefaceFontProvider;
type Result = [ok: boolean | 'info', detail: string];
type Status = 'works' | 'broken' | 'info';
export type Row = { id: string; status: Status; detail: string };
export type Slots = { shown: SharedValue<SkPicture>; empty: SkPicture };

const FONTS = [
  { font: 'Bravura' },
  { font: 'Bravura,Academico' },
  { font: 'Academico,Bravura', weight: 'bold', style: 'italic' },
  { font: 'Times New Roman,serif' },
];
const TEXTS = '\ue0a4|\ue050|\ue262\ue0a4|Lyrics|mf — Ünïcödé|'.split('|');
const CASES = FONTS.flatMap((f) =>
  [9, '16px', 30].flatMap((size) => TEXTS.map((text) => ({ ...f, size, text })))
);
const PIXEL = {
  width: 1,
  height: 1,
  colorType: ColorType.RGBA_8888,
  alphaType: AlphaType.Unpremul,
};

/** Per case: [size, ...glyphIDs, advance, bbox x, y, width, height]; [-1] = threw. */
function measureCases(provider: Provider, cases: typeof CASES) {
  'worklet';
  const fonts = new FontManager(provider, 'Bravura');

  return cases.map(({ font, size, weight, style, text }) => {
    try {
      const skFont = fonts.createSkFont(font, size, weight, style);
      const ids = skFont.getGlyphIDs(text);
      const r = skFont.measureText(text);
      const advance = skFont.getGlyphWidths(ids).reduce((s, w) => s + w, 0);

      return [skFont.getSize(), ...ids, advance, r.x, r.y, r.width, r.height];
    } catch {
      return [-1];
    }
  });
}

function probe(provider: Provider) {
  'worklet';
  const fonts = new FontManager(provider, 'Bravura');
  const font = fonts.createSkFont('Bravura', 30);
  const names = Array.from({ length: provider.countFamilies() }, (_, i) =>
    provider.getFamilyName(i)
  );
  const cached = font === fonts.createSkFont('Bravura', 30);
  const desc = `${font.__typename__} size ${font.getSize()}`;

  return `[${names}] ${desc} cached ${cached}`;
}

function crossProbe(fonts: FontManager) {
  'worklet';
  return `crossed: ${fonts.createSkFont('Bravura', 30).getSize()}`;
}

function errorOf(fn: () => unknown) {
  'worklet';
  try {
    fn();
    return 'no throw';
  } catch (e) {
    return String(e);
  }
}

function record(provider?: Provider) {
  'worklet';
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, 160, 48));

  if (provider) {
    const fonts = new FontManager(provider, 'Bravura');
    const paint = Skia.Paint();
    const lyrics = fonts.createSkFont('Times New Roman,serif', 12);

    canvas.drawRect(Skia.XYWHRect(8, 8, 24, 24), paint);
    canvas.drawText('\ue0a4', 44, 36, paint, fonts.createSkFont('Bravura', 30));
    canvas.drawText('Lyrics', 72, 36, paint, lyrics);
  }

  return recorder.finishRecordingAsPicture();
}

let blank: SkPicture | null = null;
/** One per app, never disposed: `shown` always holds a live picture. */
export const emptyPicture = () => (blank ??= record());

export function swap({ shown, empty }: Slots, provider?: Provider) {
  'worklet';
  const previous = shown.value;
  const picture = provider ? record(provider) : empty;

  shown.value = picture;
  if (previous !== empty) {
    previous.dispose();
  }

  return { picture, error: errorOf(() => previous.serialize()) };
}

let worker: WorkletRuntime | null = null;

/** Runs `fn` on the UI runtime or a dedicated worker; rejects with String(error). */
function runOn<A extends unknown[], R>(
  target: 'ui' | 'worker',
  fn: (...args: A) => R,
  ...args: A
): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    const job = () => {
      'worklet';
      try {
        scheduleOnRN(resolve, fn(...args));
      } catch (e) {
        scheduleOnRN(reject, String(e));
      }
    };

    if (target === 'ui') {
      scheduleOnUI(job);
    } else {
      worker ??= createWorkletRuntime({ name: 'vexflow-diag' });
      scheduleOnRuntime(worker, job);
    }
  });
}

function compareRows(js: number[][], other: number[][]): Result {
  const bad = js.flatMap((row, i) =>
    row[0] === -1 || `${row}` !== `${other[i]}` ? [i] : []
  );
  const deltas = bad.flatMap((i) =>
    js[i]!.map((v, k) => Math.abs(v - (other[i]?.[k] ?? NaN)))
  );
  const i = bad[0] ?? -1;
  const c = CASES[i];
  const first = c
    ? `, first ${c.font}|${c.size}|${c.text} js=[${js[i]}] other=[${other[i]}]`
    : '';
  const max = Math.max(0, ...deltas);

  return [
    !bad.length && js.length === other.length,
    `${other.length} rows, ${bad.length} mismatched, maxΔ ${max}${first}`,
  ];
}

let runs = 0;
const env = { platform: Platform.OS, os: Platform.Version, dev: __DEV__ };
const log = (line: object) =>
  console.log(`[VEXDIAG] ${JSON.stringify({ v: 1, ...line })}`);

export async function runDiagnostics(options: {
  provider: Provider;
  slots: Slots;
  token: RunToken;
  snapshot: () => Promise<SkImage>;
  onRow: (rows: Row[]) => void;
}) {
  const { provider, slots, token, snapshot, onRow } = options;
  const run = ++runs;
  const rows: Row[] = [];
  const step = async (id: string, fn: () => Promise<Result>) => {
    const t0 = performance.now();
    const settled = fn().catch((e): Result => [false, String(e)]);
    const [ok, detail] = await token.race(settled, { ms: 10000, label: id });
    const status = ok === 'info' ? 'info' : ok ? 'works' : 'broken';
    const row = { id, status, detail: detail.slice(0, 300) } as const;
    const ms = +(performance.now() - t0).toFixed(1);

    log({ type: 'check', run, ...row, ms });
    rows.push(row);
    onRow([...rows]);
  };
  const luminance = async (done: (value: number) => boolean) => {
    let value = NaN;

    for (let i = 0; i < 20 && !done(value) && !token.reason; i++) {
      await delay(100);
      const image = await snapshot();
      const s = Math.floor((20 * image.width()) / 160);
      const [r = NaN, g = 0, b = 0] = image.readPixels(s, s, PIXEL) ?? [];
      value = (r + g + b) / 3;
      image.dispose();
    }

    return value;
  };
  let status = 'done';

  try {
    await runOn('ui', swap, slots);
    const w0 = performance.now();
    const workerRows = runOn('worker', measureCases, provider, CASES).then(
      (measured) => ({ measured, ms: (performance.now() - w0).toFixed(1) })
    );
    workerRows.catch(() => {});
    const j0 = performance.now();
    const jsRows = measureCases(provider, CASES);
    const jsMs = (performance.now() - j0).toFixed(1);
    let picture: SkPicture | null = null;

    await step('C1+C2', async () => {
      const ui = await runOn('ui', probe, provider);

      return [ui === probe(provider) && ui.endsWith('cached true'), ui];
    });
    await step('C3', async () =>
      compareRows(jsRows, await runOn('ui', measureCases, provider, CASES))
    );
    await step('X1', async () => {
      const jsFonts = new FontManager(provider, 'Bravura');
      const crossed = runOn('ui', crossProbe, jsFonts);

      return ['info', await crossed.catch((e) => `does not cross: ${e}`)];
    });
    await step('C4', async () => {
      picture = (await runOn('ui', swap, slots, provider)).picture;
      const value = await luminance((v) => v < 60);
      const bytes = picture?.serialize()?.length ?? 0;

      return [
        value < 60 && bytes > 0,
        `luminance ${value}, UI→JS picture ${bytes} B`,
      ];
    });
    await step('C5', async () => {
      const ui = (await runOn('ui', swap, slots)).error;
      const js = errorOf(() => picture?.serialize());
      const value = await luminance((v) => v > 200);
      const threw = [ui, js].every((m) => m.startsWith('Error'));

      return [threw && value > 200, `UI: ${ui}; JS: ${js}; luminance ${value}`];
    });
    await step('W1', async () => {
      const { measured, ms } = await workerRows;
      const [ok, detail] = compareRows(jsRows, measured);

      return [ok, `${detail}, worker ${ms} ms, js ${jsMs} ms`];
    });
    await runOn('ui', swap, slots, provider);
  } catch (e) {
    status = `aborted (${abortReason(e) ?? e})`;
  }

  const summary = { works: 0, broken: 0, info: 0 };
  rows.forEach((row) => summary[row.status]++);
  log({ type: 'done', run, status, ...env, summary });

  return status;
}
