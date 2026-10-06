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

The host-side driver, the parity capture and diff scripts, and the raw results live in the separate `vexflow-native-bench` repo.

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

## Skia 3 (VEX-22)

The drop-in: react-native-skia 3.0.3 with the renderer unchanged. Same harness, devices,
build type, driver, cells and statistics as the baseline.

| Date       | Commit    | Build                                                                             | Versions                                                                                                                                    | Host                                                                    | Tooling                                                                                                                                    |
| ---------- | --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-06 | `5dbfed2` | Release, Hermes bytecode, new arch; iOS sim arm64 / Android arm64-v8a (debug key) | react-native-skia 3.0.3 (Graphite 154.0.1), RN 0.81.5, reanimated 4.2.2, worklets 0.7.4, expo 54.0.33, react 19.1.0, gesture-handler 2.30.0 | Apple M4 Pro (10P+4E), 24 GB, macOS 27.2, AC power, no thermal warnings | Xcode 27.0, JDK 17, Gradle 8.14.3, node 25.9, argent 0.26.0, Android emulator 36.5.10 (`-force-snapshot-load -no-snapshot-save -gpu auto`) |

| Platform | Device                                | Drawing backend                                                                                              |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| iOS      | iPhone 17 simulator, same as baseline | Graphite on Dawn → Metal (simulator GPU)                                                                     |
| Android  | `Medium_Phone` AVD, same as baseline  | Graphite on Dawn → Vulkan; the emulator's Vulkan is **llvmpipe (software)**, "Goldfish GFXStream (llvmpipe)" |

> **Android caveat.** skia 3 draws with Graphite on Dawn → Vulkan, and on this emulator that
> Vulkan is llvmpipe, a CPU rasterizer. The 2.6.2 baseline drew with Ganesh GL on the host GPU
> (GLES translated to Metal). Android UI-thread, frame and overlay numbers are therefore **not
> comparable** with the baseline and say nothing about devices. The JS phases (measure, layout,
> render→cmds, ready) don't touch the GPU and stay comparable.

Both builds are the archived Release binaries from `5dbfed2` (sha256 checked against the
archive before installing). Each platform ran alone, with the same 1 warm-up + 5 measured
rounds and the same skipped cells (`edit` × `musicxml`; on Android also `edit` × `long`). No
launch failed, crashed or was noisy; malformed lines = 0.

**Host drift.** A short same-session re-run of the archived 2.6.2 build (iOS: `initial` ×
`long`/`short` and `scroll` × `long`, n = 5 each) came out 11 % slower than the committed
baseline on `initial` × `long` (ready 5359.8 vs 4829.2 ms), 5 % on `short` and unchanged on
`scroll`. That is under the 15 % threshold, so the delta tables below compare against the
committed baseline, but about two thirds of the iOS JS-phase delta is host drift:

| iOS, 3.0.3 vs same-session 2.6.2 | n   | measure | render→cmds | picture | ready | UI p95 | peak MB |
| -------------------------------- | --- | ------- | ----------- | ------- | ----- | ------ | ------- |
| initial × long                   | 5/5 | +3.2%   | +4.2%       | +4.5%   | +3.7% | +0%    | +3.3%   |
| initial × short                  | 5/5 | +0.1%   | +0.7%       | −15.8%  | +0.4% | +0%    | +19.5%  |
| scroll × long                    | 5/5 | —       | —           | —       | —     | +0%    | +4.7%   |

**Android emulator speed is bimodal.** During this pass the emulator's CPU ran in two
states that alternated every few minutes, independent of skia: in the "fast" state JS phases
run at iOS-simulator speed (`initial` × `long` measure ≈ 2.4 s), in the "slow" state ≈ 5×
slower (≈ 12 s, the speed of the whole baseline pass). The archived 2.6.2 APK shows the same
two states in the same session (`initial` × `long` ready 4.9 s in 3 launches, 23.5 s in 1).
The cause is on the host (most likely macOS scheduling of the emulator's vCPU threads; the
host was in interactive use during this pass; the baseline ran overnight). Each Android
launch is therefore tagged with its state: by measure per recording against the baseline
(fast below 0.5×, slow above 0.75×) or, for `scroll` and `playback`, where nothing runs on JS,
by JS-thread rAF p95 (fast below 100 ms, slow above 150 ms). No launch fell between. The
Android table and `skia-3.0.3-android.json` use only slow-state launches, which match the
baseline's host state; that leaves n = 2–4 per cell (32 of 50 launches). The 18 fast-state
launches are in a separate table. The aggregator ran over a launch list with every
other-state launch marked `excluded`; the per-launch tags are kept with the raw logs.

