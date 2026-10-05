import { useCallback, useMemo, useRef } from 'react';
import {
  useFrameCallback,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import type {
  ScoreItemStyleOverrides,
  ScorePlayheadState,
} from 'vexflow-native/renderer';

import { deferred, type Deferred } from '../../benchmark/async';
import { PLAYBACK_HIGHLIGHT } from '../../benchmark/config';
import {
  followOffset,
  pingPongOffset,
  playheadX,
  type PlaybackStep,
} from '../../benchmark/timeline';

type FrameLoopRequest =
  | { mode: 'observe'; durationMs: number }
  | { mode: 'scroll'; durationMs: number; velocity: number; maxScroll: number }
  | {
      mode: 'playback';
      durationMs: number;
      stepsPerSec: number;
      steps: PlaybackStep[];
      vertical: boolean;
      viewportExtent: number;
      maxScroll: number;
    };

type FrameLoopResult = { intervals: number[]; steps: number };

type LoopState = {
  id: number;
  request: FrameLoopRequest | null;
  startTs: number;
  step: number;
  intervals: number[];
};

export type UiFrameLoop = {
  run: (request: FrameLoopRequest) => Promise<FrameLoopResult>;
  /** Ends the current run early; its promise resolves with what it has. */
  stop: () => void;
};

export type FrameLoopTargets = {
  scrollOffset: SharedValue<number>;
  playhead: SharedValue<ScorePlayheadState | null>;
  itemStyleOverrides: SharedValue<ScoreItemStyleOverrides>;
};

export function useUiFrameLoop({
  scrollOffset,
  playhead,
  itemStyleOverrides,
}: FrameLoopTargets): UiFrameLoop {
  const state = useSharedValue<LoopState>({
    id: 0,
    request: null,
    startTs: -1,
    step: -1,
    intervals: [],
  });
  const runs = useRef(0);
  const current = useRef<{
    id: number;
    done: Deferred<FrameLoopResult>;
  } | null>(null);

  const finish = useCallback(
    (id: number, intervals: number[], steps: number) => {
      if (current.current?.id === id) {
        current.current.done.resolve({ intervals, steps });
        current.current = null;
      }
    },
    []
  );

  const complete = useCallback(() => {
    'worklet';

    const s = state.value;

    if (s.request) {
      s.request = null;
      scheduleOnRN(finish, s.id, s.intervals, s.step + 1);
    }
  }, [finish, state]);

  const onFrame = useCallback(
    (frame: FrameInfo) => {
      'worklet';

      const s = state.value;
      const request = s.request;

      if (!request) {
        return;
      }

      if (s.startTs < 0) {
        s.startTs = frame.timestamp;
      } else if (frame.timeSincePreviousFrame !== null) {
        s.intervals.push(frame.timeSincePreviousFrame);
      }

      const elapsed = frame.timestamp - s.startTs;

      if (request.mode === 'scroll') {
        scrollOffset.value = pingPongOffset(
          elapsed,
          request.velocity,
          request.maxScroll
        );
      } else if (request.mode === 'playback') {
        const steps = request.steps;
        const position = Math.min(
          steps.length - 1,
          (elapsed * request.stepsPerSec) / 1000
        );
        const index = Math.floor(position);
        const step = steps[index]!;

        playhead.value = {
          x: playheadX(steps, position),
          y: step.y,
          height: step.height,
        };

        if (index !== s.step) {
          const overrides: ScoreItemStyleOverrides = {};

          for (const id of step.itemIds) {
            overrides[id] = PLAYBACK_HIGHLIGHT;
          }

          s.step = index;
          itemStyleOverrides.value = overrides;
          scrollOffset.value = followOffset(
            scrollOffset.value,
            request.vertical ? step.y : step.x,
            request.vertical ? step.height : 0,
            request.viewportExtent,
            request.maxScroll
          );
        }
      }

      if (elapsed >= request.durationMs) {
        complete();
      }
    },
    [complete, itemStyleOverrides, playhead, scrollOffset, state]
  );

  useFrameCallback(onFrame, true);

  const run = useCallback(
    (request: FrameLoopRequest) => {
      const id = ++runs.current;
      const done = deferred<FrameLoopResult>();

      current.current = { id, done };
      state.value = { id, request, startTs: -1, step: -1, intervals: [] };

      return done.promise;
    },
    [state]
  );

  const stop = useCallback(() => scheduleOnUI(complete), [complete]);

  return useMemo(() => ({ run, stop }), [run, stop]);
}
