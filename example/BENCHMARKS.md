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
| `vexflownative://diagnostics/worklets`                      | Run the worklet runtime diagnostics              |

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

| Date       | Commit              | Build                                                                             | Versions                                                                                                    | Host                                                                    | Tooling                                                                                                                                    |
| ---------- | ------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-06 | `f96b493` (harness) | Release, Hermes bytecode, new arch; iOS sim arm64 / Android arm64-v8a (debug key) | skia 2.6.2, RN 0.81.5, reanimated 4.2.2, worklets 0.7.4, expo 54.0.33, react 19.1.0, gesture-handler 2.30.0 | Apple M4 Pro (10P+4E), 24 GB, macOS 27.2, AC power, no thermal warnings | Xcode 27.0, JDK 17, Gradle 8.14.3, node 25.9, argent 0.26.0, Android emulator 36.5.10 (`-force-snapshot-load -no-snapshot-save -gpu auto`) |

| Platform | Device                                                                                   | Frame interval           |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------ |
| iOS      | iPhone 17 simulator, iOS 27.0, 402×874 pt @3x, light appearance, Reduce Motion off       | 16.7 ms (60 Hz detected) |
| Android  | `Medium_Phone` AVD, Android 17 (API 37), 1080×2400 @2.625 (411×914 dp), 4 vCPU, 3 GB RAM | 16.7 ms (60 Hz detected) |

Android GPU path: `-gpu auto` → host GPU (SurfaceFlinger RenderEngine "Android Emulator OpenGL ES Translator (Apple M4 Pro)", GLES 3.0 on Metal; `ro.hardware.egl=emulation`, `ro.hardware.vulkan=ranchu`, hwui `skiagl`). Not SwiftShader.

### Reproducing

1. Build Release and install the build.

   ```sh
   # iOS, in example/ios
   xcodebuild -workspace VexflowNativeExample.xcworkspace -scheme VexflowNativeExample \
     -configuration Release -sdk iphonesimulator -destination 'id=<udid>' \
     -derivedDataPath build/dd ONLY_ACTIVE_ARCH=YES build
   # Android, in example
   CI=1 npx expo prebuild -p android
   (cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a)
   adb shell cmd package compile -m speed -f vexflownative.example
   ```

2. Capture the JS log for the whole pass.

   ```sh
   xcrun simctl spawn <udid> log stream --level info --style compact \
     --predicate 'subsystem == "com.facebook.react.log" AND category == "javascript"'
   adb logcat -v epoch -s ReactNativeJS:V
   ```

3. For every scenario × fixture, 1 discarded warm-up round (`k0`) and 5 measured rounds
   (`k1`–`k5`), round-robin with the order rotated by round. Every launch is a fresh process
   (restart the app, wait for the menu) opening
   `vexflownative://bench?scenario=<s>&fixture=<f>&runs=1&warmup=1&label=p2-<platform>-<s>-<f>-k<k>`.
   Wait for the `done` line, then read the peak memory of the live process (iOS
   `vmmap -summary` "Physical footprint (peak)", Android `/proc/<pid>/status` `VmHWM`).
4. Aggregate:
   `node example/scripts/aggregate-bench.mjs --platform ios --launches launches.ndjson --mem mem.ndjson --out-json example/benchmarks/skia-2.6.2-ios.json --out-md table.md device.log`
   (log files are positional; pass several to merge captures).
   `launches.ndjson` has one `{label, status, noisy}` line per launch and `mem.ndjson` one
   `{label, peakMB}` line. The aggregator keeps `run` lines with `status: ok` from launches
   that completed, drops `k0` and duplicates, and groups by scenario × fixture.

### Statistics

Each cell is `median / p95` across the measured runs (one run per launch), nearest rank. With
n = 5, p95 is the maximum. Times are ms, memory MB.

- **measure / layout / render→cmds / picture**: per recording (`rec.*Ms ÷ rec.n`, `pic.ms ÷ pic.n`). `initial` has one recording; `edit` has ten, one per edit. Every edit re-records the whole score.
- **ready**: `initial` mount → `onReady`; `edit` the median `setScore` → `onItemsLayout` of the run's ten edits.
- **frame**: ready plus 2 frames (`t.frameMs`, `edit.frameMedMs`).
- **UI p50 / UI p95 / dropped**: UI-thread frame-callback intervals and dropped frames at the detected rate (`ui.droppedHz`).
- **overlay max**: mean of the per-window max UI overlay replay (`ovl.meanMaxMs`).
- **JS p95**: `requestAnimationFrame` intervals. During `initial` and `edit` the synchronous mount or edit shows up as one long interval.
- **peak MB**: iOS physical footprint (peak); Android VmHWM (peak RSS). They aren't comparable across platforms.
- **noisy**: launches that started with host load1 > 10 after a 10 min wait (none).