### iOS simulator (skia 3.0.3)

| Scenario | Fixture  | n   | noisy | measure         | layout    | render→cmds     | picture     | ready           | frame           | UI p50      | UI p95      | dropped | overlay max | JS p95          | peak MB       |
| -------- | -------- | --- | ----- | --------------- | --------- | --------------- | ----------- | --------------- | --------------- | ----------- | ----------- | ------- | ----------- | --------------- | ------------- |
| initial  | long     | 5   | 0     | 2671.1 / 2744   | 1 / 1.1   | 2823.8 / 2894.2 | 58.2 / 61.1 | 5559.7 / 5701.4 | 5583.2 / 5717   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 1   | —           | 5561.1 / 5702.8 | 78.8 / 87     |
| initial  | short    | 5   | 0     | 159.2 / 162.5   | 0.1 / 0.1 | 154.3 / 174.3   | 3.2 / 3.5   | 321.9 / 347.8   | 349.9 / 366.5   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 323.5 / 349.5   | 61.3 / 64.6   |
| initial  | musicxml | 5   | 0     | 3276.6 / 3430.6 | 1.1 / 1.1 | 3438.5 / 3575.5 | 71.9 / 78.8 | 6797.7 / 7092.3 | 6816.1 / 7115.8 | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 1   | —           | 6799.1 / 7093.7 | 83.6 / 86     |
| scroll   | long     | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 17.4 / 17.5     | 81.8 / 82     |
| scroll   | short    | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 1   | —           | 17.1 / 17.2     | 63.8 / 72     |
| scroll   | musicxml | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 17.4 / 17.5     | 86.3 / 87.9   |
| playback | long     | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | 0.9 / 1     | 17.4 / 17.5     | 134.2 / 135.7 |
| playback | short    | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | 0.9 / 0.9   | 17.1 / 17.1     | 71.5 / 71.9   |
| playback | musicxml | 5   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 1   | 0.9 / 0.9   | 17.5 / 17.5     | 159.8 / 183.4 |
| edit     | long     | 5   | 0     | 2712.6 / 2781.9 | 1.6 / 1.6 | 2875.4 / 2899.8 | 60.7 / 61.4 | 5664.4 / 5733.1 | 5682.8 / 5749.8 | 16.7 / 16.7 | 16.7 / 16.7 | 12 / 18 | —           | 29.4 / 29.6     | 103.3 / 104.8 |
| edit     | short    | 5   | 0     | 161.2 / 163.5   | 0.1 / 0.1 | 156.4 / 165.7   | 3.2 / 3.3   | 323.9 / 330.1   | 349.7 / 349.9   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 27.2 / 29.6     | 66.1 / 66.3   |

Median Δ vs the 2.6.2 baseline. **Bold**: |Δ| > 10 %, |Δ| ≥ 1 ms / frame / MB, and the
min–max ranges of the two cells don't overlap.

