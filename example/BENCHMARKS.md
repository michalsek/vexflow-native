# Renderer benchmark

The example app has a scripted benchmark of the renderer in the current
checkout (menu → **Benchmark**). Each repetition mounts a fresh
`ScoreRenderer` (480 pt high, full width, scrolling disabled) and runs one
scenario on one fixture:

- `initial`: mount → `onReady` → 2 frames.
- `scroll`: 6 s of UI-thread scrolling, bouncing at the ends.
- `playback`: 6 s of playhead movement with step highlights and page turns.
- `edit`: 10 single-note edits, 300 ms apart: `setScore` → `onItemsLayout` → 2 frames.

Fixtures are `long` (208 measures × 2 staves), `short` (12 measures) and
`musicxml` (the bundled MusicXML score). Metrics are the renderer's JS phases
(measure, layout, render → commands, picture), UI-thread frame intervals
(p50/p95, dropped frames), JS frame intervals and the Hermes JS heap.

## Running

Use a Release build: Debug timings are not representative.

```sh
cd example && npx expo run:ios --configuration Release
cd example && npx expo run:android --variant release
```

Press **Run** for the defaults, or open a deep link, which starts right away:
`vexflownative://bench?scenario=all&fixture=short&runs=3&warmup=1&label=my-branch`.

| Param             | Values                                     | Default             |
| ----------------- | ------------------------------------------ | ------------------- |
| `scenario`        | `initial` `scroll` `playback` `edit` `all` | none (no autostart) |
| `fixture`         | `long` `short` `musicxml`                  | `long`              |
| `layout`          | `document` `documentEven` `infiniteScore`  | `document`          |
| `runs` / `warmup` | 1–20 / 0–3                                 | 3 / 1               |
| `label`           | `[\w.-]{1,64}`, echoed in every log line   | none                |

## Reading results

The screen shows the status, the environment and one row per metric:
`<scenario> <metric> <median> (max <max>)` over the valid runs. Every event is
also a `[VEXBENCH] {json}` console line (`v: 1`, plus `sid` and `label`):

```sh
xcrun simctl spawn <udid> log stream --style compact \
  --predicate 'subsystem == "com.facebook.react.log" AND category == "javascript"'
adb logcat -s ReactNativeJS:V
```

- `session`: platform, OS, build type, library versions, pixel ratio, window.
- `run`: one repetition with its `status`, phase times and frame stats.
- `summary`: `okRuns` / `runs` and `metrics: {name: {median, max}}`.
- `done` / `aborted` / `rejected` / `error`: how the session ended (`reason`).

A run is `invalid` and left out of the summary when the viewport or the
appearance changed, scroll or playback re-recorded the score
(`unexpected-recordings`), or there was nothing to measure (`no-scroll-range`,
`no-steps`, `no-edit-target`).

## Presenting results

Give the user one table per platform built from the `summary` lines, each
cell `median (max)`, with a column per compared branch:

| Scenario | Fixture | Metric        | main | branch |
| -------- | ------- | ------------- | ---- | ------ |
| initial  | long    | `readyMs`     |      |        |
| scroll   | long    | `uiP95Ms`     |      |        |
| edit     | short   | `layoutMedMs` |      |        |

Add one environment line (device, OS, build type, runs/warmup) and list any
invalid runs or aborted sessions. Only compare numbers from the same device
and build type.
