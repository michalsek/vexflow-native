# `vexflow-native` Roadmap

This roadmap outlines the intended package split and the main implementation steps for evolving `vexflow-native` from a low-level React Native Skia bridge into a layered notation library.

## Implementation Roadmap

1. Stabilize `vexflow-native` as the low-level platform bridge that exposes the current Skia-backed VexFlow runtime pieces such as `VexflowCanvas`, `SkiaVexflowContext`, and the core constants, types, and helpers.

2. Add proper subpath exports so `vexflow-native/state`, `vexflow-native/renderer`, `vexflow-native/musicxml`, and later utility subpaths are first-class public entrypoints with generated types.

3. Introduce `vexflow-native/state` as the canonical notation data contract, based on the previous app’s score model but stripped of app-specific UI, storage, and state-management concerns.

4. Define the public renderer contracts up front in `vexflow-native/renderer`, including renderer config, layout mode types, render result types, and geometry outputs such as measure layouts and note bounds.

5. Port the previous measure/render split into a cleaner renderer core with explicit `measure()` and `render()` phases, preserving deterministic layout planning and playback-ready geometry.

6. Implement the three renderer layout modes in order: `infiniteScore`, then `documentEven`, then `document`, keeping each mode as a clear layout strategy rather than mixing them into one ambiguous flow.

7. Separate pure renderer logic from React and UI orchestration so the engine core stays reusable, while optional React helpers can consume engine outputs for Skia rendering, overlays, and scrolling.

8. Build `vexflow-native/musicxml` as a parser and loader layer that reads MusicXML and emits `vexflow-native/state` types that can be rendered directly by the renderer package.

9. Keep backend abstraction in mind from the start so the same library shape can later support plain web canvas, CanvasKit, and React Native Web through React Native Skia without forcing a renderer redesign.

10. Finish with tests, examples, utilities, and documentation that prove the subpath architecture works, the renderer modes behave as expected, and MusicXML import integrates cleanly with the shared state layer.

## Intended Public Imports

```ts
import * from 'vexflow-native';
import * from 'vexflow-native/state';
import * from 'vexflow-native/renderer';
import * from 'vexflow-native/musicxml';
```

## Renderer Layout Modes

`infiniteScore | document | documentEven`