| Scenario | Fixture  | n (2.6.2 / 3.0.3) | measure    | layout | render→cmds | picture    | ready      | frame      | UI p50 | UI p95 | dropped   | overlay max | JS p95     | peak MB    |
| -------- | -------- | ----------------- | ---------- | ------ | ----------- | ---------- | ---------- | ---------- | ------ | ------ | --------- | ----------- | ---------- | ---------- |
| initial  | long     | 5 / 5             | **+14.8%** | +11.1% | **+15.7%**  | **+16.2%** | **+15.1%** | **+15.1%** | +0%    | +0%    | 0         | —           | **+15.1%** | +3.4%      |
| initial  | short    | 5 / 5             | +2.4%      | +0%    | **+11.6%**  | -8.6%      | +5.4%      | +4.8%      | +0%    | +0%    | 0         | —           | +5%        | **+20.2%** |
| initial  | musicxml | 5 / 5             | **+16.9%** | +22.2% | **+15.7%**  | **+15.2%** | **+16.2%** | **+16.2%** | +0%    | +0%    | 0         | —           | **+16.2%** | +8.3%      |
| scroll   | long     | 5 / 5             | —          | —      | —           | —          | —          | —          | +0%    | +0%    | 0         | —           | -1.1%      | +5.1%      |
| scroll   | short    | 5 / 5             | —          | —      | —           | —          | —          | —          | +0%    | +0%    | 0         | —           | -3.4%      | **+16.4%** |
| scroll   | musicxml | 5 / 5             | —          | —      | —           | —          | —          | —          | +0%    | +0%    | 0         | —           | -1.7%      | +7.5%      |
| playback | long     | 5 / 5             | —          | —      | —           | —          | —          | —          | +0%    | +0%    | 0         | **-80.9%**  | -2.8%      | -2.8%      |
| playback | short    | 5 / 5             | —          | —      | —           | —          | —          | —          | +0%    | +0%    | 0         | -52.6%      | -2.8%      | **+11%**   |
| playback | musicxml | 5 / 5             | —          | —      | —           | —          | —          | —          | +0%    | +0%    | 0         | **-82.4%**  | -2.2%      | -11.2%     |
| edit     | long     | 5 / 5             | **+16.3%** | +60%   | **+17.7%**  | **+20%**   | **+17.4%** | **+17.2%** | +0%    | +0%    | **+500%** | —           | -1%        | +7.2%      |
| edit     | short    | 5 / 5             | +2.9%      | +0%    | **+13.8%**  | +18.5%     | +8.1%      | **+10.6%** | +0%    | +0%    | 0         | —           | -6.5%      | **+20.6%** |

- UI thread: unchanged. Scroll and playback hold 16.7 ms at p95 with 0 dropped frames in
  every cell, including during the 5–7 s JS mounts.
- Overlay replay (`overlay max`) is 2–6× cheaper: 0.9 ms against 1.9–5.1 ms.
- JS phases: +15–17 % on the long fixtures against the committed baseline, but only
  +3–4 % against the same-session 2.6.2 control (above); `short` is within ±1 %. The JS
  thread still dominates: `initial` × `long` is 2.7 s measure + 2.8 s render→cmds out of
  5.6 s, and replaying the picture is 58 ms.
- `edit` × `long`: one UI hitch per few edits (UI max 68 / 92 ms, 12 / 18 dropped frames
  per 10 edits, baseline 2 / 3). The first frame after a whole-score re-record now costs a
  noticeable UI-thread stall.
- Peak footprint: +3–8 % on the long fixtures, +7–11 MB (+11–21 %) on `short`: a fixed cost
  of Dawn/Graphite. Playback × musicxml is 20 MB lower.

### Android emulator (skia 3.0.3, software Vulkan, slow host state)