### iOS simulator

| Scenario | Fixture  | n   | noisy | measure         | layout    | render→cmds     | picture     | ready           | frame           | UI p50      | UI p95      | dropped | overlay max | JS p95          | peak MB       |
| -------- | -------- | --- | ----- | --------------- | --------- | --------------- | ----------- | --------------- | --------------- | ----------- | ----------- | ------- | ----------- | --------------- | ------------- |
| initial  | long     | 5   | 0     | 2327.7 / 2351.8 | 0.9 / 1   | 2441.3 / 2444.6 | 50.1 / 51.4 | 4829.2 / 4843.1 | 4849.8 / 4866.6 | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 4831.2 / 4845   | 76.2 / 77.3   |
| initial  | short    | 5   | 0     | 155.4 / 156.6   | 0.1 / 0.1 | 138.3 / 138.8   | 3.5 / 3.5   | 305.5 / 306.1   | 333.9 / 334.3   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 308.1 / 308.9   | 51 / 51.1     |
| initial  | musicxml | 5   | 0     | 2802.8 / 2823.8 | 0.9 / 0.9 | 2971 / 2982.5   | 62.4 / 63.1 | 5848.3 / 5856.8 | 5865.6 / 5884.7 | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 5850.1 / 5858.6 | 77.2 / 79     |
| scroll   | long     | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 17.6 / 17.8     | 77.8 / 79.2   |
| scroll   | short    | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 17.7 / 17.8     | 54.8 / 55.1   |
| scroll   | musicxml | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 17.7 / 17.8     | 80.3 / 82.2   |
| playback | long     | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 1   | 4.7 / 4.7   | 17.9 / 17.9     | 138.1 / 139.4 |
| playback | short    | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | 1.9 / 2.2   | 17.6 / 17.7     | 64.4 / 64.6   |
| playback | musicxml | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 1   | 5.1 / 5.7   | 17.9 / 17.9     | 179.9 / 181.9 |
| edit     | long     | 5   | 0     | 2333.3 / 2352.7 | 1 / 1     | 2443.2 / 2456.2 | 50.6 / 51.4 | 4824.4 / 4864.8 | 4850.2 / 4882.2 | 16.7 / 16.7 | 16.7 / 16.7 | 2 / 3   | —           | 29.7 / 29.9     | 96.4 / 97.3   |
| edit     | short    | 5   | 0     | 156.7 / 159.3   | 0.1 / 0.1 | 137.4 / 138.6   | 2.7 / 2.8   | 299.5 / 301.3   | 316.2 / 316.5   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 2   | —           | 29.1 / 30       | 54.8 / 58.1   |

- The UI thread never stalls, not even during a 5–6 s JS mount: scroll and playback hold
  16.7 ms at p95, and `playback` and `edit` drop at most 3 frames per run.
- JS phases dominate. On `long` (208 measures × 2 staves), measure ≈ 2.3 s and
  render-to-commands ≈ 2.4 s; replaying the picture costs ≈ 50 ms.
- A single-note edit costs as much as the initial render (≈ 4.8 s on `long`, ≈ 0.3 s on
  `short`), because the whole score is measured and recorded again.
- Playback adds ≈ 60–100 MB of peak footprint over scroll on the long fixtures (overlay pictures).

### Android emulator

