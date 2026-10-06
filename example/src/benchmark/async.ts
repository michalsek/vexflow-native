export const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves with performance.now() after `count` animation frames. */
export function waitFrames(count: number): Promise<number> {
  return new Promise((resolve) => {
    const step = (left: number) =>
      requestAnimationFrame(() =>
        left <= 1 ? resolve(performance.now()) : step(left - 1)
      );
    step(count);
  });
}

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const ABORTED = 'BenchAborted';

/** Abort reason of an error raised by a RunToken; null for other errors. */
export function abortReason(error: unknown): string | null {
  return error instanceof Error && error.name === ABORTED
    ? error.message
    : null;
}

export type RunToken = {
  readonly reason: string | null;
  abort: (reason: string) => void;
  /** Rejects as soon as the token is aborted or after `timeout`. */
  race: <T>(
    promise: Promise<T>,
    timeout?: { ms: number; label: string }
  ) => Promise<T>;
};

export function createRunToken(): RunToken {
  const aborted = deferred<never>();
  let reason: string | null = null;

  aborted.promise.catch(() => {});

  return {
    get reason() {
      return reason;
    },
    abort(next) {
      if (reason === null) {
        reason = next;
        aborted.reject(Object.assign(new Error(next), { name: ABORTED }));
      }
    },
    race: (promise, timeout) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<never>((_, reject) => {
        if (timeout) {
          timer = setTimeout(
            () => reject(new Error(`timeout:${timeout.label}`)),
            timeout.ms
          );
        }
      });

      return Promise.race([promise, aborted.promise, timedOut]).finally(() =>
        clearTimeout(timer)
      );
    },
  };
}

export type JsFrameSampler = { start: () => void; stop: () => number[] };

/** Records requestAnimationFrame deltas (JS-thread pacing) in ms. */
export function createJsFrameSampler(): JsFrameSampler {
  let intervals: number[] = [];
  let last = -1;
  let handle: number | null = null;
  const tick = (timestamp: number) => {
    if (last >= 0) {
      intervals.push(timestamp - last);
    }
    last = timestamp;
    handle = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (handle !== null) {
      cancelAnimationFrame(handle);
      handle = null;
    }

    return intervals;
  };

  return {
    start() {
      stop();
      intervals = [];
      last = -1;
      handle = requestAnimationFrame(tick);
    },
    stop,
  };
}