| Scenario | Fixture  | n   | noisy | measure           | layout    | render→cmds       | picture       | ready             | frame           | UI p50      | UI p95        | dropped   | overlay max | JS p95            | peak MB       |
| -------- | -------- | --- | ----- | ----------------- | --------- | ----------------- | ------------- | ----------------- | --------------- | ----------- | ------------- | --------- | ----------- | ----------------- | ------------- |
| initial  | long     | 4   | 0     | 12375.7 / 13833.4 | 4.1 / 6.6 | 13768.9 / 14346   | 281.5 / 346.8 | 26544 / 28611.8   | 26669.9 / 28656 | 16.7 / 16.7 | 66.7 / 66.7   | 557 / 606 | —           | 26548.4 / 28618.6 | 311.9 / 315.1 |
| initial  | short    | 4   | 0     | 704.7 / 1067      | 0.3 / 1   | 651.5 / 685.3     | 18 / 20.9     | 1430.9 / 1682.7   | 1597.3 / 1771.7 | 16.7 / 16.7 | 50 / 66.7     | 21 / 42   | —           | 1435.6 / 1685     | 303.3 / 306   |
| initial  | musicxml | 4   | 0     | 15871.9 / 16553.4 | 3.8 / 5.8 | 15661.1 / 16708.9 | 389.7 / 417.1 | 31547.3 / 33075.2 | 31605.4 / 33113 | 16.7 / 16.7 | 66.7 / 83.3   | 630 / 837 | —           | 31549.8 / 33077.4 | 320.3 / 323.4 |
| scroll   | long     | 2   | 0     | —                 | —         | —                 | —             | —                 | —               | 133.3 / 150 | 250 / 400     | 310 / 348 | —           | 255 / 402.2       | 316.1 / 321.3 |
| scroll   | short    | 3   | 0     | —                 | —         | —                 | —             | —                 | —               | 133.3 / 150 | 250 / 266.7   | 318 / 319 | —           | 221.5 / 266.2     | 299.2 / 306.6 |
| scroll   | musicxml | 2   | 0     | —                 | —         | —                 | —             | —                 | —               | 116.7 / 150 | 266.7 / 266.7 | 310 / 316 | —           | 266.2 / 276.6     | 326.6 / 327.3 |
| playback | long     | 3   | 0     | —                 | —         | —                 | —             | —                 | —               | 100 / 100   | 250 / 266.7   | 315 / 320 | 3.2 / 3.6   | 262.7 / 272       | 394.7 / 394.8 |
| playback | short    | 4   | 0     | —                 | —         | —                 | —             | —                 | —               | 100 / 100   | 283.3 / 300   | 312 / 325 | 1.6 / 2.3   | 288.7 / 295.1     | 309.2 / 313.9 |
| playback | musicxml | 3   | 0     | —                 | —         | —                 | —             | —                 | —               | 100 / 116.7 | 316.7 / 366.7 | 320 / 336 | 2.8 / 5     | 367.6 / 382       | 427.8 / 428.1 |
| edit     | short    | 3   | 0     | 698.8 / 790.1     | 0.3 / 0.4 | 728.6 / 786.6     | 18.9 / 19.2   | 1422.3 / 1652     | 1602.6 / 1837.5 | 16.7 / 16.7 | 100 / 100     | 528 / 585 | —           | 1424.4 / 1663.6   | 302.2 / 304.2 |

Median Δ vs the 2.6.2 baseline (same flag rule). Only the JS-phase columns (measure →
frame) are comparable; UI, dropped, overlay and JS p95 compare llvmpipe against the host GPU.

| Scenario | Fixture  | n (2.6.2 / 3.0.3) | measure | layout | render→cmds | picture    | ready | frame | UI p50    | UI p95     | dropped    | overlay max | JS p95     | peak MB    |
| -------- | -------- | ----------------- | ------- | ------ | ----------- | ---------- | ----- | ----- | --------- | ---------- | ---------- | ----------- | ---------- | ---------- |
| initial  | long     | 5 / 4             | +2%     | -26.8% | +5.7%       | **-24.3%** | +3.6% | +3.7% | +0%       | +0%        | -0.5%      | —           | +3.6%      | **+11.5%** |
| initial  | short    | 5 / 4             | -3%     | -25%   | -6.3%       | +2.9%      | -2.2% | +5.6% | +0%       | -25%       | -25%       | —           | -2%        | **+17.9%** |
| initial  | musicxml | 5 / 4             | +9%     | -32.1% | -0.6%       | -9.5%      | +2.6% | +2.4% | +0%       | +0%        | -15%       | —           | +2.6%      | **+10.9%** |
| scroll   | long     | 5 / 2             | —       | —      | —           | —          | —     | —     | **+300%** | **+66.7%** | **+36.6%** | —           | +15%       | **+10.5%** |
| scroll   | short    | 5 / 3             | —       | —      | —           | —          | —     | —     | **+300%** | +36.4%     | **+43.2%** | —           | -3.3%      | **+15.6%** |
| scroll   | musicxml | 5 / 2             | —       | —      | —           | —          | —     | —     | **+250%** | **+100%**  | **+31.9%** | —           | **+45.5%** | **+10.7%** |
| playback | long     | 5 / 3             | —       | —      | —           | —          | —     | —     | +499%     | +50%       | +46.5%     | **-81.8%**  | +19.4%     | **+13.7%** |
| playback | short    | 5 / 4             | —       | —      | —           | —          | —     | —     | +499%     | **+69.9%** | **+41.2%** | **-73.8%**  | **+43.6%** | **+16.9%** |
| playback | musicxml | 5 / 3             | —       | —      | —           | —          | —     | —     | **+499%** | **+111%**  | **+53.8%** | **-86.6%**  | **+63.7%** | **+10.6%** |
| edit     | short    | 5 / 3             | +1.1%   | -25%   | +4.6%       | +3.3%      | -0.3% | +5.7% | +0%       | +20%       | -7.4%      | —           | -0.2%      | **+16.7%** |