| Scenario | Fixture  | n   | noisy | measure           | layout    | render→cmds       | picture       | ready             | frame             | UI p50      | UI p95        | dropped   | overlay max | JS p95            | peak MB       |
| -------- | -------- | --- | ----- | ----------------- | --------- | ----------------- | ------------- | ----------------- | ----------------- | ----------- | ------------- | --------- | ----------- | ----------------- | ------------- |
| initial  | long     | 5   | 0     | 12131.7 / 13306.7 | 5.6 / 5.8 | 13030.4 / 13657.2 | 371.8 / 391.3 | 25620.8 / 27074.5 | 25709.1 / 27196.2 | 16.7 / 16.7 | 66.7 / 83.3   | 560 / 725 | —           | 25623.9 / 27077.6 | 279.7 / 281.9 |
| initial  | short    | 5   | 0     | 726.6 / 832.8     | 0.4 / 0.6 | 695 / 717.7       | 17.5 / 19.1   | 1463.1 / 1583.2   | 1512.3 / 1859.1   | 16.7 / 16.7 | 66.7 / 66.7   | 28 / 46   | —           | 1464.6 / 1575     | 257.3 / 258.4 |
| initial  | musicxml | 5   | 0     | 14559.1 / 14715.3 | 5.6 / 5.7 | 15750.3 / 22364.8 | 430.4 / 467.9 | 30757.6 / 37544   | 30853.3 / 37650   | 16.7 / 16.7 | 66.7 / 100    | 741 / 986 | —           | 30760.1 / 37547.2 | 288.9 / 290.2 |
| scroll   | long     | 5   | 0     | —                 | —         | —                 | —             | —                 | —                 | 33.3 / 50   | 150 / 216.7   | 227 / 259 | —           | 221.8 / 272.7     | 286.1 / 287.4 |
| scroll   | short    | 5   | 0     | —                 | —         | —                 | —             | —                 | —                 | 33.3 / 33.3 | 183.3 / 216.7 | 222 / 267 | —           | 229.1 / 248.4     | 258.8 / 259.3 |
| scroll   | musicxml | 5   | 0     | —                 | —         | —                 | —             | —                 | —                 | 33.3 / 33.3 | 133.3 / 200   | 235 / 257 | —           | 183 / 238.4       | 295 / 295.3   |
| playback | long     | 5   | 0     | —                 | —         | —                 | —             | —                 | —                 | 16.7 / 16.7 | 166.7 / 200   | 215 / 236 | 17.6 / 23.5 | 220 / 241.3       | 347 / 347.8   |
| playback | short    | 5   | 0     | —                 | —         | —                 | —             | —                 | —                 | 16.7 / 33.3 | 166.7 / 200   | 221 / 226 | 6.1 / 7.9   | 201 / 227.5       | 264.4 / 265.1 |
| playback | musicxml | 5   | 0     | —                 | —         | —                 | —             | —                 | —                 | 16.7 / 16.7 | 150 / 183.3   | 208 / 217 | 20.9 / 22.1 | 224.5 / 232.2     | 386.9 / 390.2 |
| edit     | short    | 5   | 0     | 691 / 730         | 0.4 / 0.5 | 696.4 / 731.6     | 18.3 / 19     | 1426.6 / 1451.2   | 1515.5 / 1579.5   | 16.7 / 16.7 | 83.3 / 116.7  | 570 / 584 | —           | 1427.9 / 1451.8   | 258.9 / 261.3 |

- `edit` × `long` is missing: the first edit exceeds the harness's 20 s layout timeout and the
  session aborts (`error: timeout:layout`). Every edit re-records the score, so each costs
  about as much as the `initial` × `long` ready time (25.6 s).
- The emulator, not the renderer, limits UI-thread pacing. During a 6 s scroll window, only
  ~140 of 360 UI frames arrive, even on `short` with no JS work. Inside the guest, a scroll run
  shows ~170% sys, ~75% irq and ~70% iowait across 4 vCPUs, and ~950 MB of the 3 GB is
  swapped. `dumpsys gfxinfo` reports most frames as "slow issue draw commands" (GL commands
  going through the emulator pipe to the host).
- JS phases are 4.7–7.4× slower than on the iOS simulator, depending on the phase.
- Use the Android numbers only for before/after comparisons on the same AVD, image and
  settings, not as device performance.

Parity baseline: 10 cases × light/dark on both devices (40 full-resolution PNGs, kept outside
the repo). Every case reached `parity-ready`, a second capture 1 s later was pixel-identical,
and the dark captures stay at ≤ 27.2 mean luma below the status bar (light ≥ 235).

### Failures and anomalies

- **Android Release build of the baseline**: `:app:parseReleaseLocalResources` failed. The
  MusicXML fixture was then an `.xml` asset, which Expo's `export:embed` and the RN
  assets-registry classify as a drawable, so it was copied to `res/drawable-mdpi` and aapt2
  rejected it. Debug builds don't hit this, because they load assets from Metro. The baseline
  APK was built with a local, uncommitted change that maps `xml` to `raw` in
  `@expo/cli/build/src/export/metroAssetLocalPath.js`. The fixture now ships as
  `src/musicxml/__fixtures__/lg-8102429.musicxml`, which lands in `res/raw` without the
  workaround. The bytes and runtime loading are the same, so later builds are comparable.
