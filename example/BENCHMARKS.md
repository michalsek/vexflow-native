# Renderer benchmarks

The example app has a scripted benchmark (menu → **Benchmark**) and a parity
gallery (menu → **Parity Gallery**), both deep-linkable so a host-side driver
can run them without touching the UI.

## Running

Start Metro (`yarn example start`) and run the example. With Xcode 27, build
it with `xcodebuild` from `example/ios` and install the `.app`, because
`expo run:ios` from Expo 54 cannot drive the Xcode 27 simulator. Use a Release
build for baseline numbers; debug builds show a `bench-dev-warning` banner.

| Link                                                        | Effect                                           |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `vexflownative://bench`                                     | Open the benchmark, idle (Run uses the defaults) |
| `vexflownative://bench?scenario=scroll&fixture=long&runs=5` | Open and autostart                               |
| `vexflownative://parity`                                    | Open the parity gallery                          |
| `vexflownative://parity/<case>?scheme=dark`                 | Open one frozen case                             |

| Bench param       | Values                                                   | Default             |
| ----------------- | -------------------------------------------------------- | ------------------- |
| `scenario`        | `initial` `scroll` `playback` `edit` `all`               | none (no autostart) |
| `fixture`         | `long` (208 measures × 2 staves) `short` (12) `musicxml` | `long`              |
| `layout`          | `document` `documentEven` `infiniteScore`                | `document`          |
| `runs` / `warmup` | 1–20 / 0–3                                               | 3 / 1               |
| `label`           | `[\w.-]{1,64}`, echoed in every log line                 | none                |

Unknown params only warn. Invalid ones show `bench-param-error`, set
`bench-status` to `error (bad-params)`, log an `error` line and don't start. A link that arrives during a run is ignored
(`bench-busy`, `rejected` line). Autostart waits for the fonts, the screen
transition (600 ms fallback) and 1 s of idle. A cold-start link opens with
the menu underneath.

## Method

Each scenario loads its fixture once, then runs `warmup` unlogged and `runs`
logged repetitions. Each repetition mounts a fresh light-scheme
`ScoreRenderer` (480 pt high, full width, scrolling disabled) after a
750 ms cooldown. While a session runs, renderer profiling is forced on and
the `[ScoreRenderer]` console lines are captured instead of printed.

| Scenario   | Measured                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `initial`  | mount → `onReady` (`readyMs`) → 2 frames (`frameMs`); `otherMs = readyMs − recording − picture`                                    |
| `scroll`   | 6 s of UI-thread scrolling at 1200 pt/s, bouncing at the ends; on `long` this covers the first 7.2k of 70.5k pt                    |
| `playback` | 6 s at 8 steps/s: the playhead moves every frame (interpolated within a system), and highlights and page turns switch at each step |
| `edit`     | 10 single-note edits (one step up, then back), 300 ms apart: `setScore` → `onItemsLayout` (`layout*`) → 2 frames (`frame*`)        |

Playback steps group every item by measure and onset tick (computed from
durations, dots and tuplet ratios) across staves. The step's x is the
leftmost note head.

Phases come from the renderer's profile lines: measure (`measureMs`), layout
(`layoutMs`), render-to-commands (`renderMs` + `finishMs`), JS replay (picture
`durationMs`) and UI overlay replay (overlay `maxMs`).

`ui` summarizes UI-thread frame-callback intervals and `js` summarizes
`requestAnimationFrame` intervals. The refresh rate is the median interval,
snapped to 60/90/120 Hz. Dropped frames are
`Σ max(0, round(interval / budget) − 1)`, counted at 60 Hz and at the detected
rate. `heap` is Hermes `js_allocatedBytes` before and after each repetition.
Native and peak memory are measured host-side.

A repetition is `invalid` and left out of the summary when:

- the viewport or the system appearance changed,
- scroll or playback triggered a recording,
- there was nothing to measure (no scroll range, no playback steps or no edit target).

Caveats:

- `onReady` fires before the first frame is presented.
- UI intervals measure UI-thread pacing, not GPU presentation (relevant for Graphite).
- The overlay profile reports in ≥1 s windows and never flushes the last one.

## Log schema (v1)

Every event is one `console.log` line, `[VEXBENCH] {json}`, at most 1000
bytes. If a line would be longer, blocks are dropped in the order `js heap edit
ovl pic t ui` and listed in `dropped`. Every line has `v: 1`, `type`, `sid`,
and `label` when one was given.

| `type`                                    | Fields                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `session`                                 | `platform os build hermes rn skia reanimated pixelRatio window`                                             |
| `window`                                  | `phase` (`start`/`end`), `scenario`, `run`: brackets a measured scroll/playback window                      |
| `run`                                     | `scenario fixture layout run runs status reason? vp hz rec pic ovl t? edit? steps? scrollRange? ui js heap` |
| `summary`                                 | `scenario fixture layout buildMs okRuns runs metrics: {name: {median, max}}`                                |
| `done` / `aborted` / `rejected` / `error` | `reason`: `stop`, `unmount`, `blur`, `background`, `busy`, `bad-params` (+ `errors`), or the error message  |

In `rec`, times are sums over the `n` recordings, while `commands`,
`measures` and `systems` are the last recording's.

The screen shows `bench-status`, `bench-env` and one `bench-summary-<scenario>-<metric>` row per metric.

## Parity gallery

Each case renders full screen with no header and scrolling disabled. Once
`onReady`, `onScrollGeometry` and `onItemsLayout` have all fired, it applies
its freeze (scroll to a measure, a playback step, or an override preset) and
waits 3 frames. Then `parity-status` reads `parity-ready:<case>:<scheme>`
(`parity-error:<case>` when the case is unknown or its fixture fails to load).

Crop the status bar before diffing.

## Baseline (skia 2.6.2)

| Device | Build | Date | Scenario | Fixture | Metric | Median | Max |
| ------ | ----- | ---- | -------- | ------- | ------ | ------ | --- |