- JS phases are unchanged: measure, render→cmds and ready are within −6…+9 % of the
  baseline, inside the run-to-run ranges. In the fast state they match the same-session
  2.6.2 fast launches too (`initial` × `long` ready 5073 vs 4917–4922 ms, `short` 320 vs
  317–320 ms).
- Software Vulkan: in the slow state scroll and playback fall to 40–77 UI frames per 6 s
  window (one run 142; UI p50 100–133 ms) against 94–180 on GL. In the fast state the same
  build holds 60 Hz in scroll and playback (UI p50 / p95 16.7 ms, median 0–3 dropped; one
  musicxml scroll run 80), where the same-session 2.6.2 scroll on GL stays at 133–170
  frames. Neither says anything about a device GPU.
- Overlay replay is 4–7× cheaper (1.6–3.2 ms against 6.1–20.9 ms).
- Peak RSS (VmHWM) is 30–48 MB higher (+10–18 %), mostly Dawn's `libwebgpu_dawn.so`
  plus llvmpipe; on a device the GPU driver changes this.
- No launch showed the FU-1 blank canvas signature: every run recorded exactly once per
  mount (`rec.n`/`pic.n` 1 / 10 / 0 as expected), every viewport was 411×480, and every
  UI-frame outlier lines up with the host state above. The driver takes no screenshots, so a
  blank presented frame would not be detected by these metrics.

<details><summary>android, skia 3.0.3, fast host state (median / p95; no baseline counterpart)</summary>

| Scenario | Fixture  | n   | noisy | measure         | layout    | render→cmds     | picture     | ready           | frame           | UI p50      | UI p95      | dropped | overlay max | JS p95          | peak MB       |
| -------- | -------- | --- | ----- | --------------- | --------- | --------------- | ----------- | --------------- | --------------- | ----------- | ----------- | ------- | ----------- | --------------- | ------------- |
| initial  | long     | 1   | 0     | 2425.1 / 2425.1 | 1.1 / 1.1 | 2561.7 / 2561.7 | 65.5 / 65.5 | 5073.2 / 5073.2 | 5133.8 / 5133.8 | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 5074.2 / 5074.2 | 313 / 313     |
| initial  | short    | 1   | 0     | 160.1 / 160.1   | 0.1 / 0.1 | 138.3 / 138.3   | 3.7 / 3.7   | 319.9 / 319.9   | 347.6 / 347.6   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 320.5 / 320.5   | 305.3 / 305.3 |
| initial  | musicxml | 1   | 0     | 2776.7 / 2776.7 | 0.9 / 0.9 | 2957.1 / 2957.1 | 71.1 / 71.1 | 5825.8 / 5825.8 | 5909.3 / 5909.3 | 16.7 / 16.7 | 16.7 / 16.7 | 1 / 1   | —           | 5827.2 / 5827.2 | 323.2 / 323.2 |
| scroll   | long     | 3   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 1 / 1   | —           | 35.6 / 35.8     | 320.4 / 322.4 |
| scroll   | short    | 2   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0   | —           | 35.7 / 35.8     | 304.6 / 305.6 |
| scroll   | musicxml | 3   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 2 / 80  | —           | 35.6 / 54.9     | 324.7 / 328.2 |
| playback | long     | 2   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 1 / 6   | 0.5 / 0.5   | 34.1 / 36.6     | 394.2 / 394.8 |
| playback | short    | 1   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 1 / 1   | 0.4 / 0.4   | 38.8 / 38.8     | 312.3 / 312.3 |
| playback | musicxml | 2   | 0     | —               | —         | —               | —           | —               | —               | 16.7 / 16.7 | 16.7 / 16.7 | 3 / 5   | 0.6 / 0.7   | 24.3 / 25       | 429.5 / 430.9 |
| edit     | short    | 2   | 0     | 169.7 / 313     | 0.1 / 0.1 | 141.8 / 264.8   | 3.2 / 5.8   | 316.8 / 319.4   | 380.8 / 382.6   | 16.7 / 16.7 | 16.7 / 33.3 | 0 / 128 | —           | 312.7 / 316.9   | 308.2 / 308.5 |