- **`edit` × `musicxml`** (both platforms): no data. Voice 0 of the middle measure of staff 0
  holds a whole-note chord, and `getEditTarget` only looks for `note` items, so every run is
  `invalid: no-edit-target`. On iOS, 5 launches are discarded. On Android, the cell was left
  out of the matrix after the warm-up smoke run.
- **`edit` × `long`** on Android: not measured (see above). On iOS, each `edit` × `long`
  launch takes ~126 s. The first launches hit the driver's 60 s timeout (3 failed attempts) and were re-run with a
  600 s limit.
- The iOS log capture stopped once mid-matrix. The driver was stopped, and the launch in flight
  was re-run after the capture restarted. All cells have n = 5.
- Android `initial` × `long`/`musicxml` reach 27–38 s at p95, against the harness's 60 s ready
  timeout.
- No launch crashed, malformed lines = 0 on both platforms, and no launch was noisy
  (load1 ≤ 10). No thermal warnings were recorded before or after either pass.

### Skia 3 (VEX-22)

To be filled with the same columns, devices and method.

### Appendix

<details><summary>ios: appendix (median / p95)</summary>

| Scenario | Fixture  | rec.n   | rec.totalMs       | rec.commands  | t.otherMs | edit.recP95Ms | edit.layoutP95Ms | edit.frameP95Ms | ui.frames   | ui.p99Ms    | ui.maxMs    | ui.dropped60 | js.p50Ms    | js.maxMs        | js.dropped60 | heap.afterMB | steps   | scrollRange       |
| -------- | -------- | ------- | ----------------- | ------------- | --------- | ------------- | ---------------- | --------------- | ----------- | ----------- | ----------- | ------------ | ----------- | --------------- | ------------ | ------------ | ------- | ----------------- |
| initial  | long     | 1 / 1   | 4770.7 / 4784.9   | 52062 / 52062 | 8.5 / 8.6 | —             | —                | —               | 291 / 292   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 19.3 / 28.6 | 4831.2 / 4845   | 289 / 290    | 21.3 / 22.6  | —       | —                 |
| initial  | short    | 1 / 1   | 293.6 / 295.2     | 2870 / 2870   | 7.7 / 8.4 | —             | —                | —               | 20 / 20     | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 25.4 / 26.4 | 308.1 / 308.9   | 18 / 19      | 5.6 / 5.6    | —       | —                 |
| initial  | musicxml | 1 / 1   | 5779.1 / 5785.6   | 63833 / 63833 | 8 / 9.1   | —             | —                | —               | 352 / 353   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.1 / 26.3 | 5850.1 / 5858.6 | 350 / 352    | 25.8 / 25.8  | —       | —                 |
| scroll   | long     | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.8 | 18.4 / 20.3     | 0 / 0        | 22.2 / 22.9  | —       | 70493.3 / 70493.3 |
| scroll   | short    | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.8 | 19 / 19.4       | 0 / 0        | 5.7 / 5.7    | —       | 3423.6 / 3423.6   |
| scroll   | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.7 | 18.3 / 18.6     | 0 / 0        | 25.9 / 25.9  | —       | 64513.5 / 64513.5 |
| playback | long     | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 33.3 | 0 / 1        | 16.9 / 16.9 | 18.8 / 20.1     | 0 / 0        | 26.7 / 26.7  | 49 / 49 | —                 |
| playback | short    | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.7 | 18.2 / 18.5     | 0 / 0        | 6.9 / 6.9    | 49 / 49 | —                 |
| playback | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 33.3 | 0 / 1        | 16.9 / 16.9 | 23.8 / 28.4     | 0 / 1        | 30.9 / 30.9  | 49 / 49 | —                 |
| edit     | long     | 10 / 10 | 47711.2 / 48097.7 | 52062 / 52062 | —         | 4807 / 4834.7 | 4859.7 / 4885.1  | 4884.1 / 4916   | 3099 / 3117 | 16.7 / 16.7 | 34.2 / 37.5 | 2 / 3        | 16.8 / 16.8 | 4860.9 / 4890.1 | 2893 / 2912  | 28.5 / 31.9  | —       | —                 |
| edit     | short    | 10 / 10 | 2937.3 / 2973     | 2870 / 2870   | —         | 299 / 301.8   | 303.7 / 306.2    | 333.3 / 333.3   | 376 / 381   | 16.7 / 16.7 | 16.7 / 38.3 | 0 / 2        | 16.8 / 16.8 | 305.5 / 307.8   | 171 / 174    | 11 / 11      | —       | —                 |

