import { parseProfileArgs, type ProfileEntry } from './profileLines';

const PREFIX = '[VEXBENCH]';
const MAX_LINE_BYTES = 1000;
/** Dropped first, in order, while a line exceeds MAX_LINE_BYTES. */
const OPTIONAL_BLOCKS = ['js', 'heap', 'edit', 'ovl', 'pic', 't', 'ui'];

type TapState = { sink: ((entry: ProfileEntry) => void) | null };

function installTap(): TapState {
  const state: TapState = { sink: null };
  const original = console.info;

  console.info = (...args: unknown[]) => {
    const entry = state.sink ? parseProfileArgs(args) : null;

    if (entry) {
      state.sink!(entry);
    } else {
      original.apply(console, args);
    }
  };

  return state;
}

const tap = ((
  globalThis as { __VEXBENCH_TAP__?: TapState }
).__VEXBENCH_TAP__ ??= installTap());

/** While attached, renderer profile lines go to `sink` instead of the console. */
export function setProfileSink(sink: TapState['sink']): () => void {
  tap.sink = sink;

  return () => {
    if (tap.sink === sink) {
      tap.sink = null;
    }
  };
}

export type BenchLine = { type: string } & Record<string, unknown>;

/** Payloads are ASCII (labels are `[\w.-]`), so length equals bytes. */
export function emitBenchLine(line: BenchLine) {
  const payload: Record<string, unknown> = { v: 1, ...line };
  const dropped: string[] = [];
  const format = () =>
    `${PREFIX} ${JSON.stringify(
      dropped.length ? { ...payload, dropped } : payload
    )}`;
  let text = format();

  for (const key of OPTIONAL_BLOCKS) {
    if (text.length <= MAX_LINE_BYTES) {
      break;
    }
    if (payload[key] !== undefined) {
      delete payload[key];
      dropped.push(key);
      text = format();
    }
  }

  console.log(text);
}