</details>

### Conclusion (VEX-22)

What changed with the drop-in alone:

| Scenario   | Improved                                           | Unchanged / worse                                                                                 | Top remaining bottleneck                                                                                                    | Track 2                                                                  |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `initial`  | —                                                  | JS phases within +4 % (iOS, vs same-session) / ±6 % (Android); +10 MB fixed memory                | JS thread: measure ≈ 47–48 % + render→cmds ≈ 51–52 % of ready (`long`: 5.6 s iOS, 26.5 s emulator); picture replay ≈ 1 %    | VEX-29 background format worker, VEX-25 Bundle-Mode spike                |
| `edit`     | —                                                  | Same JS cost; iOS `long` now drops 12 frames per 10 edits (was 2)                                 | Every edit re-measures and re-records the whole score (5.7 s on iOS `long`), then the new picture stalls the UI thread once | VEX-29 / VEX-25 (incremental re-record, off-thread); VEX-23              |
| `scroll`   | —                                                  | iOS 60 Hz, 0 dropped (as before); emulator not comparable (software Vulkan)                       | Full-picture replay every frame: free on the iOS GPU, the whole cost on a CPU rasterizer                                    | VEX-24 spatial index + VEX-26 per-frame culled replay, VEX-28 tile cache |
| `playback` | Overlay replay 2–6× (iOS), 4–7× (emulator) cheaper | iOS 60 Hz, 0 dropped (as before); +50–75 MB over scroll for overlay pictures on the long fixtures | Overlay pictures re-recorded per step on the UI runtime, plus base-picture replay on page turns                             | VEX-27 overlay fold, VEX-26                                              |

VEX-30 (renderer selection) has nothing to select in 3.0.3: there is one `Canvas`, Graphite on
Dawn everywhere. VEX-31 (glyph runs) targets render→cmds, half of every recording.

Costs: +20.5 MB APK (arm64 Release, 62.7 MB), +11 MB iOS app (57 MB), +743 MiB `node_modules`
(Graphite binaries in both workspaces), +7–11 MB iOS / +30–48 MB emulator peak memory, Android
minSdk 26.

**Go/no-go: GO** for shipping the drop-in alone as the next major, **conditional on Android
real-device data.** iOS meets every criterion: no visual regressions (VEX-21), no crash in
85 iOS and 75 Android launches, UI frame time unchanged (16.7 ms p95, 0 dropped in scroll
and playback), JS phases within +4 % of a same-session 2.6.2 run, and overlay replay
cheaper. Memory grows by a
fixed ~10 MB and `edit` × `long` gains a UI hitch per re-record, both acceptable. No leak test
was run beyond per-launch peaks. Android is functionally on par and its JS phases are
unchanged, but on this emulator Graphite runs on a software rasterizer, so its UI-thread cost
is unmeasured and the VEX-21 FU-1 blank-canvas flake is still open. Before release, run scroll
and playback on one real Vulkan device (a mid-range one) against 2.6.2 and check FU-1 there;
if scroll or playback regress there, Android is no-go until VEX-26/28 land.