</details>

<details><summary>android: appendix (median / p95)</summary>

| Scenario | Fixture  | rec.n   | rec.totalMs       | rec.commands  | t.otherMs   | edit.recP95Ms | edit.layoutP95Ms | edit.frameP95Ms | ui.frames   | ui.p99Ms      | ui.maxMs      | ui.dropped60 | js.p50Ms    | js.maxMs          | js.dropped60 | heap.afterMB | steps   | scrollRange       |
| -------- | -------- | ------- | ----------------- | ------------- | ----------- | ------------- | ---------------- | --------------- | ----------- | ------------- | ------------- | ------------ | ----------- | ----------------- | ------------ | ------------ | ------- | ----------------- |
| initial  | long     | 1 / 1   | 25167.6 / 26664   | 52062 / 52062 | 47 / 61.9   | —             | —                | —               | 961 / 1153  | 133.3 / 183.3 | 200 / 216.7   | 560 / 725    | 53.8 / 87.3 | 25623.9 / 27077.6 | 1539 / 1629  | 20.9 / 21.6  | —       | —                 |
| initial  | short    | 1 / 1   | 1417 / 1528.5     | 2870 / 2870   | 31.2 / 55.5 | —             | —                | —               | 66 / 79     | 66.7 / 250    | 66.7 / 250    | 28 / 46      | 33.6 / 49   | 1464.6 / 1575     | 88 / 108     | 10.2 / 10.3  | —       | —                 |
| initial  | musicxml | 1 / 1   | 30315.2 / 37085.8 | 63833 / 63833 | 37.6 / 47.9 | —             | —                | —               | 1188 / 1521 | 133.3 / 183.3 | 216.7 / 550   | 741 / 986    | 55.6 / 66.7 | 30760.1 / 37547.2 | 1853 / 2256  | 25.5 / 25.5  | —       | —                 |
| scroll   | long     | 0 / 0   | 0 / 0             | 0 / 0         | —           | —             | —                | —               | 136 / 140   | 233.3 / 366.7 | 250 / 400     | 227 / 259    | 48 / 69.7   | 268.5 / 415.8     | 281 / 282    | 21.6 / 21.6  | —       | 69502.3 / 69502.3 |
| scroll   | short    | 0 / 0   | 0 / 0             | 0 / 0         | —           | —             | —                | —               | 140 / 150   | 233.3 / 366.7 | 250 / 366.7   | 222 / 267    | 55.1 / 58   | 278.5 / 393.2     | 282 / 292    | 9.9 / 10.3   | —       | 3367.5 / 3367.5   |
| scroll   | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —           | —             | —                | —               | 134 / 145   | 216.7 / 250   | 250 / 350     | 235 / 257    | 53.3 / 66.3 | 263.9 / 382.3     | 274 / 292    | 25.5 / 25.5  | —       | 64130.3 / 64130.3 |
| playback | long     | 0 / 0   | 0 / 0             | 0 / 0         | —           | —             | —                | —               | 152 / 160   | 200 / 216.7   | 216.7 / 216.7 | 215 / 236    | 41.7 / 47.8 | 244.3 / 253.9     | 274 / 290    | 26.5 / 28    | 49 / 49 | —                 |
| playback | short    | 0 / 0   | 0 / 0             | 0 / 0         | —           | —             | —                | —               | 148 / 180   | 200 / 216.7   | 216.7 / 250   | 221 / 226    | 41.2 / 47.9 | 241.8 / 259.2     | 269 / 288    | 6.9 / 7      | 49 / 50 | —                 |
| playback | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —           | —             | —                | —               | 159 / 180   | 200 / 216.7   | 216.7 / 216.7 | 208 / 217    | 42.3 / 43.9 | 249 / 278.4       | 265 / 274    | 32.9 / 33.6  | 49 / 50 | —                 |
| edit     | short    | 10 / 10 | 13877.6 / 14621.4 | 2870 / 2870   | —           | 1480 / 1867   | 1503.6 / 1912.7  | 1642.2 / 2059.2 | 628 / 681   | 200 / 200     | 233.3 / 316.7 | 570 / 584    | 36.2 / 42.3 | 1503.6 / 1912     | 1058 / 1120  | 11.1 / 11.1  | —       | —                 |

</details>