### Appendix (skia 3.0.3)

<details><summary>ios, skia 3.0.3: appendix (median / p95)</summary>

| Scenario | Fixture  | rec.n   | rec.totalMs       | rec.commands  | t.otherMs | edit.recP95Ms | edit.layoutP95Ms | edit.frameP95Ms | ui.frames   | ui.p99Ms    | ui.maxMs    | ui.dropped60 | js.p50Ms    | js.maxMs        | js.dropped60 | heap.afterMB | steps   | scrollRange       |
| -------- | -------- | ------- | ----------------- | ------------- | --------- | ------------- | ---------------- | --------------- | ----------- | ----------- | ----------- | ------------ | ----------- | --------------- | ------------ | ------------ | ------- | ----------------- |
| initial  | long     | 1 / 1   | 5495.9 / 5633.1   | 52062 / 52062 | 5.6 / 7.2 | —             | —                | —               | 335 / 343   | 16.7 / 16.7 | 16.7 / 33.7 | 0 / 1        | 16.9 / 22.2 | 5561.1 / 5702.8 | 333 / 341    | 19.9 / 19.9  | —       | —                 |
| initial  | short    | 1 / 1   | 313.6 / 336.9     | 2870 / 2870   | 6.2 / 7.4 | —             | —                | —               | 20 / 22     | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 17.2 / 26.5 | 323.5 / 349.5   | 19 / 20      | 16.3 / 16.3  | —       | —                 |
| initial  | musicxml | 1 / 1   | 6721.8 / 7007.1   | 63833 / 63833 | 6.4 / 7.9 | —             | —                | —               | 409 / 426   | 16.7 / 16.7 | 16.7 / 33.3 | 0 / 1        | 23.7 / 29.3 | 6799.1 / 7093.7 | 407 / 425    | 23.9 / 26.2  | —       | —                 |
| scroll   | long     | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.7 | 17.6 / 18.1     | 0 / 0        | 20 / 20      | —       | 70493.3 / 70493.3 |
| scroll   | short    | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 33.3 | 0 / 1        | 16.7 / 16.7 | 17.6 / 17.8     | 0 / 0        | 16.4 / 16.4  | —       | 3423.6 / 3423.6   |
| scroll   | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.7 | 17.7 / 17.7     | 0 / 0        | 25.8 / 26.3  | —       | 64513.5 / 64513.5 |
| playback | long     | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.7 | 21.8 / 22.9     | 0 / 0        | 28.5 / 28.5  | 49 / 49 | —                 |
| playback | short    | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.7 | 17.7 / 18.8     | 0 / 0        | 16.7 / 16.7  | 49 / 49 | —                 |
| playback | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —         | —             | —                | —               | 360 / 360   | 16.7 / 16.7 | 16.7 / 33.3 | 0 / 1        | 16.7 / 16.7 | 18.5 / 20.2     | 0 / 0        | 32.1 / 32.2  | 49 / 49 | —                 |
| edit     | long     | 10 / 10 | 55895.1 / 56832.4 | 52062 / 52062 | —         | 5644.5 / 5778 | 5708.4 / 5841.1  | 5733.4 / 5866.5 | 3584 / 3637 | 16.7 / 16.7 | 68.1 / 91.5 | 12 / 18      | 16.7 / 16.7 | 5709.3 / 5842   | 3386 / 3440  | 27.2 / 27.2  | —       | —                 |
| edit     | short    | 10 / 10 | 3173.2 / 3289     | 2870 / 2870   | —         | 330.8 / 338   | 335.8 / 342.7    | 366.1 / 366.9   | 396 / 401   | 16.7 / 16.7 | 16.7 / 16.7 | 0 / 0        | 16.7 / 16.7 | 336.8 / 343.9   | 187 / 194    | 10.2 / 11.4  | —       | —                 |

</details>

<details><summary>android, skia 3.0.3 (slow host mode): appendix (median / p95)</summary>

| Scenario | Fixture  | rec.n   | rec.totalMs       | rec.commands  | t.otherMs    | edit.recP95Ms   | edit.layoutP95Ms | edit.frameP95Ms | ui.frames   | ui.p99Ms      | ui.maxMs      | ui.dropped60 | js.p50Ms      | js.maxMs          | js.dropped60 | heap.afterMB | steps   | scrollRange       |
| -------- | -------- | ------- | ----------------- | ------------- | ------------ | --------------- | ---------------- | --------------- | ----------- | ------------- | ------------- | ------------ | ------------- | ----------------- | ------------ | ------------ | ------- | ----------------- |
| initial  | long     | 1 / 1   | 26150.5 / 28183.4 | 52062 / 52062 | 31.6 / 112   | —               | —                | —               | 1010 / 1166 | 100 / 100     | 116.7 / 116.7 | 557 / 606    | 19.6 / 67.7   | 26548.4 / 28618.6 | 1601 / 1717  | 21.9 / 22.5  | —       | —                 |
| initial  | short    | 1 / 1   | 1389.1 / 1635.5   | 2870 / 2870   | 28.2 / 129.5 | —               | —                | —               | 67 / 83     | 100 / 316.7   | 100 / 316.7   | 21 / 42      | 34.2 / 313    | 1435.6 / 1685     | 92 / 103     | 15.3 / 16.6  | —       | —                 |
| initial  | musicxml | 1 / 1   | 31105.1 / 32682.6 | 63833 / 63833 | 25.1 / 42.2  | —               | —                | —               | 1169 / 1379 | 83.3 / 100    | 116.7 / 233.3 | 630 / 837    | 24 / 54       | 31549.8 / 33077.4 | 1893 / 1985  | 23.6 / 26.1  | —       | —                 |
| scroll   | long     | 0 / 0   | 0 / 0             | 0 / 0         | —            | —               | —                | —               | 40 / 51     | 300 / 500     | 300 / 500     | 310 / 348    | 144.3 / 167.1 | 308.9 / 466.6     | 308 / 324    | 20.1 / 20.1  | —       | 69502.3 / 69502.3 |
| scroll   | short    | 0 / 0   | 0 / 0             | 0 / 0         | —            | —               | —                | —               | 50 / 53     | 366.7 / 450   | 366.7 / 450   | 318 / 319    | 136.5 / 157.3 | 361.8 / 450.3     | 306 / 317    | 15.5 / 15.8  | —       | 3367.5 / 3367.5   |
| scroll   | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —            | —               | —                | —               | 47 / 53     | 300 / 300     | 300 / 300     | 310 / 316    | 115.5 / 160.2 | 282.9 / 362.7     | 304 / 315    | 23.6 / 23.6  | —       | 64130.3 / 64130.3 |
| playback | long     | 0 / 0   | 0 / 0             | 0 / 0         | —            | —               | —                | —               | 56 / 142    | 283.3 / 350   | 300 / 350     | 315 / 320    | 116.1 / 118.4 | 301.9 / 356.1     | 315 / 321    | 28.1 / 28.9  | 50 / 50 | —                 |
| playback | short    | 0 / 0   | 0 / 0             | 0 / 0         | —            | —               | —                | —               | 51 / 77     | 400 / 466.7   | 400 / 466.7   | 312 / 325    | 100.2 / 105.8 | 404.1 / 473.9     | 310 / 315    | 18.3 / 18.4  | 49 / 51 | —                 |
| playback | musicxml | 0 / 0   | 0 / 0             | 0 / 0         | —            | —               | —                | —               | 46 / 48     | 383.3 / 450   | 383.3 / 450   | 320 / 336    | 100.3 / 117.5 | 384.9 / 465       | 315 / 321    | 33 / 33.3    | 50 / 51 | —                 |
| edit     | short    | 10 / 10 | 14278.2 / 15770.7 | 2870 / 2870   | —            | 1627.9 / 1711.5 | 1650.4 / 1738.2  | 1906.7 / 2100.6 | 693 / 700   | 166.7 / 183.3 | 233.3 / 400   | 528 / 585    | 59.5 / 77.7   | 1650.1 / 1737.6   | 1114 / 1197  | 11.2 / 12.1  | —       | —                 |

</details>
